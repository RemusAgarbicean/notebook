import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { addQuestions, listItems, listQuestions, setAnswer } from './questionnaires'
import { createRecord, type RecordRef } from './records'
import { memoryFolder, memoryStorage } from './storage-memory'

// Seam 1 for the Questionnaire page: building it from the bank and answering it, through the App.
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
const make = (title: string): RecordRef => ({ type: 'questionnaire', id: createRecord('questionnaire', title) })
const open = async (r: RecordRef) => {
  openRecord(r.type, r.id)
  await flushPromises()
}
const bank = (...texts: string[]) => texts.map((t) => listQuestions().find((q) => q.text === t)!.id)
const itemTexts = () => all('questionnaire-item').map((i) => i.get('[data-testid="item-text"]').text())
const pickerRow = (text: string) => all('picker-question').find((r) => r.text().includes(text))!

test('the picker searches the bank, filters by category, marks what is already added and adds a Question once', async () => {
  const intake = make('Coupa rollout intake')
  addQuestions(intake.id, bank('Does it need VPN or remote access?'))
  await open(intake)

  await get('add-questions').trigger('click')
  expect(get('question-picker').attributes('role')).toBe('dialog')

  await get('picker-category').setValue('Access')
  expect(all('picker-question').length).toBe(6)
  await get('picker-search').setValue('vpn')
  expect(all('picker-question').map((r) => r.get('[data-testid="picker-question-text"]').text())).toEqual([
    'Does it need VPN or remote access?',
  ])
  expect(pickerRow('VPN').get('[data-testid="picker-add"]').attributes('disabled')).toBeDefined()
  expect(pickerRow('VPN').text()).toContain('Added')

  await get('picker-search').setValue('')
  await pickerRow('Which access level is needed?').get('[data-testid="picker-add"]').trigger('click')
  expect(pickerRow('Which access level is needed?').text()).toContain('Added')

  await get('close-picker').trigger('click')
  expect(app.find('[data-testid="question-picker"]').exists()).toBe(false)
  expect(itemTexts()).toEqual(['Does it need VPN or remote access?', 'Which access level is needed?'])
  expect(get('questionnaire-progress').text()).toBe('0 of 2 answered')
  expect(listItems(intake.id).length).toBe(2)
})

test('the picker adds a whole category, then a Question set, without adding a Question twice', async () => {
  const check = make('Access check')
  await open(check)
  await get('add-questions').trigger('click')

  await get('picker-category').setValue('Access')
  await get('picker-add-category').trigger('click')
  expect(get('picker-add-category').attributes('disabled')).toBeDefined()

  const setButton = (name: string) => all('picker-add-set').find((b) => b.text().includes(name))!
  expect(setButton('Access request').attributes('disabled')).toBeDefined()
  await setButton('Integration / dependency check').trigger('click')
  expect(setButton('Integration / dependency check').attributes('disabled')).toBeDefined()
  await get('close-picker').trigger('click')

  const texts = itemTexts()
  expect(texts.length).toBe(new Set(texts).size)
  expect(texts.slice(0, 6)).toEqual(listQuestions({ category: 'Access' }).map((q) => q.text))
  expect(texts).toContain('Which environments are involved?')
  expect(all('item-section').map((s) => s.text())).toContain('Dependencies')
  expect(all('item-section')[0].text()).toBe('Access')
})

const ALL_TYPES = [
  'Who is the project sponsor?',
  'What problem does this project solve?',
  'Does it need VPN or remote access?',
  'Which access level is needed?',
  'How do the systems connect?',
  'How much data is involved?',
  'Target go-live date',
  'How critical is this to the business?',
]
const item = (text: string) => all('questionnaire-item').find((i) => i.get('[data-testid="item-text"]').text() === text)!
const answers = (id: number) => listItems(id).map((i) => i.answer)

