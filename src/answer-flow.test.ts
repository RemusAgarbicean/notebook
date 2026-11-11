import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { createRecord, getRecord, listRecords, updateRecord, type RecordRef } from './records'
import { LABEL } from './relation-slots'
import { hasRelation } from './relations'
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
const open = async (r: RecordRef) => {
  openRecord(r.type, r.id)
  await flushPromises()
}
const question = (fields = {}): RecordRef => ({
  type: 'open_question',
  id: createRecord('open_question', 'Who approves POs?', fields),
})
const relations = () =>
  app
    .findAll('[data-testid="relation-group"]')
    .map((g) => [g.get('h3').text(), g.findAll('[data-testid="relation"]').map((r) => r.text())])

test('answering, reopening and answering again keeps the answer and moves answered_at', async () => {
  const q = question({ answer: 'The budget owner.' })
  await open(q)
  expect(has('reopen')).toBe(false)

  await get('mark-answered').trigger('click')
  expect(getRecord('open_question', q.id)).toMatchObject({ status: 'answered', answer: 'The budget owner.' })
  expect(getRecord('open_question', q.id)!.answered_at).toMatch(/^\d{4}-/)
  expect(has('mark-answered')).toBe(false)

  await get('reopen').trigger('click')
  expect(getRecord('open_question', q.id)).toMatchObject({
    status: 'open',
    answered_at: null,
    answer: 'The budget owner.',
  })

  await get('mark-answered').trigger('click')
  expect(getRecord('open_question', q.id)).toMatchObject({ status: 'answered', answer: 'The budget owner.' })
  expect(getRecord('open_question', q.id)!.answered_at).toMatch(/^\d{4}-/)
})

test('Make Record is offered on answered questions only', async () => {
  const q = question()
  await open(q)
  expect(has('make-record')).toBe(false)

  await get('mark-answered').trigger('click')
  expect(has('make-record')).toBe(true)

  // The status field and the buttons are two views of the same thing.
  await get('field-status').setValue('open')
  expect(has('make-record')).toBe(false)
})

test('Make Record creates a Record with only its title, answered-by related to the question', async () => {
  const q = question({ status: 'answered', answer: 'Purchase Order: the approved request.' })
  await open(q)

  await get('make-record-type').setValue('acronym')
  await get('make-record-title').setValue('PO')
  await get('make-record').trigger('submit')

  const [po] = listRecords('acronym')
  // Nothing of the question is copied over.
  expect(po).toMatchObject({ title: 'PO', expansion: '', notes: '' })
  const made: RecordRef = { type: 'acronym', id: Number(po.id) }
  expect(hasRelation(q, LABEL.answeredBy, made)).toBe(true)

  // The question's page stays open and shows the new Record.
  expect(current.value).toEqual(q)
  expect(relations()).toEqual([['answered by', ['PO']]])

  await open(made)
  expect(relations()).toEqual([['answers', ['Who approves POs?']]])
})

test('Make Record without a title makes nothing', async () => {
  const q = question({ status: 'answered' })
  await open(q)

  await get('make-record-title').setValue('  ')
  await get('make-record').trigger('submit')

  expect(listRecords('system')).toEqual([])
  expect(relations()).toEqual([])
})

test('a Mention in an answer lists the question under Mentioned in on that Record', async () => {
  const coupa: RecordRef = { type: 'system', id: createRecord('system', 'Coupa') }
  const q = question()
  updateRecord('open_question', q.id, { status: 'answered', answer: 'It is done in [[Coupa]].' })

  await open(coupa)
  expect(get('mentioned-in').text()).toContain('Who approves POs?')
})
