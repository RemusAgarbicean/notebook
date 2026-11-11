import { expect, test } from 'vitest'
import { childPosition } from './arrange'

const box = (x: number, y: number, width = 100, height = 40) => ({ x, y, width, height })

test('a first child goes one rank along from its parent, level with it', () => {
  expect(childPosition(box(0, 0), [], 'LR')).toEqual({ x: 180, y: 0 })
  expect(childPosition(box(0, 0), [], 'TB')).toEqual({ x: 0, y: 120 })
})

test('a further child goes beside the children already there', () => {
  expect(childPosition(box(0, 0), [box(180, 0), box(180, 64)], 'LR')).toEqual({ x: 180, y: 128 })
  expect(childPosition(box(0, 0), [box(0, 120), box(124, 120)], 'TB')).toEqual({ x: 248, y: 120 })
})
