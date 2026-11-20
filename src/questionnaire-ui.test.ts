import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, list, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { addQuestions, listQuestions, setAnswer } from './questionnaires'
import { createRecord, updateRecord, type RecordRef } from './records'
import { LABEL, slotsOf } from './relation-slots'
import { addRelation, addToSlot } from './relations'
import { memoryFolder, memoryStorage } from './storage-memory'

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

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const all = (id: string) => app.findAll(`[data-testid="${id}"]`)
const make = (type: RecordRef['type'], title: string, fields = {}): RecordRef => ({ type, id: createRecord(type, title, fields) })
const open = async (r: RecordRef) => {
  openRecord(r.type, r.id)
  await flushPromises()
}
const bank = (...texts: string[]) => texts.map((t) => listQuestions().find((q) => q.text === t)!.id)

test('a Questionnaire page shows its status and its Items in order, with their answers, read-only', async () => {
  const intake = make('questionnaire', 'Coupa rollout intake')
  const [vpn] = addQuestions(intake.id, bank('Does it need VPN or remote access?', 'How many users?', 'Which environments are involved?'))
  setAnswer(vpn, { yes: true, comment: 'Lyon only' })

  await open(intake)

  expect((get('field-status').element as HTMLSelectElement).value).toBe('draft')
  expect(get('questionnaire-progress').text()).toBe('1 of 3 answered')
  expect(all('questionnaire-item').map((i) => i.get('[data-testid="item-text"]').text())).toEqual([
    'Does it need VPN or remote access?',
    'How many users?',
    'Which environments are involved?',
  ])
  expect(all('questionnaire-item').map((i) => i.get('[data-testid="item-answer"]').text())).toEqual([
    'Yes, Lyon only',
    'Not answered',
    'Not answered',
  ])
  expect(all('item-section').map((s) => s.text())).toEqual(['Access', 'Non-functional', 'Dependencies'])
})

test('the Questionnaires list shows each one\'s status and how much is answered', async () => {
  const intake = make('questionnaire', 'Coupa rollout intake')
  make('questionnaire', 'Access check')
  updateRecord('questionnaire', intake.id, { status: 'in progress' })
  const [vpn] = addQuestions(intake.id, bank('Does it need VPN or remote access?', 'How many users?'))
  setAnswer(vpn, { yes: false })

  list.value = 'questionnaire'
  await flushPromises()

  expect(all('list-row').map((r) => r.text())).toEqual(['Access checkdraft · 0 of 0 answered', 'Coupa rollout intakein progress · 1 of 2 answered'])
})

test("a Project page lists its Questionnaires, which open from there and don't repeat under Relations", async () => {
  const rollout = make('project', 'Coupa rollout')
  const intake = make('questionnaire', 'Coupa rollout intake')
  const access = make('questionnaire', 'Access check')
  make('questionnaire', 'Elsewhere')
  addToSlot(slotsOf('questionnaire')[0], intake.id, rollout)
  addRelation(access, LABEL.partOf, rollout)

  await open(rollout)

  expect(all('project-questionnaire').map((q) => q.text())).toEqual(['Access check', 'Coupa rollout intake'])
  expect(all('relation')).toEqual([])
  await all('project-questionnaire')[1].trigger('click')
  expect(current.value).toEqual({ type: 'questionnaire', id: intake.id })
})
