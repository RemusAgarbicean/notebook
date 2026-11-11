import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { paletteOpen } from './palette'
import { createRecord, getRecord } from './records'
import { memoryFolder } from './storage-memory'

let app: VueWrapper
let id: number

beforeEach(async () => {
  closeNotebook()
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => null, reopen: async () => null } },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
  id = createRecord('process', 'Buying')
  openRecord('process', id)
  await flushPromises()
})
afterEach(() => app.unmount())

const area = () => app.get('[data-testid="notes"] textarea')
const el = () => area().element as HTMLTextAreaElement
const notes = () => getRecord('process', id)!.notes
// The user's text with `|` at the caret, or around the selection.
async function type(marked: string) {
  const [a, b, c] = marked.split('|')
  await area().setValue(a + b + (c ?? ''))
  el().setSelectionRange(a.length, c === undefined ? a.length : a.length + b.length)
}
const press = async (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  el().dispatchEvent(event)
  await flushPromises()
  return event
}

test('Ctrl+B makes the selection bold and saves it', async () => {
  await type('pay |the invoice| now')

  const event = await press('b', { ctrlKey: true })

  expect(notes()).toBe('pay **the invoice** now')
  expect(event.defaultPrevented).toBe(true)
  expect([el().selectionStart, el().selectionEnd]).toEqual([6, 17])
})

test('Ctrl+I and Ctrl+E make italic and code', async () => {
  await type('|a|')
  await press('i', { ctrlKey: true })
  expect(notes()).toBe('*a*')

  await type('|a|')
  await press('e', { ctrlKey: true })
  expect(notes()).toBe('`a`')
})

test('Ctrl+K is left alone: it opens the palette', async () => {
  await type('|a|')

  await press('k', { ctrlKey: true })

  expect(notes()).toBe('a')
  expect(paletteOpen.value).toBe(true)
  paletteOpen.value = false
})

test('Enter continues a numbered list', async () => {
  await type('1. Requisition|')

  expect((await press('Enter')).defaultPrevented).toBe(true)

  expect(notes()).toBe('1. Requisition\n2. ')
})

test('Enter outside a list is the browser\'s own', async () => {
  await type('plain|')

  expect((await press('Enter')).defaultPrevented).toBe(false)
})

test('Tab indents a list item, and outside a list it is left to move the focus', async () => {
  await type('- one|')
  expect((await press('Tab')).defaultPrevented).toBe(true)
  expect(notes()).toBe('    - one')
  expect((await press('Tab', { shiftKey: true })).defaultPrevented).toBe(true)
  expect(notes()).toBe('- one')

  await type('plain|')
  expect((await press('Tab')).defaultPrevented).toBe(false)
  expect((await press('Tab', { shiftKey: true })).defaultPrevented).toBe(false)
})

test('Escape leaves edit mode with the focus on the Edit button', async () => {
  await type('some notes|')

  await press('Escape')

  expect(app.find('[data-testid="notes"] textarea').exists()).toBe(false)
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Edit Notes')
})

test('while the Mention list is open, Enter, Tab and Escape belong to it', async () => {
  createRecord('person', 'Maria')
  await area().setValue('- ask [[mar')

  await press('Tab')
  expect(notes()).toBe('- ask [[Maria]]')

  await area().setValue('- ask [[mar')
  await press('Escape')
  expect(app.find('[data-testid="mention-option"]').exists()).toBe(false)
  expect(app.find('[data-testid="notes"] textarea').exists()).toBe(true)

  await area().setValue('- ask [[mar')
  await press('Enter')
  expect(notes()).toBe('- ask [[Maria]]')
})

const paste = async (text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.assign(event, { clipboardData: { getData: (kind: string) => (kind === 'text/plain' ? text : '') } })
  el().dispatchEvent(event)
  await flushPromises()
  return event
}

test('pasting a web address over selected text makes a link', async () => {
  await type('see |the wiki|')

  expect((await paste('https://wiki.example.com')).defaultPrevented).toBe(true)

  expect(notes()).toBe('see [the wiki](https://wiki.example.com)')
})

test('pasting a copied spreadsheet range makes a table, and other text pastes as usual', async () => {
  await type('|')
  await paste('System\tOwner\nCoupa\tAna')
  expect(notes()).toBe('| System | Owner |\n| --- | --- |\n| Coupa | Ana |\n')

  expect((await paste('plain')).defaultPrevented).toBe(false)
})
