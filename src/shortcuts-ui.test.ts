import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { paletteOpen } from './palette'
import { shortcut } from './platform'
import { createRecord, listRecords } from './records'
import { memoryFolder } from './storage-memory'

let app: VueWrapper

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
})
afterEach(() => app.unmount())

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const showType = (label: string) =>
  app.findAll('[data-testid="record-type"]').find((b) => b.text().startsWith(label))!.trigger('click')
// A key pressed with the focus where it is; true when the app took the key.
async function press(key: string, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  ;(document.activeElement ?? document.body).dispatchEvent(e)
  await flushPromises()
  return e.defaultPrevented
}
const focused = () => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName

test('/ puts the focus in the list filter', async () => {
  createRecord('system', 'Coupa')
  await showType('Systems')
  ;(document.activeElement as HTMLElement).blur()

  expect(await press('/')).toBe(true)

  expect(focused()).toBe('list-filter')
})

test('n creates a Record of the type shown, like + New', async () => {
  await showType('Systems')
  ;(document.activeElement as HTMLElement).blur()

  await press('n')

  expect(listRecords('system').map((r) => r.title)).toEqual(['New System'])
  expect(current.value).toEqual({ type: 'system', id: listRecords('system')[0].id })
})

test('a key typed into a field is left alone', async () => {
  await showType('Systems')
  await press('n')
  // In a browser the new Record's title already has the focus.
  ;(get('record-title').element as HTMLElement).focus()

  expect(await press('n')).toBe(false)
  expect(await press('?')).toBe(false)

  expect(listRecords('system')).toHaveLength(1)
  expect(app.find('[data-testid="shortcuts-dialog"]').exists()).toBe(false)
})

test('j and k move the focus through the list, starting from the open Record', async () => {
  createRecord('system', 'Ariba')
  const coupa = createRecord('system', 'Coupa')
  createRecord('system', 'SAP')
  openRecord('system', coupa)
  await flushPromises()

  await press('j')
  expect(document.activeElement?.textContent).toContain('SAP')
  await press('j')
  expect(document.activeElement?.textContent).toContain('SAP')
  await press('k')
  await press('ArrowUp')
  expect(document.activeElement?.textContent).toContain('Ariba')
  // Moving does not open anything: Enter does, as on any button.
  expect(current.value).toEqual({ type: 'system', id: coupa })
})

test('the down arrow in the filter goes to the first row', async () => {
  createRecord('system', 'Coupa')
  await showType('Systems')
  await press('/')

  await get('list-filter').trigger('keydown', { key: 'ArrowDown' })

  expect(focused()).toBe('list-row')
})

test('e starts editing the notes of the open Record', async () => {
  openRecord('system', createRecord('system', 'Coupa', { notes: 'Some notes' }))
  await flushPromises()
  ;(document.activeElement as HTMLElement).blur()
  expect(get('notes').find('textarea').exists()).toBe(false)

  expect(await press('e')).toBe(true)

  expect(document.activeElement).toBe(get('notes').get('textarea').element)
})

test('? opens the shortcuts dialog, which lists them with this platform\'s modifier', async () => {
  expect(await press('?', { shiftKey: true })).toBe(true)

  const keys = app.findAll('[data-testid="shortcut-keys"]').map((k) => k.text())
  expect(keys).toContain(shortcut('K'))
  expect(keys).toContain(shortcut('S'))
  expect(keys).toEqual(expect.arrayContaining(['/', 'N', 'E', '?', 'JK']))

  await get('shortcuts-dialog').trigger('keydown', { key: 'Escape' })
  expect(app.find('[data-testid="shortcuts-dialog"]').exists()).toBe(false)
})

test('the sidebar footer has a Shortcuts entry that opens the same dialog', async () => {
  expect(get('sidebar').get('footer').text()).toContain('Shortcuts')

  await get('open-shortcuts').trigger('click')

  expect(get('shortcuts-dialog').text()).toContain('Keyboard shortcuts')
})

test('no single key fires while the palette is open', async () => {
  await showType('Systems')
  paletteOpen.value = true
  await flushPromises()
  // Even with the focus outside the palette's input.
  ;(document.activeElement as HTMLElement).blur()

  await press('n')

  expect(listRecords('system')).toHaveLength(0)
})
