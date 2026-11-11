import { expect, test } from 'vitest'
import { record, redo, startHistory, undo } from './undo'

test('undo steps back through the recorded states and redo forward again', () => {
  let h = record(record(startHistory('a'), 'b'), 'c')
  h = undo(h)
  expect(h.present).toBe('b')
  h = undo(h)
  expect(h.present).toBe('a')
  expect(undo(h)).toBe(h) // nothing left
  h = redo(redo(h))
  expect(h.present).toBe('c')
  expect(redo(h)).toBe(h)
})

test('recording the state it already has changes nothing', () => {
  const h = record(startHistory('a'), 'b')
  expect(record(h, 'b')).toBe(h)
})

test('a new change after an undo drops what could have been redone', () => {
  const h = record(undo(record(startHistory('a'), 'b')), 'c')
  expect(h.future).toEqual([])
  expect(undo(h).present).toBe('a')
})

test('the history is capped: the oldest steps fall off', () => {
  let h = startHistory('0')
  for (let i = 1; i <= 5; i++) h = record(h, String(i), 3)
  expect(h.past).toEqual(['2', '3', '4'])
})
