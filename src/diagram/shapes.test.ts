import { expect, test } from 'vitest'
import { SHAPE_NAMES, shapeOf } from './shapes'

test('the shapes a Node can have, the rectangle first', () => {
  expect(SHAPE_NAMES).toEqual(['rectangle', 'pill', 'diamond', 'cylinder', 'note'])
})

test('a Node without a shape, or with one this version does not know, is a rectangle', () => {
  expect(shapeOf(undefined)).toBe('rectangle')
  expect(shapeOf('hexagon')).toBe('rectangle')
  expect(shapeOf('toString')).toBe('rectangle')
  expect(shapeOf(7)).toBe('rectangle')
  expect(shapeOf('diamond')).toBe('diamond')
})
