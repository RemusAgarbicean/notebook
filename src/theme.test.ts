import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, test, vi } from 'vitest'

// A fake OS light/dark setting, in place before theme.ts first reads it.
const os = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const query = {
    matches: false,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
  }
  window.matchMedia = () => query as unknown as MediaQueryList
  return {
    setDark(dark: boolean) {
      query.matches = dark
      listeners.forEach((fn) => fn())
    },
  }
})

import App from './App.vue'
import { db, saveNow } from './notebook'
import type { NotebookFolder } from './storage'
import { memoryFolder } from './storage-memory'

beforeEach(() => {
  db.value = null
  os.setDark(false)
})

const isDark = () => document.documentElement.classList.contains('dark')

// Opens the Notebook in `folder` (creating it when empty) and returns the app.
async function open(folder: NotebookFolder) {
  const app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => null, reopen: async () => null } },
  })
  await flushPromises()
  await app
    .findAll('button')
    .find((b) => b.text() === 'Create new Notebook')!
    .trigger('click')
  await expect.poll(() => app.find('[data-testid="theme-switch"]').exists()).toBe(true)
  return app
}

type App = Awaited<ReturnType<typeof open>>

const choose = async (app: App, name: string) => {
  const tab = app.findAll('[data-testid="theme-switch"] [role="tab"]').find((t) => t.text() === name)!
  await tab.trigger('mousedown', { button: 0 })
  await flushPromises()
}

const chosen = (app: App) => app.get('[data-testid="theme-switch"] [aria-selected="true"]').text()

test('the switch offers System, Light and Dark, and starts on System', async () => {
  const app = await open(memoryFolder())

  expect(app.findAll('[data-testid="theme-switch"] [role="tab"]').map((t) => t.text())).toEqual([
    'System',
    'Light',
    'Dark',
  ])
  expect(chosen(app)).toBe('System')
  expect(isDark()).toBe(false)
})

test('choosing Dark or Light changes the UI at once, whatever the OS says', async () => {
  const app = await open(memoryFolder())

  await choose(app, 'Dark')
  expect(isDark()).toBe(true)

  os.setDark(true)
  await choose(app, 'Light')
  expect(isDark()).toBe(false)
})

test('System follows the OS setting live', async () => {
  const app = await open(memoryFolder())

  os.setDark(true)
  expect(isDark()).toBe(true)
  os.setDark(false)
  expect(isDark()).toBe(false)

  await choose(app, 'Dark')
  await choose(app, 'System')
  expect(isDark()).toBe(false)
})

test('the choice is saved in the Notebook file and survives a reload', async () => {
  const folder = memoryFolder()
  await choose(await open(folder), 'Dark')
  await saveNow()

  db.value = null
  expect(isDark()).toBe(false)

  const app = await open(memoryFolder(folder.file))
  expect(chosen(app)).toBe('Dark')
  expect(isDark()).toBe(true)
})
