import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { current, list, openRecord } from './navigation'
import { db } from './notebook'
import { addTag, createRecord, getRecord, listRecords, updateRecord } from './records'
import { memoryFolder } from './storage-memory'

let app: VueWrapper

beforeEach(async () => {
  db.value = null
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => null, reopen: async () => null } },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
})
afterEach(() => {
  app.unmount()
  vi.unstubAllGlobals()
})

const get = (id: string) => app.get(`[data-testid="${id}"]`)
// What the browser does when the user edits a text field and leaves it.
const change = (id: string, value: string) => {
  ;(get(id).element as HTMLInputElement).value = value
  return get(id).trigger('change')
}
const rowsText = () => app.findAll('[data-testid="list-row"]').map((r) => r.text())
const showType = (label: string) =>
  app.findAll('[data-testid="record-type"]').find((b) => b.text() === label)!.trigger('click')

test('+ New creates a Record, lists it and opens its page', async () => {
  await showType('Systems')
  expect(rowsText()).toEqual([])

  await get('new-record').trigger('click')

  expect(listRecords('system')).toHaveLength(1)
  expect(app.findAll('[data-testid="list-row"]')).toHaveLength(1)
  expect(get('page-column').text()).toContain('System')
  expect((get('record-title').element as HTMLInputElement).value).toBe('New System')
})

test('editing the title and a field on the page updates the Record and its list row', async () => {
  await showType('Systems')
  await get('new-record').trigger('click')

  await change('record-title', 'Coupa')
  await change('field-summary', 'Procure-to-pay suite')

  expect(listRecords('system')[0]).toMatchObject({ title: 'Coupa', summary: 'Procure-to-pay suite' })
  expect(rowsText()).toEqual(['CoupaProcure-to-pay suite'])
})

test('an empty title is refused with a message and the old title comes back', async () => {
  const id = createRecord('system', 'Coupa')
  openRecord('system', id)
  await flushPromises()

  await change('record-title', '')

  expect(app.get('[role="alert"]').text()).toBe('Title is required')
  expect((get('record-title').element as HTMLInputElement).value).toBe('Coupa')
  expect(getRecord('system', id)!.title).toBe('Coupa')
})

test('a required field that is still empty is marked on the page', async () => {
  openRecord('acronym', createRecord('acronym', 'PO'))
  await flushPromises()

  expect(get('page-column').text()).toContain('Required')

  await change('field-expansion', 'Purchase order')
  expect(get('page-column').text()).not.toContain('Required')
})

test('every type opens a page with its fixed fields', async () => {
  const expected = {
    system: ['summary', 'url'],
    acronym: ['expansion'],
    person: ['role', 'email', 'go_to_for'],
    team: [],
    process: [],
    project: ['status', 'due', 'summary'],
    diagram: [],
    bookmark: ['url'],
    open_question: ['status', 'answer'],
    task: ['done', 'due'],
    journal_entry: ['date', 'kind'],
  } as const
  for (const [type, fields] of Object.entries(expected)) {
    openRecord(type as keyof typeof expected, createRecord(type as keyof typeof expected, 'X'))
    await flushPromises()
    const shown = app.findAll('[data-testid^="field-"]').map((f) => f.attributes('data-testid')!.slice(6))
    expect(shown, type).toEqual(fields)
    expect(app.find('[data-testid="notes"]').exists()).toBe(true)
  }
})

test('ticking a Task on its page marks it done, and unticking reopens it', async () => {
  const id = createRecord('task', 'Get Coupa access')
  openRecord('task', id)
  await flushPromises()

  await get('field-done').setValue(true)
  expect(getRecord('task', id)!.done_at).not.toBeNull()

  await get('field-done').setValue(false)
  expect(getRecord('task', id)).toMatchObject({ done: 0, done_at: null })
})

test('notes are typed as markdown and shown rendered', async () => {
  const id = createRecord('process', 'Source-to-Pay')
  openRecord('process', id)
  await flushPromises()

  await get('notes').get('textarea').setValue('1. Requisition in **Coupa**')
  expect(getRecord('process', id)!.notes).toBe('1. Requisition in **Coupa**')

  await get('notes').get('button').trigger('click')
  expect(get('notes').get('[data-testid="markdown-view"]').html()).toContain('<strong>Coupa</strong>')
})

test('a Tag added on a page shows in the sidebar, and clicking it lists its Records across types', async () => {
  const coupa = createRecord('system', 'Coupa')
  addTag('person', createRecord('person', 'Maria Lopez'), 'S2P')
  openRecord('system', coupa)
  await flushPromises()

  await get('tag-input').setValue('s2p')
  await get('tag-input').trigger('keydown.enter')

  expect(app.findAll('[data-testid="record-tag"]').map((t) => t.text())).toEqual(['S2P'])
  const tags = app.findAll('[data-testid="tag"]')
  expect(tags.map((t) => t.text())).toEqual(['S2P'])

  await tags[0].trigger('click')
  expect(rowsText()).toEqual(['CoupaSystem', 'Maria LopezPerson'])

  await app.findAll('[data-testid="list-row"]')[1].trigger('click')
  expect((get('record-title').element as HTMLInputElement).value).toBe('Maria Lopez')
  expect(rowsText()).toHaveLength(2)
})

test('removing a Tag on the page takes it off the Record', async () => {
  const coupa = createRecord('system', 'Coupa')
  addTag('system', coupa, 'S2P')
  openRecord('system', coupa)
  await flushPromises()

  await get('record-tag').get('button').trigger('click')

  expect(app.find('[data-testid="record-tag"]').exists()).toBe(false)
  expect(app.find('[data-testid="tag"]').exists()).toBe(false)
})

test('Delete asks first: cancelling keeps the Record, confirming removes it and closes the page', async () => {
  const id = createRecord('system', 'Coupa')
  openRecord('system', id)
  await flushPromises()
  const confirm = vi.fn(() => false)
  vi.stubGlobal('confirm', confirm)

  await get('delete-record').trigger('click')
  expect(confirm).toHaveBeenCalledOnce()
  expect(getRecord('system', id)).not.toBeNull()

  confirm.mockReturnValue(true)
  await get('delete-record').trigger('click')
  expect(getRecord('system', id)).toBeNull()
  expect(rowsText()).toEqual([])
  expect(app.find('[data-testid="record-title"]').exists()).toBe(false)
})

test('a Diagram page shows a placeholder for the canvas', async () => {
  openRecord('diagram', createRecord('diagram', 'S2P overview'))
  await flushPromises()

  expect(app.find('[data-testid="diagram-placeholder"]').exists()).toBe(true)
})

test('openRecord shows the Record\'s type in the list and its page', async () => {
  createRecord('task', 'Other task')
  const id = createRecord('task', 'Get Coupa access')
  updateRecord('task', id, { due: '2026-12-01' })

  openRecord('task', id)
  await flushPromises()

  expect(list.value).toBe('task')
  expect(current.value).toEqual({ type: 'task', id })
  expect(rowsText()).toEqual(['Get Coupa access2026-12-01', 'Other task'])
  expect(app.get('[data-testid="list-row"][aria-current="true"]').text()).toContain('Get Coupa access')
})

test('opening another Notebook goes back to Home', async () => {
  openRecord('team', createRecord('team', 'Procurement'))
  await flushPromises()

  db.value = null
  await flushPromises()

  expect(list.value).toBe('home')
  expect(current.value).toBeNull()
})
