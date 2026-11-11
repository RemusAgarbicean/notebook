import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { list } from './navigation'
import { closeNotebook } from './notebook'
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
const has = (id: string) => app.find(`[data-testid="${id}"]`).exists()
const key = async (k: string) => {
  await get('quiz-dialog').trigger('keydown', { key: k })
  await flushPromises()
}
const EXPANSIONS: Record<string, string> = { PO: 'Purchase order', GRN: 'Goods received note' }

async function open() {
  createRecord('acronym', 'PO', { expansion: 'Purchase order', notes: 'Sent by a **buyer**' })
  createRecord('acronym', 'GRN', { expansion: 'Goods received note' })
  createRecord('acronym', 'TBD')
  list.value = 'acronym'
  await flushPromises()
  await get('quiz-open').trigger('click')
  await flushPromises()
}

test('the Quiz button needs two Acronyms with an expansion, and only the Acronyms list has it', async () => {
  createRecord('acronym', 'PO', { expansion: 'Purchase order' })
  createRecord('acronym', 'TBD')
  list.value = 'acronym'
  await flushPromises()
  expect(has('quiz-open')).toBe(false)

  createRecord('acronym', 'GRN', { expansion: 'Goods received note' })
  await flushPromises()
  expect(has('quiz-open')).toBe(true)

  list.value = 'system'
  await flushPromises()
  expect(has('quiz-open')).toBe(false)
})

test('a card shows the Acronym, reveals its expansion and notes, and a card not known comes back', async () => {
  await open()
  expect(get('quiz-progress').text()).toBe('0 of 2 known · 2 to go')
  const first = get('quiz-acronym').text()
  expect(has('quiz-expansion')).toBe(false)

  await get('quiz-reveal').trigger('click')
  expect(get('quiz-expansion').text()).toBe(EXPANSIONS[first])
  await get('quiz-unknown').trigger('click')

  const second = get('quiz-acronym').text()
  expect(second).not.toBe(first)
  expect(has('quiz-expansion')).toBe(false)
  await get('quiz-reveal').trigger('click')
  await get('quiz-known').trigger('click')
  expect(get('quiz-progress').text()).toBe('1 of 2 known · 1 to go')

  expect(get('quiz-acronym').text()).toBe(first)
  await get('quiz-reveal').trigger('click')
  await get('quiz-known').trigger('click')
  expect(get('quiz-done').text()).toBe('All 2 known.')
  expect(get('quiz-progress').text()).toBe('2 of 2 known')
})

test('the quiz runs from the keyboard: Space reveals, 1 and the arrows answer, Esc closes', async () => {
  await open()
  const first = get('quiz-acronym').text()

  await key('1')
  expect(get('quiz-acronym').text()).toBe(first)
  await key(' ')
  expect(get('quiz-expansion').text()).toBe(EXPANSIONS[first])
  if (first === 'PO') expect(get('quiz-notes').html()).toContain('<strong>buyer</strong>')
  await key('ArrowLeft')
  expect(get('quiz-acronym').text()).not.toBe(first)
  await key(' ')
  await key('ArrowRight')
  await key(' ')
  await key('1')
  expect(has('quiz-done')).toBe(true)

  await get('quiz-again').trigger('click')
  expect(get('quiz-progress').text()).toBe('0 of 2 known · 2 to go')
  await key('Escape')
  expect(has('quiz-dialog')).toBe(false)
  // Nothing about a quiz is saved.
  expect(listRecords('acronym').every((a) => a.created_at === a.updated_at)).toBe(true)
})
