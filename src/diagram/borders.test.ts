import { expect, test } from 'vitest'
import { BORDER_NAMES, borderClass, borderOf, storedBorder } from './borders'

test('the borders are solid, dashed, dotted and none', () => {
  expect(BORDER_NAMES).toEqual(['solid', 'dashed', 'dotted', 'none'])
})

test('a Node with no border, or one that is not a border name, is drawn solid', () => {
  expect(borderOf(undefined)).toBe('solid')
  expect(borderOf('wavy')).toBe('solid')
  expect(borderOf('dotted')).toBe('dotted')
  expect(borderClass(undefined)).toBeUndefined()
  expect(borderClass('dashed')).toBe('border-dashed-line')
})

test('solid is stored as nothing, the others by name', () => {
  expect(storedBorder('solid')).toBeUndefined()
  expect(storedBorder('none')).toBe('none')
})
