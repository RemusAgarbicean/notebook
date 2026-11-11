import { expect, test } from 'vitest'
import { placePopup } from './caret'

const viewport = { width: 1000, height: 600 }
const size = { width: 288, height: 200 }

test('the popup opens just below the caret, starting at it', () => {
  expect(placePopup({ left: 300, top: 100, bottom: 120 }, size, viewport)).toEqual({ left: 300, top: 124 })
})

test('near the bottom of the viewport it flips above the caret', () => {
  expect(placePopup({ left: 300, top: 500, bottom: 520 }, size, viewport)).toEqual({ left: 300, top: 296 })
})

test('with no room above either, it stays below', () => {
  expect(placePopup({ left: 300, top: 150, bottom: 170 }, { width: 288, height: 500 }, viewport).top).toBe(174)
})

test('it is kept inside the viewport on the right and on the left', () => {
  expect(placePopup({ left: 900, top: 100, bottom: 120 }, size, viewport).left).toBe(704)
  expect(placePopup({ left: -50, top: 100, bottom: 120 }, size, viewport).left).toBe(8)
})
