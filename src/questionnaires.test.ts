import { beforeEach, expect, test, vi } from 'vitest'
import { migrate } from './migrations'
import { db } from './notebook'
import {
  addCategory,
  addedQuestionIds,
  addNewItem,
  addQuestions,
  addSet,
  addToSet,
  createQuestion,
  createSet,
  deleteQuestion,
  deleteSet,
  getItem,
  getQuestion,
  getSet,
  moveInSet,
  moveSet,
  questionCategories,
  removeFromSet,
  renameCategory,
  renameSet,
  saveItemsAsSet,
  setSetQuestions,
  isAnswered,
  listItems,
  listQuestions,
  listSets,
  moveItem,
  progress,
  removeItem,
  restoreItem,
  setAnswer,
  updateItem,
  updateQuestion,
  answerText,
  followUp,
  followUpOf,
  takeFollowUpAnswer,
  clearAnswer,
} from './questionnaires'
import { globalSearch } from './global-search'
import { createRecord, deleteRecord, duplicateRecord, getRecord, updateRecord } from './records'
import { slotsOf } from './relation-slots'
import { addToSlot, slotRecords } from './relations'
import { loadSqlite } from './sqlite'
import { undoDelete } from './undo-delete'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const questionnaire = (title = 'Coupa rollout intake') => createRecord('questionnaire', title)
const texts = (id: number) => listItems(id).map((i) => i.text)
const bankQuestion = (text: string) => listQuestions().find((q) => q.text === text)!

test('Questions added from the bank become Items with their own copy of the wording, under the category as section', () => {
  const intake = questionnaire()
  const envs = bankQuestion('Which environments are involved?')
  const users = bankQuestion('How many users?')

  addQuestions(intake, [envs.id, users.id])

  expect(listItems(intake)).toMatchObject([
    {
      text: 'Which environments are involved?',
      answerType: 'multi_choice',
      options: ['Dev', 'Test', 'Acceptance', 'Production'],
      section: 'Dependencies',
      questionId: envs.id,
      answer: null,
      followUpId: null,
    },
    { text: 'How many users?', answerType: 'number', unit: 'users', section: 'Non-functional', questionId: users.id },
  ])
})

test('editing or deleting a bank Question leaves the Items made from it as they were', () => {
  const intake = questionnaire()
  const id = createQuestion({ text: 'Who owns the budget?', category: 'Timeline and budget' })
  addQuestions(intake, [id])

  updateQuestion(id, { text: 'Who signs off the budget?', answerType: 'long_text' })
  expect(listItems(intake)).toMatchObject([{ text: 'Who owns the budget?', answerType: 'short_text' }])

  deleteQuestion(id)
  expect(listItems(intake)).toMatchObject([{ text: 'Who owns the budget?', answerType: 'short_text', questionId: id }])
})

test('a Question already on the Questionnaire is not added twice, from the bank, a category or a set', () => {
  const intake = questionnaire()
  const goal = bankQuestion('What problem does this project solve?')
  addQuestions(intake, [goal.id])

  expect(addQuestions(intake, [goal.id])).toEqual([])
  addCategory(intake, 'Goals and scope')
  addSet(intake, listSets().find((s) => s.name === 'New project intake')!.id)

  expect(texts(intake).filter((t) => t === goal.text)).toHaveLength(1)
  expect(addedQuestionIds(intake).has(goal.id)).toBe(true)
  expect(texts(intake).slice(0, 5)).toEqual([
    'What problem does this project solve?',
    'What does success look like?',
    'What is in scope?',
    'What is explicitly out of scope?',
    'Who asked for this project?',
  ])
})

test('a set adds its Questions in the set order, after the Items already there', () => {
  const access = questionnaire('VPN for the Coupa team')
  addQuestions(access, [bankQuestion('Target go-live date').id])

  addSet(access, listSets().find((s) => s.name === 'Access request')!.id)

  expect(texts(access)).toEqual([
    'Target go-live date',
    'Who needs access, and to which systems?',
    'Which access level is needed?',
    'Does it need VPN or remote access?',
    'Are service accounts or API keys needed?',
    'Who approves the access?',
    'Until when is the access needed?',
  ])
})

