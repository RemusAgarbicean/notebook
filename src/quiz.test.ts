import { beforeEach, expect, test } from 'vitest'
import { migrate } from './migrations'
import { db } from './notebook'
import { answerCard, quizCards, quizProgress, startQuiz, type QuizCard } from './quiz'
import { createRecord } from './records'
import { loadSqlite } from './sqlite'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const card = (title: string): QuizCard => ({ id: title.length, title, expansion: `${title} in full`, notes: '' })
const titles = (q: { queue: QuizCard[] }) => q.queue.map((c) => c.title)

test('only Acronyms with an expansion are asked', () => {
  createRecord('acronym', 'PO', { expansion: 'Purchase order', notes: 'A buyer sends it' })
  createRecord('acronym', 'TBD')

  expect(quizCards()).toEqual([{ id: 1, title: 'PO', expansion: 'Purchase order', notes: 'A buyer sends it' }])
})

test('a quiz asks every card once, in a shuffled order', () => {
  const cards = ['PO', 'GRN', 'RFQ', 'S2P'].map(card)

  const quiz = startQuiz(cards, () => 0)

  expect(quiz.total).toBe(4)
  expect(titles(quiz)).not.toEqual(['PO', 'GRN', 'RFQ', 'S2P'])
  expect(titles(quiz).sort()).toEqual(['GRN', 'PO', 'RFQ', 'S2P'])
  expect(cards.map((c) => c.title)).toEqual(['PO', 'GRN', 'RFQ', 'S2P'])
})

test('a known card is done; one that was not known comes back after the others', () => {
  let quiz = { queue: ['PO', 'GRN', 'RFQ'].map(card), total: 3 }
  expect(quizProgress(quiz)).toBe('0 of 3 known · 3 to go')

  quiz = answerCard(quiz, false)
  expect(titles(quiz)).toEqual(['GRN', 'RFQ', 'PO'])
  expect(quizProgress(quiz)).toBe('0 of 3 known · 3 to go')

  quiz = answerCard(quiz, true)
  quiz = answerCard(quiz, true)
  expect(titles(quiz)).toEqual(['PO'])
  expect(quizProgress(quiz)).toBe('2 of 3 known · 1 to go')

  quiz = answerCard(answerCard(quiz, false), true)
  expect(titles(quiz)).toEqual([])
  expect(quizProgress(quiz)).toBe('3 of 3 known')
  expect(answerCard(quiz, true)).toEqual({ queue: [], total: 3 })
})
