import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createTabLock, type TabChannel } from './tab-lock'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const settle = () => vi.advanceTimersByTimeAsync(0)

// One browser: every tab made from it shares the channel and the lock.
function browser({ locks: withLocks = true } = {}) {
  const channels: TabChannel[] = []
  let held = false
  const waiting: (() => void)[] = []
  const locks = {
    request(_name: string, a: unknown, b?: unknown) {
      const callback = (b ?? a) as (lock: object | null) => unknown
      const run = async () => {
        held = true
        try {
          await callback({})
        } finally {
          held = false
          waiting.shift()?.()
        }
      }
      if (!held) return run()
      if (b && (a as LockOptions).ifAvailable) return Promise.resolve(callback(null))
      return new Promise((resolve) => waiting.push(() => resolve(run())))
    },
  } as unknown as LockManager

  return {
    /** Opens a tab. `stepDown` plays its save: resolve false for a save that failed. */
    tab(stepDown = async () => true) {
      const channel: TabChannel = {
        onmessage: null,
        postMessage: (data) =>
          channels
            .filter((c) => c !== channel)
            .forEach((c) => queueMicrotask(() => c.onmessage?.({ data } as MessageEvent))),
      }
      channels.push(channel)
      const tab = createTabLock(withLocks ? locks : undefined, channel, stepDown)
      return Object.assign(tab, {
        // The tab is closed: it stops answering, and the browser frees its lock.
        close() {
          channels.splice(channels.indexOf(channel), 1)
        },
      })
    },
  }
}

for (const mode of [{ locks: true }, { locks: false }]) {
  const name = mode.locks ? 'Web Locks' : 'BroadcastChannel only'

  test(`${name}: the first tab edits and a second tab is blocked`, async () => {
    const { tab } = browser(mode)
    const first = tab()
    await settle()
    const second = tab()
    await settle()

    expect(first.blocked.value).toBe(false)
    expect(second.blocked.value).toBe(true)
  })

  test(`${name}: Use it here makes the first tab save and step down, then edits here`, async () => {
    const { tab } = browser(mode)
    const steps: string[] = []
    const first = tab(async () => {
      steps.push('first tab saved')
      return true
    })
    await settle()
    const second = tab()
    await settle()

    second.useHere()
    await vi.advanceTimersByTimeAsync(1000)

    expect(steps).toEqual(['first tab saved'])
    expect(first.blocked.value).toBe(true)
    expect(second.blocked.value).toBe(false)

    first.useHere()
    await vi.advanceTimersByTimeAsync(1000)
    expect(first.blocked.value).toBe(false)
    expect(second.blocked.value).toBe(true)
  })

  test(`${name}: a tab whose save fails keeps editing and the other stays blocked`, async () => {
    const { tab } = browser(mode)
    const first = tab(async () => false)
    await settle()
    const second = tab()
    await settle()

    second.useHere()
    await vi.advanceTimersByTimeAsync(1000)

    expect(first.blocked.value).toBe(false)
    expect(second.blocked.value).toBe(true)
  })
}

test('BroadcastChannel only: Use it here works after the editing tab was closed', async () => {
  const { tab } = browser({ locks: false })
  const first = tab()
  await settle()
  const second = tab()
  await settle()
  first.close()

  second.useHere()
  await vi.advanceTimersByTimeAsync(1000)

  expect(second.blocked.value).toBe(false)
})

test('falls back to BroadcastChannel when Web Locks are refused', async () => {
  const refusing = { request: () => Promise.reject(new DOMException('', 'SecurityError')) }
  const channel: TabChannel = { onmessage: null, postMessage: vi.fn() }

  const tab = createTabLock(refusing as unknown as LockManager, channel, async () => true)
  await settle()

  expect(tab.blocked.value).toBe(false)
  expect(channel.postMessage).toHaveBeenCalledWith('who-edits')
})
