import { afterEach, expect, test } from 'vitest'
import { shortcutAction } from './shortcuts'

afterEach(() => (document.body.innerHTML = ''))

// The action a key pressed on `html`'s first element (or on the page itself) asks for.
function press(key: string, init: KeyboardEventInit = {}, html = '') {
  document.body.innerHTML = html
  const target = document.body.querySelector('[data-target]') ?? document.body
  let action: ReturnType<typeof shortcutAction> = null
  const listen = (e: KeyboardEvent) => (action = shortcutAction(e))
  window.addEventListener('keydown', listen)
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  window.removeEventListener('keydown', listen)
  return action
}

test('each single key has its action', () => {
  expect(press('/')).toBe('filter')
  expect(press('n')).toBe('new')
  expect(press('e')).toBe('edit')
  expect(press('?', { shiftKey: true })).toBe('help')
  expect(press('j')).toBe('next')
  expect(press('k')).toBe('previous')
  expect(press('N')).toBe('new') // Caps Lock
  expect(press('x')).toBeNull()
})

test.each([
  '<input data-target>',
  '<textarea data-target></textarea>',
  '<select data-target></select>',
  '<div contenteditable="true"><b data-target>x</b></div>',
])('nothing fires while typing in %s', (html) => {
  for (const key of ['/', 'n', 'e', '?', 'j', 'k', 'ArrowDown']) expect(press(key, {}, html)).toBeNull()
})

test('nothing fires with a modifier held', () => {
  expect(press('n', { ctrlKey: true })).toBeNull()
  expect(press('n', { metaKey: true })).toBeNull()
  expect(press('e', { altKey: true })).toBeNull()
  expect(press('N', { shiftKey: true })).toBeNull()
})

test('nothing fires while a dialog or the palette is open', () => {
  expect(press('n', {}, '<div role="dialog"></div>')).toBeNull()
  expect(press('?', {}, '<div role="alertdialog"><button data-target></button></div>')).toBeNull()
})

test('nothing fires anywhere in a Diagram, which has keys of its own: not on its canvas, not on its toolbar', () => {
  expect(press('n', {}, '<section class="diagram-canvas"><div class="vue-flow"><div data-target tabindex="0"></div></div></section>')).toBeNull()
  expect(press('n', {}, '<section class="diagram-canvas"><div class="vue-flow" data-target tabindex="-1"></div></section>')).toBeNull()
  for (const key of ['n', 'e', '/', 'j', 'k', '?']) expect(press(key, {}, '<section class="diagram-canvas"><button data-target></button></section>')).toBeNull()
})

test('the arrow keys move through the list only from inside it', () => {
  const list = '<section data-testid="list-column"><button data-testid="list-row" data-target></button></section>'
  expect(press('ArrowDown', {}, list)).toBe('next')
  expect(press('ArrowUp', {}, list)).toBe('previous')
  expect(press('ArrowDown')).toBeNull()
  expect(press('ArrowDown', {}, '<button data-target></button>')).toBeNull()
})