test('a question written on the Questionnaire is an Item of its own, and goes to the bank only when asked', () => {
  const intake = questionnaire()

  const own = addNewItem(intake, { text: '  Which plants roll out first? ', answerType: 'multi_choice', options: ['Lyon', ' Graz ', ''] })
  const saved = addNewItem(intake, { text: 'Who runs the cut-over?', category: 'Stakeholders' }, { saveToBank: true })

  expect(listItems(intake)).toMatchObject([
    { id: own, text: 'Which plants roll out first?', options: ['Lyon', 'Graz'], questionId: null, section: '' },
    { id: saved, text: 'Who runs the cut-over?', answerType: 'short_text', section: 'Stakeholders' },
  ])
  const banked = bankQuestion('Who runs the cut-over?')
  expect(banked).toMatchObject({ category: 'Stakeholders', answerType: 'short_text' })
  expect(getItem(saved)!.questionId).toBe(banked.id)
  expect(listQuestions({ search: 'plants' })).toEqual([])
})

test('a question needs a text, and a choice question needs options', () => {
  const intake = questionnaire()

  expect(() => addNewItem(intake, { text: '  ' })).toThrow('The question needs a text')
  expect(() => createQuestion({ text: 'Which ERP?', answerType: 'single_choice', options: [' '] })).toThrow('at least one option')
  expect(listItems(intake)).toEqual([])
})

test("an Item's wording, type, options and section change on this Questionnaire only", () => {
  const intake = questionnaire()
  const access = bankQuestion('Which access level is needed?')
  const [item] = addQuestions(intake, [access.id])

  updateItem(item, { text: 'Which Coupa role does Maria need?', options: ['Requester', 'Approver'], allowOther: false, section: 'Coupa' })

  expect(getItem(item)).toMatchObject({
    text: 'Which Coupa role does Maria need?',
    answerType: 'single_choice',
    options: ['Requester', 'Approver'],
    allowOther: false,
    section: 'Coupa',
  })
  expect(getQuestion(access.id)).toMatchObject({ text: 'Which access level is needed?', options: ['Read only', 'Read and write', 'Admin'] })
  expect(() => updateItem(item, { answerType: 'multi_choice', options: [] })).toThrow('at least one option')
})

test.each([
  ['short_text', { text: 'Coupa' }, { text: '  ' }],
  ['long_text', { text: 'Invoices and POs' }, { text: '' }],
  ['yes_no', { yes: false }, null],
  ['single_choice', { choice: 'Admin' }, { choice: '' }],
  ['single_choice', { choice: '', other: 'Auditor' }, { choice: '', other: ' ' }],
  ['multi_choice', { choices: ['Dev'] }, { choices: [] }],
  ['multi_choice', { choices: [], other: 'Sandbox' }, { choices: [], other: '' }],
  ['number', { number: 0 }, null],
  ['date', { date: '2027-03-01' }, null],
  ['scale', { scale: 4 }, null],
] as const)('a %s answer %j counts as answered, %j does not', (type, answered, unanswered) => {
  expect(isAnswered(answered)).toBe(true)
  expect(isAnswered(unanswered)).toBe(false)
  expect(isAnswered(null)).toBe(false)
  void type
})

test('answers are saved per Item, counted in the progress, and can be cleared', () => {
  const intake = questionnaire()
  const [vpn, users, golive] = addQuestions(intake, [
    bankQuestion('Does it need VPN or remote access?').id,
    bankQuestion('How many users?').id,
    bankQuestion('Target go-live date').id,
  ])
  expect(progress(intake)).toEqual({ answered: 0, total: 3 })

  setAnswer(vpn, { yes: true, comment: 'Only for the Lyon team' })
  setAnswer(users, { number: 120 })
  setAnswer(golive, { date: '2027-03-01' })
  expect(listItems(intake).map((i) => i.answer)).toEqual([{ yes: true, comment: 'Only for the Lyon team' }, { number: 120 }, { date: '2027-03-01' }])
  expect(progress(intake)).toEqual({ answered: 3, total: 3 })

  setAnswer(users, null)
  expect(getItem(users)!.answer).toBeNull()
  expect(progress(intake)).toEqual({ answered: 2, total: 3 })
})

test("an answer that doesn't fit the Item's type is refused", () => {
  const intake = questionnaire()
  const [envs, critical, users, golive] = addQuestions(intake, [
    bankQuestion('Which environments are involved?').id,
    bankQuestion('How critical is this to the business?').id,
    bankQuestion('How many users?').id,
    bankQuestion('Target go-live date').id,
  ])

  expect(() => setAnswer(envs, { text: 'Dev' })).toThrow()
  expect(() => setAnswer(envs, { choices: ['Staging'] })).toThrow('not one of the options')
  expect(() => setAnswer(envs, { choices: [], other: 'Staging' })).toThrow('no "Other"')
  expect(() => setAnswer(critical, { scale: 6 as 5 })).toThrow()
  expect(() => setAnswer(users, { number: Number.NaN })).toThrow()
  expect(() => setAnswer(golive, { date: '1.3.2027' })).toThrow()
  expect(listItems(intake).every((i) => i.answer === null)).toBe(true)
})