test('every Answer type is answered with its own control, saved as it is typed or clicked, and labelled with its question', async () => {
  const intake = make('Coupa rollout intake')
  addQuestions(intake.id, bank(...ALL_TYPES))
  await open(intake)

  const sponsor = item('Who is the project sponsor?').get('[data-testid="answer-text"]')
  expect(sponsor.attributes('aria-label')).toBe('Who is the project sponsor?')
  await sponsor.setValue('Marie Curie')

  const problem = item('What problem does this project solve?')
  await problem.get('textarea[aria-label="Answer to What problem does this project solve?"]').setValue('Invoices are **slow**')

  const vpn = item('Does it need VPN or remote access?')
  expect(vpn.get('[role="radiogroup"]').attributes('aria-label')).toBe('Does it need VPN or remote access?')
  await vpn.get('[data-testid="answer-yes"]').setValue(true)
  await vpn.get('textarea[aria-label="Comment on Does it need VPN or remote access?"]').setValue('Lyon only')

  const level = item('Which access level is needed?')
  await level.findAll('[data-testid="answer-option"]')[1].setValue(true)
  expect(answers(intake.id)[3]).toEqual({ choice: 'Read and write' })
  await level.get('[data-testid="answer-other-text"]').setValue('Auditor')
  expect((level.get('[data-testid="answer-other"]').element as HTMLInputElement).checked).toBe(true)

  const connect = item('How do the systems connect?')
  await connect.findAll('[data-testid="answer-option"]')[0].setValue(true)
  await connect.findAll('[data-testid="answer-option"]')[3].setValue(true)
  await connect.get('[data-testid="answer-other-text"]').setValue('Message queue')

  const data = item('How much data is involved?')
  expect(data.text()).toContain('GB')
  await data.get('[data-testid="answer-number"]').setValue('120')

  await item('Target go-live date').get('[data-testid="answer-date"]').setValue('2027-03-01')

  const critical = item('How critical is this to the business?')
  expect(critical.text()).toContain('Low')
  expect(critical.text()).toContain('High')
  await critical.findAll('[data-testid="answer-scale"]')[3].setValue(true)

  expect(answers(intake.id)).toEqual([
    { text: 'Marie Curie' },
    { text: 'Invoices are **slow**' },
    { yes: true, comment: 'Lyon only' },
    { choice: '', other: 'Auditor' },
    { choices: ['API', 'Manual'], other: 'Message queue' },
    { number: 120 },
    { date: '2027-03-01' },
    { scale: 4 },
  ])
  expect(get('questionnaire-progress').text()).toBe('8 of 8 answered')
})

test('any answer can be cleared, and clearing it counts it as unanswered again', async () => {
  const intake = make('Coupa rollout intake')
  addQuestions(intake.id, bank(...ALL_TYPES))
  await open(intake)
  await item('Does it need VPN or remote access?').get('[data-testid="answer-no"]').setValue(true)
  await item('How much data is involved?').get('[data-testid="answer-number"]').setValue('5')
  await item('How critical is this to the business?').findAll('[data-testid="answer-scale"]')[0].setValue(true)
  expect(get('questionnaire-progress').text()).toBe('3 of 8 answered')
  expect(item('Who is the project sponsor?').find('[data-testid="answer-clear"]').exists()).toBe(false)

  for (const text of ['Does it need VPN or remote access?', 'How much data is involved?', 'How critical is this to the business?']) {
    const clear = item(text).get('[data-testid="answer-clear"]')
    expect(clear.attributes('aria-label')).toBe(`Clear the answer to ${text}`)
    await clear.trigger('click')
  }

  expect(answers(intake.id)).toEqual(ALL_TYPES.map(() => null))
  expect(get('questionnaire-progress').text()).toBe('0 of 8 answered')
  expect((item('How much data is involved?').get('[data-testid="answer-number"]').element as HTMLInputElement).value).toBe('')
  expect((item('Does it need VPN or remote access?').get('[data-testid="answer-no"]').element as HTMLInputElement).checked).toBe(false)
})

