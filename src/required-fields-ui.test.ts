import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { list, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { addTag, createRecord, incompleteRecords, updateRecord } from './records'
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
const texts = (id: string) => app.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const markers = () => app.findAll('[data-testid="incomplete"]').map((m) => m.attributes('aria-label'))

test('a Record with an empty required field is incomplete until the field is filled', () => {
  const po = createRecord('acronym', 'PO')
  createRecord('acronym', 'S2P', { expansion: 'Source-to-Pay' })
  const wiki = createRecord('bookmark', 'Wiki')
  createRecord('system', 'Coupa')
  createRecord('journal_entry', '')

  expect(incompleteRecords()).toEqual([
    { type: 'acronym', id: po, title: 'PO', missing: 'Expansion' },
    { type: 'bookmark', id: wiki, title: 'Wiki', missing: 'URL' },
  ])

  updateRecord('acronym', po, { expansion: 'Purchase order' })
  expect(incompleteRecords().map((r) => r.title)).toEqual(['Wiki'])
})

test('an incomplete Record carries a named marker in its list row, in a type list and in a Tag list', async () => {
  const po = createRecord('acronym', 'PO')
  createRecord('acronym', 'S2P', { expansion: 'Source-to-Pay' })
  addTag('acronym', po, 'finance')
  list.value = 'acronym'
  await flushPromises()

  expect(texts('list-row')).toEqual(['PO', 'S2PSource-to-Pay'])
  expect(markers()).toEqual(['Incomplete: Expansion is empty'])
  expect(app.findAll('[data-testid="list-row"]')[0].find('[data-testid="incomplete"]').exists()).toBe(true)

  await get('tag').trigger('click')
  expect(markers()).toEqual(['Incomplete: Expansion is empty'])

  updateRecord('acronym', po, { expansion: 'Purchase order' })
  await flushPromises()
  expect(markers()).toEqual([])
})

test('Home lists incomplete Records under Needs attention, and hides the card when there are none', async () => {
  expect(app.text()).not.toContain('Needs attention')

  const wiki = createRecord('bookmark', 'Wiki')
  await flushPromises()
  expect(app.text()).toContain('Needs attention')
  expect(texts('home-incomplete')).toEqual(['WikiURL is empty'])

  await get('home-incomplete').trigger('click')
  expect(document.activeElement).toBe(get('field-url').element)

  updateRecord('bookmark', wiki, { url: 'https://wiki.example' })
  list.value = 'home'
  await flushPromises()
  expect(app.text()).not.toContain('Needs attention')
})

test('+ New on a type with a required field selects the title, and Enter in the title moves to the empty field', async () => {
  list.value = 'acronym'
  await flushPromises()
  await get('new-record').trigger('click')

  expect(document.activeElement).toBe(get('record-title').element)
  expect(get('field-expansion').attributes('aria-invalid')).toBe('true')

  ;(get('record-title').element as HTMLInputElement).value = 'PO'
  await get('record-title').trigger('change')
  await get('record-title').trigger('keydown', { key: 'Enter' })
  await flushPromises()

  expect(document.activeElement).toBe(get('field-expansion').element)
})

test("the palette's Create lands on the empty required field, the title being given already", async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }))
  await flushPromises()
  await get('palette-input').setValue('PO')
  await app
    .findAll('[data-testid="palette-option"]')
    .find((o) => o.text() === "Create Acronym 'PO'")!
    .trigger('click')
  await flushPromises()

  expect((get('record-title').element as HTMLInputElement).value).toBe('PO')
  expect(document.activeElement).toBe(get('field-expansion').element)
})

test('Enter in the title of a complete Record leaves the focus where it is', async () => {
  openRecord('acronym', createRecord('acronym', 'PO', { expansion: 'Purchase order' }))
  await flushPromises()
  ;(get('record-title').element as HTMLElement).focus()
  await get('record-title').trigger('keydown', { key: 'Enter' })
  await flushPromises()

  expect(document.activeElement).toBe(get('record-title').element)
})
