import { expect, test } from 'vitest'
import { childPosition, resize } from './arrange'

const box = (x: number, y: number, width = 100, height = 40) => ({ x, y, width, height })

test('a first child goes one rank along from its parent, level with it', () => {
  expect(childPosition(box(0, 0), [], 'LR')).toEqual({ x: 180, y: 0 })
  expect(childPosition(box(0, 0), [], 'TB')).toEqual({ x: 0, y: 120 })
})

test('a further child goes beside the children already there', () => {
  expect(childPosition(box(0, 0), [box(180, 0), box(180, 64)], 'LR')).toEqual({ x: 180, y: 128 })
  expect(childPosition(box(0, 0), [box(0, 120), box(124, 120)], 'TB')).toEqual({ x: 248, y: 120 })
})

test('dragging a corner resizes the box and keeps the opposite corner where it is', () => {
  const min = { width: 40, height: 20 }
  expect(resize(box(10, 10), 'se', 30, 15, min)).toEqual(box(10, 10, 130, 55))
  expect(resize(box(10, 10), 'nw', -30, 5, min)).toEqual(box(-20, 15, 130, 35))
  expect(resize(box(10, 10), 'ne', 20, -10, min)).toEqual(box(10, 0, 120, 50))
  expect(resize(box(10, 10), 'sw', 20, 10, min)).toEqual(box(30, 10, 80, 50))
})

test('a box does not shrink below its minimum, from either side', () => {
  const min = { width: 40, height: 20 }
  expect(resize(box(10, 10), 'se', -500, -500, min)).toEqual(box(10, 10, 40, 20))
  expect(resize(box(10, 10), 'nw', 500, 500, min)).toEqual(box(70, 30, 40, 20))
})

test('with a grid, the dragged corner lands on it', () => {
  expect(resize(box(10, 10), 'se', 31, 13, { width: 40, height: 20 }, 16)).toEqual(box(10, 10, 134, 54))
  expect(resize(box(10, 10), 'nw', -7, -7, { width: 40, height: 20 }, 16)).toEqual(box(0, 0, 110, 50))
})