test('Unanswered only shows the gaps, and keeps an Item being answered in view until the filter is turned on again', async () => {
  const intake = make('Coupa rollout intake')
  const [, vpn] = addQuestions(intake.id, bank('Who is the project sponsor?', 'Does it need VPN or remote access?', 'How many users?'))
  setAnswer(vpn, { yes: true })
  await open(intake)

  await get('unanswered-only').setValue(true)
  expect(itemTexts()).toEqual(['Who is the project sponsor?', 'How many users?'])
  expect(all('item-section').map((s) => s.text())).toEqual(['Stakeholders', 'Non-functional'])

  await item('Who is the project sponsor?').get('[data-testid="answer-text"]').setValue('M')
  await item('Who is the project sponsor?').get('[data-testid="answer-text"]').setValue('Marie')
  expect(itemTexts()).toEqual(['Who is the project sponsor?', 'How many users?'])
  expect(get('questionnaire-progress').text()).toBe('2 of 3 answered')

  await get('unanswered-only').setValue(false)
  await get('unanswered-only').setValue(true)
  expect(itemTexts()).toEqual(['How many users?'])

  setAnswer(listItems(intake.id)[2].id, { number: 40 })
  await flushPromises()
  expect(all('questionnaire-item')).toEqual([])
  expect(get('items-empty').text()).toBe('Every Item is answered.')
})

test('Items move up and down with their buttons and with Alt+Arrow keys, keeping the focus on the moved Item', async () => {
  const intake = make('Coupa rollout intake')
  addQuestions(intake.id, bank('Who is the project sponsor?', 'Does it need VPN or remote access?', 'How many users?'))
  await open(intake)

  await item('How many users?').get('[data-testid="item-move-up"]').trigger('click')
  expect(itemTexts()).toEqual(['Who is the project sponsor?', 'How many users?', 'Does it need VPN or remote access?'])
  expect(item('Who is the project sponsor?').get('[data-testid="item-move-up"]').attributes('disabled')).toBeDefined()

  const handle = item('Who is the project sponsor?').get('[data-testid="item-move-down"]')
  expect(handle.attributes('aria-label')).toBe('Move down: Who is the project sponsor?')
  ;(handle.element as HTMLElement).focus()
  await handle.trigger('keydown', { key: 'ArrowDown', altKey: true })
  await flushPromises()
  expect(itemTexts()).toEqual(['How many users?', 'Who is the project sponsor?', 'Does it need VPN or remote access?'])
  expect(item('Who is the project sponsor?').element.contains(document.activeElement)).toBe(true)

  await item('Who is the project sponsor?').get('[data-testid="answer-text"]').trigger('keydown', { key: 'ArrowUp', altKey: true })
  await flushPromises()
  expect(itemTexts()[0]).toBe('Who is the project sponsor?')
})

test('removing an Item can be undone, putting it back in its place with its answer', async () => {
  const intake = make('Coupa rollout intake')
  const [, vpn] = addQuestions(intake.id, bank('Who is the project sponsor?', 'Does it need VPN or remote access?', 'How many users?'))
  setAnswer(vpn, { yes: false, comment: 'Not needed' })
  await open(intake)

  await item('Does it need VPN or remote access?').get('[data-testid="item-remove"]').trigger('click')
  expect(itemTexts()).toEqual(['Who is the project sponsor?', 'How many users?'])
  expect(get('item-removed').text()).toContain('Removed "Does it need VPN or remote access?"')
  expect(get('questionnaire-progress').text()).toBe('0 of 2 answered')

  await get('undo-remove').trigger('click')
  expect(itemTexts()).toEqual(['Who is the project sponsor?', 'Does it need VPN or remote access?', 'How many users?'])
  expect(listItems(intake.id)[1].answer).toEqual({ yes: false, comment: 'Not needed' })
  expect(app.find('[data-testid="item-removed"]').exists()).toBe(false)
})

