import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, list } from './navigation'
import { closeNotebook, db } from './notebook'
import { createRecord, listRecords, updateRecord } from './records'
import { LABEL } from './relation-slots'
import { addRelation } from './relations'
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
const pressCtrlK = async (init: KeyboardEventInit = { ctrlKey: true }) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', cancelable: true, ...init }))
  await flushPromises()
}
const type = (text: string) => get('palette-input').setValue(text)
const card = (name: string) => texts(`home-${name}`)

// ---- Palette

test('Ctrl+K opens the palette from a Record page, and searching finds a Record by its notes', async () => {
  const ana = createRecord('person', 'Ana')
  updateRecord('person', ana, { notes: 'Ask her about budget approval.' })
  const sap = createRecord('system', 'SAP')
  current.value = { type: 'system', id: sap }
  list.value = 'system'
  await flushPromises()
  expect(app.find('[data-testid="palette"]').exists()).toBe(false)

  await pressCtrlK()
  await type('approval')

  expect(texts('palette-option')[0]).toBe('AnaNotes')
  await get('palette-input').trigger('keydown', { key: 'Enter' })

  expect(current.value).toEqual({ type: 'person', id: ana })
  expect(app.find('[data-testid="palette"]').exists()).toBe(false)
  expect((get('record-title').element as HTMLInputElement).value).toBe('Ana')
})

test('⌘K, the sidebar Search button and the Home search box all open the palette; Escape closes it', async () => {
  for (const open of [
    () => pressCtrlK({ metaKey: true }),
    () => get('search').trigger('click'),
    () => get('home-search').trigger('click'),
  ]) {
    await open()
    expect(app.find('[data-testid="palette"]').exists()).toBe(true)
    expect(document.activeElement).toBe(get('palette-input').element)
    await get('palette-input').trigger('keydown', { key: 'Escape' })
    expect(app.find('[data-testid="palette"]').exists()).toBe(false)
  }
})

test('results are grouped by type and the arrow keys choose which one ↵ opens', async () => {
  createRecord('system', 'Invoice hub')
  const flow = createRecord('process', 'Invoice approval')
  createRecord('process', 'Invoice dispute')
  await pressCtrlK()
  await type('invoice')

  expect(texts('palette-group')).toEqual(['Systems', 'Processes', 'Create'])
  expect(texts('palette-option').slice(0, 3)).toEqual(['Invoice hub', 'Invoice approval', 'Invoice dispute'])
  const selected = () => app.findAll('[data-testid="palette-option"]').findIndex((o) => o.attributes('aria-selected') === 'true')
  expect(selected()).toBe(0)

  await get('palette-input').trigger('keydown', { key: 'ArrowDown' })
  expect(selected()).toBe(1)
  await get('palette-input').trigger('keydown', { key: 'ArrowUp' })
  await get('palette-input').trigger('keydown', { key: 'ArrowUp' })
  expect(selected()).toBe(texts('palette-option').length - 1)
  await get('palette-input').trigger('keydown', { key: 'ArrowDown' })
  await get('palette-input').trigger('keydown', { key: 'ArrowDown' })
  await get('palette-input').trigger('keydown', { key: 'Enter' })

  expect(current.value).toEqual({ type: 'process', id: flow })
})

test("the palette offers Create <Type> '<text>', which creates the Record and opens its page", async () => {
  await pressCtrlK()
  await type('  Vendor onboarding ')

  expect(texts('palette-option')).toContain("Create Process 'Vendor onboarding'")
  expect(texts('palette-option')).toHaveLength(11)
  await app
    .findAll('[data-testid="palette-option"]')
    .find((o) => o.text() === "Create Process 'Vendor onboarding'")!
    .trigger('click')

  const [made] = listRecords('process')
  expect(made.title).toBe('Vendor onboarding')
  expect(current.value).toEqual({ type: 'process', id: made.id })
  expect(list.value).toBe('process')
  expect((get('record-title').element as HTMLInputElement).value).toBe('Vendor onboarding')
})