test('Items move up and down, and stay put at either end', () => {
  const intake = questionnaire()
  const [a, b, c] = addQuestions(intake, listQuestions().slice(0, 3).map((q) => q.id))
  const order = () => listItems(intake).map((i) => i.id)

  moveItem(c, -1)
  expect(order()).toEqual([a, c, b])
  moveItem(a, -1)
  moveItem(b, 1)
  expect(order()).toEqual([a, c, b])
  moveItem(a, 2)
  expect(order()).toEqual([c, b, a])
})

test('a removed Item comes back in its place, with its answer, through restoreItem', () => {
  const intake = questionnaire()
  const [a, b, c] = addQuestions(intake, listQuestions().slice(0, 3).map((q) => q.id))
  setAnswer(b, { text: 'Faster invoice approval' })

  const removed = removeItem(b)
  expect(listItems(intake).map((i) => i.id)).toEqual([a, c])
  expect(addedQuestionIds(intake).size).toBe(2)

  restoreItem(removed)
  expect(listItems(intake).map((i) => i.id)).toEqual([a, b, c])
  expect(getItem(b)!.answer).toEqual({ text: 'Faster invoice approval' })
})

test('the bank lists by category and searches question and help text, ignoring case', () => {
  expect(questionCategories()).toHaveLength(9)
  expect(listQuestions({ category: 'Access' }).map((q) => q.text)).toContain('Does it need VPN or remote access?')
  expect(listQuestions({ category: 'Access' }).every((q) => q.category === 'Access')).toBe(true)
  expect(listQuestions({ search: 'vpn' }).map((q) => q.text)).toEqual(['Does it need VPN or remote access?'])
  expect(listQuestions({ search: 'MUST-HAVES' }).map((q) => q.text)).toEqual(['What must the solution do?'])

  const id = createQuestion({ text: 'Which cost centre pays?', category: 'Finance' })
  expect(questionCategories().at(-1)).toBe('Finance')
  expect(listQuestions().at(-1)!.id).toBe(id)
})

test('renaming a category renames it on all its Questions, and can merge two categories', () => {
  renameCategory('Non-functional', ' Quality ')
  expect(questionCategories()).toContain('Quality')
  expect(questionCategories()).not.toContain('Non-functional')
  expect(listQuestions({ category: 'Quality' })).toHaveLength(5)

  renameCategory('Quality', 'Risks')
  expect(listQuestions({ category: 'Risks' })).toHaveLength(9)
  expect(() => renameCategory('Risks', '')).toThrow('A category needs a name')
})

test('sets are created, renamed, reordered and deleted, and hold Questions in their own order', () => {
  const [a, b, c] = listQuestions().slice(0, 3).map((q) => q.id)
  const names = () => listSets().map((s) => s.name)

  const kickoff = createSet(' Kick-off ', [c, a])
  expect(getSet(kickoff)).toMatchObject({ name: 'Kick-off', questionIds: [c, a] })
  expect(names().at(-1)).toBe('Kick-off')

  addToSet(kickoff, b)
  addToSet(kickoff, a)
  expect(getSet(kickoff)!.questionIds).toEqual([c, a, b])
  moveInSet(kickoff, b, -2)
  expect(getSet(kickoff)!.questionIds).toEqual([b, c, a])
  removeFromSet(kickoff, c)
  expect(getSet(kickoff)!.questionIds).toEqual([b, a])
  setSetQuestions(kickoff, [a, c, a])
  expect(getSet(kickoff)!.questionIds).toEqual([a, c])

  renameSet(kickoff, 'Kick-off call')
  moveSet(kickoff, -3)
  expect(names()).toEqual(['Kick-off call', 'New project intake', 'Access request', 'Integration / dependency check'])
  expect(() => renameSet(kickoff, ' ')).toThrow('A Question set needs a name')

  deleteSet(kickoff)
  expect(names()).toEqual(['New project intake', 'Access request', 'Integration / dependency check'])
  expect(getQuestion(a)).not.toBeNull()
})

test('deleting a Question takes it out of its sets', () => {
  const vpn = bankQuestion('Does it need VPN or remote access?')
  const access = listSets().find((s) => s.name === 'Access request')!

  deleteQuestion(vpn.id)

  expect(getSet(access.id)!.questionIds).toHaveLength(5)
  expect(getSet(access.id)!.questionIds).not.toContain(vpn.id)
  expect(getQuestion(vpn.id)).toBeNull()
})