test("editing an Item changes its wording, type, options and section on this Questionnaire only, not in the bank", async () => {
  const intake = make('Coupa rollout intake')
  addQuestions(intake.id, bank('Who is the project sponsor?', 'How many users?'))
  await open(intake)

  await item('Who is the project sponsor?').get('[data-testid="item-edit"]').trigger('click')
  const editor = get('item-editor')
  expect((editor.get('[data-testid="editor-text"]').element as HTMLInputElement).value).toBe('Who is the project sponsor?')
  await editor.get('[data-testid="editor-text"]').setValue('Which sponsor team?')
  await editor.get('[data-testid="editor-help"]').setValue('Pick the budget owner.')
  await editor.get('[data-testid="editor-type"]').setValue('single_choice')
  await editor.get('[data-testid="editor-options"]').setValue('Finance\nIT\n\nOperations')
  await editor.get('[data-testid="editor-allow-other"]').setValue(true)
  await editor.get('[data-testid="editor-section"]').setValue('Sponsors')
  await editor.trigger('submit')

  expect(app.find('[data-testid="item-editor"]').exists()).toBe(false)
  expect(itemTexts()).toEqual(['Which sponsor team?', 'How many users?'])
  expect(item('Which sponsor team?').text()).toContain('Pick the budget owner.')
  expect(item('Which sponsor team?').findAll('[data-testid="answer-option"]').map((o) => o.attributes('value'))).toEqual([
    'Finance',
    'IT',
    'Operations',
  ])
  expect(item('Which sponsor team?').find('[data-testid="answer-other"]').exists()).toBe(true)
  expect(all('item-section').map((s) => s.text())).toEqual(['Sponsors', 'Non-functional'])
  expect(listQuestions().some((q) => q.text === 'Who is the project sponsor?')).toBe(true)
  expect(listQuestions().some((q) => q.text === 'Which sponsor team?')).toBe(false)

  await item('How many users?').get('[data-testid="item-edit"]').trigger('click')
  await get('editor-text').setValue('  ')
  await get('item-editor').trigger('submit')
  expect(get('item-editor').get('[role="alert"]').text()).toBe('The question needs a text')
  await get('editor-cancel').trigger('click')
  expect(itemTexts()).toEqual(['Which sponsor team?', 'How many users?'])
})

test('a new question written on the Questionnaire is added at the end, and with Save to bank it is in the bank too', async () => {
  const intake = make('Coupa rollout intake')
  addQuestions(intake.id, bank('How many users?'))
  await open(intake)

  await get('new-question').trigger('click')
  expect((get('editor-section').element as HTMLInputElement).value).toBe('Non-functional')
  await get('editor-text').setValue('Which browsers must it support?')
  await get('editor-type').setValue('multi_choice')
  await get('editor-options').setValue('Edge\nChrome\nFirefox')
  await get('editor-section').setValue('Clients')
  await get('editor-save-to-bank').setValue(true)
  await get('item-editor').trigger('submit')

  await get('new-question').trigger('click')
  await get('editor-text').setValue('How many offices?')
  await get('editor-type').setValue('number')
  await get('editor-unit').setValue('offices')
  await get('item-editor').trigger('submit')

  expect(itemTexts()).toEqual(['How many users?', 'Which browsers must it support?', 'How many offices?'])
  expect(item('How many offices?').text()).toContain('offices')
  expect(all('item-section').map((s) => s.text())).toEqual(['Non-functional', 'Clients'])
  const saved = listQuestions({ search: 'browsers' })
  expect(saved.map((q) => [q.text, q.category, q.options])).toEqual([['Which browsers must it support?', 'Clients', ['Edge', 'Chrome', 'Firefox']]])
  expect(listQuestions({ search: 'offices' })).toEqual([])
})
