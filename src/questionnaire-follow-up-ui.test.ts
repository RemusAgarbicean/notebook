import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, list, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { addQuestions, listItems, listQuestions, setAnswer } from './questionnaires'
import { createRecord, getRecord, type RecordRef } from './records'
import { slotsOf } from './relation-slots'
import { addToSlot } from './relations'
import { memoryFolder, memoryStorage } from './storage-memory'

// Seam 1 for Follow up: an unanswered Item becomes an Open question in the Today strip's Ask column, and its answer comes back.
let app: VueWrapper

beforeEach(async () => {
  closeNotebook()
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: memoryStorage(async () => folder) },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
})
afterEach(() => app.unmount())

const SUCCESS = 'What does success look like?'
const VPN = 'Does it need VPN or remote access?'

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const all = (id: string) => app.findAll(`[data-testid="${id}"]`)
const open = async (r: RecordRef) => {
  openRecord(r.type, r.id)
  await flushPromises()
}
const bank = (...texts: string[]) => texts.map((t) => listQuestions().find((q) => q.text === t)!.id)
const item = (text: string) => all('questionnaire-item').find((i) => i.get('[data-testid="item-text"]').text() === text)!
const in_ = (w: ReturnType<typeof item>, id: string) => w.find(`[data-testid="${id}"]`)

// A Questionnaire asked of Maria, with a long text and a Yes/No Item.
function intake(): RecordRef {
  const id = createRecord('questionnaire', 'Coupa rollout intake')
  const respondents = slotsOf('questionnaire').find((s) => s.name === 'Respondents')!
  addToSlot(respondents, id, { type: 'person', id: createRecord('person', 'Maria Lopez') })
  addQuestions(id, bank(SUCCESS, VPN))
  return { type: 'questionnaire', id }
}

async function answerOnTodayStrip(question: string, answer: string) {
  list.value = 'home'
  current.value = null
  await flushPromises()
  const group = all('today-ask-group').find((g) => g.text().includes('Maria Lopez'))!
  await group.findAll('[data-testid="today-ask"]').find((b) => b.text().includes(question))!.trigger('click')
  await flushPromises()
  await get('field-answer').get('textarea').setValue(answer)
  await get('mark-answered').trigger('click')
  await flushPromises()
}

test('Follow up asks the Respondents in the Ask column, and the answer fills in the text Item', async () => {
  const q = intake()
  await open(q)

  await in_(item(SUCCESS), 'item-follow-up').trigger('click')
  await flushPromises()

  expect(in_(item(SUCCESS), 'item-follow-up').exists()).toBe(false)
  expect(in_(item(SUCCESS), 'item-following-up').text()).toBe(`Following up: ${SUCCESS}`)
  expect(in_(item(VPN), 'item-follow-up').attributes('aria-label')).toBe(`Follow up: ${VPN}`)

  // The Item links to its Open question, whose notes mention the Questionnaire.
  await in_(item(SUCCESS), 'item-following-up').get('button').trigger('click')
  await flushPromises()
  expect(current.value).toMatchObject({ type: 'open_question' })
  expect(getRecord('open_question', current.value!.id)!.notes).toContain('[[Coupa rollout intake]]')

  await answerOnTodayStrip(SUCCESS, 'Invoices approved in two days')

  await open(q)
  expect(item(SUCCESS).get(`textarea[aria-label="Answer to ${SUCCESS}"]`).element).toHaveProperty(
    'value',
    'Invoices approved in two days',
  )
  expect(listItems(q.id).find((i) => i.text === SUCCESS)!.answer).toEqual({ text: 'Invoices approved in two days' })
  expect(in_(item(SUCCESS), 'item-following-up').exists()).toBe(false)
  // The taken answer still links to its Open question.
  expect(in_(item(SUCCESS), 'item-follow-up-from').text()).toBe(`From follow-up: ${SUCCESS}`)
  await in_(item(SUCCESS), 'item-follow-up-from').get('button').trigger('click')
  await flushPromises()
  expect(current.value).toMatchObject({ type: 'open_question' })
  expect(getRecord('open_question', current.value!.id)!.title).toBe(SUCCESS)
  await open(q)

  // Taken once: a cleared answer stays cleared, and the follow-up's answer shows as a hint.
  await in_(item(SUCCESS), 'answer-clear').trigger('click')
  await flushPromises()
  expect(listItems(q.id).find((i) => i.text === SUCCESS)!.answer).toBeNull()
  expect(in_(item(SUCCESS), 'item-follow-up-answer').text()).toContain('Invoices approved in two days')
})

test('a Yes/No Item shows its follow-up answer as a hint and stays unanswered', async () => {
  const q = intake()
  await open(q)
  await in_(item(VPN), 'item-follow-up').trigger('click')
  await flushPromises()

  await answerOnTodayStrip(VPN, 'Only for the Lyon office')

  await open(q)
  expect(in_(item(VPN), 'item-follow-up-answer').text()).toContain('Only for the Lyon office')
  expect(listItems(q.id).find((i) => i.text === VPN)!.answer).toBeNull()
})

test('with no Respondents, Follow up says the question goes to No one to ask, and notes it once created', async () => {
  const id = createRecord('questionnaire', 'Supplier intake')
  addQuestions(id, bank(SUCCESS))
  await open({ type: 'questionnaire', id })

  expect(in_(item(SUCCESS), 'item-follow-up').attributes('title')).toContain('No one to ask')
  expect(in_(item(SUCCESS), 'item-asked-of-no-one').exists()).toBe(false)

  await in_(item(SUCCESS), 'item-follow-up').trigger('click')
  await flushPromises()

  expect(in_(item(SUCCESS), 'item-following-up').text()).toBe(`Following up: ${SUCCESS}`)
  expect(in_(item(SUCCESS), 'item-asked-of-no-one').text()).toBe('Asked of no one; add Respondents to group it under a Person.')
})

test('with Respondents, Follow up names them and adds no note', async () => {
  const q = intake()
  await open(q)

  expect(in_(item(SUCCESS), 'item-follow-up').attributes('title')).toContain('Maria Lopez')
  await in_(item(SUCCESS), 'item-follow-up').trigger('click')
  await flushPromises()
  expect(in_(item(SUCCESS), 'item-asked-of-no-one').exists()).toBe(false)
})

test('an answered Item has no Follow up button', async () => {
  const q = intake()
  setAnswer(listItems(q.id).find((i) => i.text === VPN)!.id, { yes: true })
  await open(q)
  expect(in_(item(VPN), 'item-follow-up').exists()).toBe(false)
  expect(in_(item(SUCCESS), 'item-follow-up').exists()).toBe(true)
})
