import { expect, test } from 'vitest'
import { shortcut } from './platform'

test('a shortcut is written with ⌘ on a Mac and with Ctrl elsewhere', () => {
  expect(shortcut('K', 'MacIntel')).toBe('⌘K')
  expect(shortcut('K', 'Win32')).toBe('Ctrl K')
  expect(shortcut('S', 'Linux x86_64')).toBe('Ctrl S')
})