test("a Questionnaire's Items are saved as a new set, putting its own questions in the bank on the way", () => {
  const intake = questionnaire()
  const users = bankQuestion('How many users?')
  addQuestions(intake, [users.id])
  const own = addNewItem(intake, { text: 'Which plants go first?' })
  updateItem(addQuestions(intake, [bankQuestion('Target go-live date').id])[0], { text: 'When does Lyon go live?' })

  const id = saveItemsAsSet(intake, 'Plant rollout')

  const saved = getSet(id)!
  expect(saved.name).toBe('Plant rollout')
  expect(saved.questionIds.map((q) => getQuestion(q)!.text)).toEqual(['How many users?', 'Which plants go first?', 'Target go-live date'])
  expect(getItem(own)!.questionId).toBe(saved.questionIds[1])
})

test('duplicating a Questionnaire copies its Items without answers or follow-ups, and starts as a draft', () => {
  const intake = questionnaire()
  updateRecord('questionnaire', intake, { status: 'done' })
  const [vpn, users] = addQuestions(intake, [bankQuestion('Does it need VPN or remote access?').id, bankQuestion('How many users?').id])
  updateItem(users, { section: 'Size' })
  setAnswer(vpn, { yes: true })
  followUp(users)

  const copy = duplicateRecord('questionnaire', intake)

  expect(getRecord('questionnaire', copy)).toMatchObject({ title: 'Coupa rollout intake copy', status: 'draft' })
  expect(listItems(copy)).toMatchObject([
    { text: 'Does it need VPN or remote access?', answer: null, followUpId: null, section: 'Access' },
    { text: 'How many users?', answer: null, followUpId: null, section: 'Size', unit: 'users' },
  ])
  expect(listItems(intake).map((i) => i.answer)).toEqual([{ yes: true }, null])
})

test("deleting a Questionnaire deletes its Items, and Undo delete brings them back with their answers", () => {
  const intake = questionnaire()
  const other = questionnaire('Access check')
  const [vpn, users] = addQuestions(intake, [bankQuestion('Does it need VPN or remote access?').id, bankQuestion('How many users?').id])
  addQuestions(other, [bankQuestion('How many users?').id])
  setAnswer(users, { number: 40 })

  deleteRecord('questionnaire', intake)
  expect(listItems(intake)).toEqual([])
  expect(listItems(other)).toHaveLength(1)

  expect(undoDelete()).toEqual({ type: 'questionnaire', id: intake })
  expect(listItems(intake).map((i) => [i.id, i.answer])).toEqual([
    [vpn, null],
    [users, { number: 40 }],
  ])
})

test("following up an Item asks its Respondents an Open question that mentions the Questionnaire", () => {
  const intake = questionnaire()
  const project = createRecord('project', 'Coupa rollout')
  const maria = createRecord('person', 'Maria Lopez')
  const stefan = createRecord('person', 'Stefan Brandt')
  const [slot, respondents] = slotsOf('questionnaire')
  addToSlot(slot, intake, { type: 'project', id: project })
  addToSlot(respondents, intake, { type: 'person', id: maria })
  addToSlot(respondents, intake, { type: 'person', id: stefan })
  const [item] = addQuestions(intake, [bankQuestion('What does success look like?').id])

  const asked = followUp(item)

  expect(getRecord('open_question', asked)).toMatchObject({
    title: 'What does success look like?',
    status: 'open',
    notes: 'From [[Coupa rollout intake]]\n\nHow will we know the project worked?',
  })
  expect(slotRecords(slotsOf('open_question')[0], asked).map((p) => p.title)).toEqual(['Maria Lopez', 'Stefan Brandt'])
  expect(getItem(item)!.followUpId).toBe(asked)
  expect(followUpOf(getItem(item)!)).toMatchObject({ id: asked, title: 'What does success look like?', status: 'open', answer: null })
  expect(() => followUp(item)).toThrow('already followed up')
})

test("an answered Open question's answer fills in a text Item once, and only shows for the other types", () => {
  const intake = questionnaire()
  const [success, vpn] = addQuestions(intake, [bankQuestion('What does success look like?').id, bankQuestion('Does it need VPN or remote access?').id])
  const asked = [followUp(success), followUp(vpn)]
  expect(takeFollowUpAnswer(success)).toBe(false)

  for (const id of asked) updateRecord('open_question', id, { status: 'answered', answer: 'Invoices approved in two days' })

  expect(followUpOf(getItem(vpn)!)).toMatchObject({ status: 'answered', answer: 'Invoices approved in two days' })
  expect(takeFollowUpAnswer(vpn)).toBe(false)
  expect(getItem(vpn)!.answer).toBeNull()
  expect(takeFollowUpAnswer(success)).toBe(true)
  expect(getItem(success)!.answer).toEqual({ text: 'Invoices approved in two days' })

  setAnswer(success, { text: 'Two days, and no paper' })
  expect(takeFollowUpAnswer(success)).toBe(false)
  expect(getItem(success)!.answer).toEqual({ text: 'Two days, and no paper' })

  // Once taken, a cleared answer stays cleared.
  clearAnswer(success)
  expect(takeFollowUpAnswer(success)).toBe(false)
  expect(getItem(success)!.answer).toBeNull()
})

