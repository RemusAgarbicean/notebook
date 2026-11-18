import { expect, test } from 'vitest'
import { dueState, dueText, parseQuickTask, pushDate } from './due'

const NOW = '2026-11-11'

test('a due date in the past is overdue, today is due today, later or none is neither', () => {
  expect(dueState('2026-11-10', false, NOW)).toBe('overdue')
  expect(dueState('2025-12-31', 0, NOW)).toBe('overdue')
  expect(dueState('2026-11-11', false, NOW)).toBe('today')
  expect(dueState('2026-11-12', false, NOW)).toBeNull()
  expect(dueState(null, false, NOW)).toBeNull()
})

test('a done Task is never overdue', () => {
  expect(dueState('2026-11-10', 1, NOW)).toBeNull()
  expect(dueText('2026-11-10', true, NOW)).toBe('2026-11-10')
})

test('the due date is said in words when it is past or today', () => {
  expect(dueText('2026-11-10', false, NOW)).toBe('Overdue 2026-11-10')
  expect(dueText('2026-11-11', false, NOW)).toBe('Due today')
  expect(dueText('2026-12-01', false, NOW)).toBe('2026-12-01')
  expect(dueText(null, false, NOW)).toBe('')
})

test('a quick-add line ends in an optional due date, in either date format', () => {
  expect(parseQuickTask('  File  expenses 2026-11-20 ')).toEqual({ title: 'File expenses', due: '2026-11-20' })
  expect(parseQuickTask('File expenses 20.11.2026')).toEqual({ title: 'File expenses', due: '2026-11-20' })
  expect(parseQuickTask('File expenses')).toEqual({ title: 'File expenses', due: null })
})

test('a last word that is no real date, or a date alone, stays in the title', () => {
  expect(parseQuickTask('Close 2026-13-45')).toEqual({ title: 'Close 2026-13-45', due: null })
  expect(parseQuickTask('2026-11-20')).toEqual({ title: '2026-11-20', due: null })
  expect(parseQuickTask('')).toEqual({ title: '', due: null })
})

test('Push counts from today: Tomorrow is the next day, Next week is 7 days on', () => {
  expect(pushDate('tomorrow', NOW)).toBe('2026-11-12')
  expect(pushDate('next-week', NOW)).toBe('2026-11-18')
})

test('Push rolls over month and year ends and the end of February', () => {
  expect(pushDate('tomorrow', '2026-11-30')).toBe('2026-12-01')
  expect(pushDate('tomorrow', '2026-12-31')).toBe('2027-01-01')
  expect(pushDate('next-week', '2026-12-28')).toBe('2027-01-04')
  expect(pushDate('tomorrow', '2028-02-28')).toBe('2028-02-29')
  expect(pushDate('tomorrow', '2027-02-28')).toBe('2027-03-01')
  expect(pushDate('next-week', '2028-02-25')).toBe('2028-03-03')
})