// ---- Home

test('Home is the landing page and takes the place of the list and page columns', async () => {
  expect(app.find('[data-testid="home"]').exists()).toBe(true)
  expect(app.find('[data-testid="list-column"]').exists()).toBe(false)
  expect(app.find('[data-testid="page-column"]').exists()).toBe(false)
})

test('Open Tasks shows open Tasks with their due date and Project, and drops a Task once done', async () => {
  const project = createRecord('project', 'ERP rollout')
  const map = createRecord('task', 'Map interfaces', { due: '2026-12-01' })
  addRelation({ type: 'task', id: map }, LABEL.partOf, { type: 'project', id: project })
  createRecord('task', 'Book room')
  createRecord('task', 'Old chore', { done: true })
  await flushPromises()

  expect(card('task')).toEqual(['Map interfacesERP rollout2026-12-01', 'Book room'])

  updateRecord('task', map, { done: true })
  await flushPromises()
  expect(card('task')).toEqual(['Book room'])
})

test('Open questions shows only open ones', async () => {
  const who = createRecord('open_question', 'Who approves invoices?')
  createRecord('open_question', 'Settled already', { status: 'answered' })
  await flushPromises()

  expect(card('open_question')).toEqual(['Who approves invoices?'])

  updateRecord('open_question', who, { status: 'answered' })
  await flushPromises()
  expect(card('open_question')).toEqual([])
})

test('Journal shows entries latest first', async () => {
  createRecord('journal_entry', 'Kickoff', { date: '2026-11-02', kind: 'meeting' })
  createRecord('journal_entry', 'First day', { date: '2026-11-01' })
  createRecord('journal_entry', 'Retro', { date: '2026-11-09' })
  await flushPromises()

  expect(card('journal_entry')).toEqual(['Retro2026-11-09', 'Kickoff2026-11-02', 'First day2026-11-01'])
})

test('Recently edited shows Records of any type, the last edited first', async () => {
  const sap = createRecord('system', 'SAP')
  const ana = createRecord('person', 'Ana')
  // Edits within one test land in the same millisecond, so earlier edits are dated by hand.
  db.value!.run("update system set updated_at = '2000-01-01T10:00:00.000Z' where id = ?", [sap])
  db.value!.run("update person set updated_at = '2000-01-02T10:00:00.000Z' where id = ?", [ana])
  updateRecord('person', ana, { role: 'Controller' })
  await flushPromises()
  expect(card('recent')).toEqual(['AnaPerson', 'SAPSystem'])

  db.value!.run("update person set updated_at = '2000-01-02T10:00:00.000Z' where id = ?", [ana])
  updateRecord('system', sap, { summary: 'ERP' })
  await flushPromises()
  expect(card('recent')).toEqual(['SAPSystem', 'AnaPerson'])
})

test('Active Projects shows each active Project with its count of open Tasks', async () => {
  const erp = createRecord('project', 'ERP rollout')
  createRecord('project', 'Office move')
  const paused = createRecord('project', 'Paused thing', { status: 'on hold' })
  const tasks = ['A', 'B', 'C'].map((t) => createRecord('task', t))
  for (const id of tasks) addRelation({ type: 'task', id }, LABEL.partOf, { type: 'project', id: erp })
  updateRecord('task', tasks[2], { done: true })
  await flushPromises()

  expect(card('project')).toEqual(['ERP rollout2 open Tasks', 'Office move0 open Tasks'])

  updateRecord('task', tasks[1], { done: true })
  updateRecord('project', paused, { status: 'active' })
  await flushPromises()
  expect(card('project')).toEqual(['ERP rollout1 open Task', 'Office move0 open Tasks', 'Paused thing0 open Tasks'])
})

test('clicking a Record on a Home card opens its page', async () => {
  const id = createRecord('task', 'Book room')
  await flushPromises()

  await get('home-task').trigger('click')

  expect(current.value).toEqual({ type: 'task', id })
  expect(app.find('[data-testid="page-column"]').exists()).toBe(true)
})