test('a new follow-up, after the first was deleted, fills in the text Item again', () => {
  const intake = questionnaire()
  const [success] = addQuestions(intake, [bankQuestion('What does success look like?').id])
  const first = followUp(success)
  updateRecord('open_question', first, { status: 'answered', answer: 'Faster invoices' })
  expect(takeFollowUpAnswer(success)).toBe(true)
  clearAnswer(success)
  deleteRecord('open_question', first)

  const second = followUp(success)
  updateRecord('open_question', second, { status: 'answered', answer: 'No paper' })

  expect(takeFollowUpAnswer(success)).toBe(true)
  expect(getItem(success)!.answer).toEqual({ text: 'No paper' })
})

test('an answered Item, or one whose follow-up was deleted, says so', () => {
  const intake = questionnaire()
  const [users] = addQuestions(intake, [bankQuestion('How many users?').id])
  setAnswer(users, { number: 3 })
  expect(() => followUp(users)).toThrow('already answered')

  setAnswer(users, null)
  const asked = followUp(users)
  deleteRecord('open_question', asked)
  expect(followUpOf(getItem(users)!)).toBeNull()
  // The Open question is gone, so the Item can be followed up again.
  expect(followUp(users)).not.toBe(asked)
})

test("global search finds a Questionnaire by an Item's question or answer", () => {
  const intake = questionnaire()
  const [vpn, access] = addQuestions(intake, [
    bankQuestion('Does it need VPN or remote access?').id,
    bankQuestion('Who needs access, and to which systems?').id,
  ])
  setAnswer(vpn, { yes: true, comment: 'Cisco AnyConnect' })
  setAnswer(access, { text: 'The Lyon buyers need SAP' })

  expect(globalSearch('remote access')).toMatchObject([{ type: 'questionnaire', id: intake, where: 'Question' }])
  expect(globalSearch('anyconnect')).toMatchObject([{ type: 'questionnaire', id: intake, where: 'Answer' }])
  expect(globalSearch('lyon buyers')).toMatchObject([{ type: 'questionnaire', id: intake, where: 'Answer' }])

  // A later edit: search re-reads a Questionnaire whose updated_at moved.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 1000)
  setAnswer(access, { text: 'Only Graz' })
  vi.useRealTimers()
  expect(globalSearch('lyon buyers')).toEqual([])
})

test.each([
  [{ text: 'Coupa' }, 'Coupa'],
  [{ yes: true, comment: 'with MFA' }, 'Yes, with MFA'],
  [{ yes: false }, 'No'],
  [{ choice: 'Admin' }, 'Admin'],
  [{ choice: '', other: 'Auditor' }, 'Auditor'],
  [{ choices: ['Dev', 'Test'], other: 'Sandbox' }, 'Dev, Test, Sandbox'],
  [{ number: 1200 }, '1200'],
  [{ date: '2027-03-01' }, '2027-03-01'],
  [{ scale: 4 }, '4'],
  [null, ''],
] as const)('the answer %j reads as %j', (answer, text) => {
  expect(answerText(answer)).toBe(text)
})

test('every change to the Items touches the Questionnaire', () => {
  const intake = questionnaire()
  db.value!.run("update questionnaire set updated_at = '2020-01-01T00:00:00.000Z'")

  addQuestions(intake, [bankQuestion('How many users?').id])

  expect(getRecord('questionnaire', intake)!.updated_at.slice(0, 4)).not.toBe('2020')
})

test('deleting a follow-up Open question unlinks its Item, and Undo delete links it again', () => {
  const intake = questionnaire()
  const [users] = addQuestions(intake, [bankQuestion('How many users?').id])
  const asked = followUp(users)

  deleteRecord('open_question', asked)
  expect(getItem(users)!.followUpId).toBeNull()

  expect(undoDelete()).toEqual({ type: 'open_question', id: asked })
  expect(getItem(users)!.followUpId).toBe(asked)
  expect(followUpOf(getItem(users)!)).toMatchObject({ id: asked, status: 'open' })
})
