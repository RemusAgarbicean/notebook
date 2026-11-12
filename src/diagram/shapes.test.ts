import { expect, test } from 'vitest'
import { diamondPadding, SHAPE_NAMES, shapeOf } from './shapes'

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

test('a diamond leaves room so its text, however long, stays inside the diamond', () => {
  for (const [w, h] of [[40, 16], [112, 18], [112, 200], [300, 16]]) {
    const { block, inline } = diamondPadding(w, h)
    // A centred w by h box fits inside a W by H diamond when w/W + h/H <= 1.
    expect(w / (w + 2 * inline) + h / (h + 2 * block)).toBeLessThanOrEqual(1)
  }
})
