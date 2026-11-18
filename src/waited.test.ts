import { expect, test } from 'vitest'
import { waitedDays, waitedText } from './waited'

const NOW = '2026-11-11'

test('how long an Open question has waited is said as today, 1 day or N days', () => {
  expect(waitedText(0)).toBe('today')
  expect(waitedText(1)).toBe('1 day')
  expect(waitedText(2)).toBe('2 days')
  expect(waitedText(400)).toBe('400 days')
})

test('days waited count whole local days from when the question was created, across month and year ends', () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()
  expect(waitedDays(at(2026, 11, 11, 23), NOW)).toBe(0)
  expect(waitedDays(at(2026, 11, 11, 0), NOW)).toBe(0)
  expect(waitedDays(at(2026, 11, 10, 23), NOW)).toBe(1)
  expect(waitedDays(at(2026, 10, 31), NOW)).toBe(11)
  expect(waitedDays(at(2025, 12, 31), '2026-01-01')).toBe(1)
  expect(waitedDays(at(2024, 2, 28), '2024-03-01')).toBe(2)
  expect(waitedDays(at(2025, 11, 11), NOW)).toBe(365)
})
