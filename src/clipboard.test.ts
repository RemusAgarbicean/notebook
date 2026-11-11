import { afterEach, expect, test, vi } from 'vitest'
import { copyText } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const clipboard = (writeText: (text: string) => Promise<void>) => vi.stubGlobal('navigator', { clipboard: { writeText } })
// happy-dom has no execCommand of its own.
const oldCopy = (result: () => boolean) => {
  let selected = ''
  document.execCommand = vi.fn(() => {
    selected = (document.activeElement as HTMLTextAreaElement).value
    return result()
  })
  return () => selected
}

test('text goes to the clipboard', async () => {
  const written: string[] = []
  clipboard(async (text) => void written.push(text))

  expect(await copyText('# Coupa')).toBe(true)
  expect(written).toEqual(['# Coupa'])
})

test('when the clipboard refuses, the old copy command copies the text and the focus comes back', async () => {
  clipboard(async () => {
    throw new Error('NotAllowedError')
  })
  const selected = oldCopy(() => true)
  const button = document.body.appendChild(document.createElement('button'))
  button.focus()

  expect(await copyText('# Coupa')).toBe(true)

  expect(selected()).toBe('# Coupa')
  expect(document.activeElement).toBe(button)
  expect(document.querySelector('textarea')).toBeNull()
  button.remove()
})

test('when both refuse, the caller is told', async () => {
  vi.stubGlobal('navigator', {})
  oldCopy(() => false)
  expect(await copyText('x')).toBe(false)

  oldCopy(() => {
    throw new Error('no')
  })
  expect(await copyText('x')).toBe(false)
})
