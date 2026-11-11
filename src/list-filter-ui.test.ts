import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { hideClosed } from './list-filter'
import { closeNotebook } from './notebook'
import { addTag, createRecord } from './records'
import { memoryFolder } from './storage-memory'

let app: VueWrapper

beforeEach(async () => {
  closeNotebook()
  hideClosed.value = false
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
const titles = () => app.findAll('[data-testid="list-row"] .font-medium').map((r) => r.text())
const showType = (label: string) =>
  app.findAll('[data-testid="record-type"]').find((b) => b.text().startsWith(label))!.trigger('click')
const filter = () => get('list-filter').element as HTMLInputElement

test('typing in the filter narrows the list by title and key field, ignoring case', async () => {
  createRecord('acronym', 'PO', { expansion: 'Purchase Order' })
  createRecord('acronym', 'GRN', { expansion: 'Goods Received Note' })
  createRecord('acronym', 'S2P', { expansion: 'Source to Pay' })
  await showType('Acronyms')

  await get('list-filter').setValue('grn')
  expect(titles()).toEqual(['GRN'])

  await get('list-filter').setValue('PURCHASE')
  expect(titles()).toEqual(['PO'])
})

test('a filter that matches nothing says so, and Esc clears it', async () => {
  createRecord('acronym', 'PO', { expansion: 'Purchase Order' })
  await showType('Acronyms')

  await get('list-filter').setValue('zzz')
  expect(titles()).toEqual([])
  expect(get('list-empty').text()).toBe('No Acronyms match "zzz".')

  await get('list-filter').trigger('keydown', { key: 'Escape' })
  expect(filter().value).toBe('')
  expect(titles()).toEqual(['PO'])
})

test('the filter starts empty again in another list', async () => {
  createRecord('acronym', 'PO', { expansion: 'Purchase Order' })
  createRecord('system', 'Coupa')
  await showType('Acronyms')
  await get('list-filter').setValue('zzz')

  await showType('Systems')

  expect(filter().value).toBe('')
  expect(titles()).toEqual(['Coupa'])
})

test('a Tag list filters by title and by the type named under it', async () => {
  addTag('system', createRecord('system', 'Coupa'), 'p2p')
  addTag('person', createRecord('person', 'Maria'), 'p2p')
  await flushPromises()
  await get('tag').trigger('click')

  await get('list-filter').setValue('person')

  expect(titles()).toEqual(['Maria'])
})

test('Enter in the filter opens the first Record left', async () => {
  createRecord('acronym', 'PO', { expansion: 'Purchase Order' })
  createRecord('acronym', 'GRN', { expansion: 'Goods Received Note' })
  await showType('Acronyms')

  await get('list-filter').setValue('po')
  await get('list-filter').trigger('keydown', { key: 'Enter' })

  expect((get('record-title').element as HTMLInputElement).value).toBe('PO')
})

test('Tasks can hide the done ones; the toggle is off to begin with', async () => {
  createRecord('task', 'Map fields')
  createRecord('task', 'Get access', { done: true })
  await showType('Tasks')
  expect(titles()).toEqual(['Map fields', 'Get access'])
  expect(get('hide-closed').text()).toBe('Hide done')
  expect(get('hide-closed').attributes('aria-pressed')).toBe('false')

  await get('hide-closed').trigger('click')

  expect(titles()).toEqual(['Map fields'])
  expect(get('hide-closed').attributes('aria-pressed')).toBe('true')
})

test('Open questions can hide the answered ones, and say so when none is left', async () => {
  createRecord('open_question', 'Who approves?', { status: 'answered' })
  await showType('Open questions')
  expect(get('hide-closed').text()).toBe('Hide answered')

  await get('hide-closed').trigger('click')

  expect(get('list-empty').text()).toBe('No open Open questions. Hide answered is on.')
})

test('other lists have no such toggle', async () => {
  createRecord('project', 'Cleanup', { status: 'done' })
  hideClosed.value = true
  await showType('Projects')

  expect(app.find('[data-testid="hide-closed"]').exists()).toBe(false)
  expect(titles()).toEqual(['Cleanup'])
})
