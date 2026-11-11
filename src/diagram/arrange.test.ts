import { expect, test } from 'vitest'
import { align, childPosition, distribute, frameAround, parentsOf, resize, within } from './arrange'

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

const placed = (id: string, x: number, y: number, width = 100, height = 40, frame = false) => ({ id, x, y, width, height, frame })

test('a Node is in the smallest Frame that holds its middle, and a Frame can be in a larger one', () => {
  const nodes = [
    placed('outer', 0, 0, 600, 400, true),
    placed('inner', 20, 40, 200, 200, true),
    placed('a', 40, 60), // in inner
    placed('b', 400, 300), // in outer only
    placed('c', 580, 380), // its corner is in outer, its middle is not
    placed('d', 900, 900),
  ]
  expect(parentsOf(nodes)).toEqual({ inner: 'outer', a: 'inner', b: 'outer' })
  expect(within(parentsOf(nodes), 'outer').sort()).toEqual(['a', 'b', 'inner'])
  expect(within(parentsOf(nodes), 'inner')).toEqual(['a'])
})

test('two Frames of the same size on top of each other are not in each other', () => {
  expect(parentsOf([placed('f', 0, 0, 200, 200, true), placed('g', 10, 10, 200, 200, true)])).toEqual({})
})

test('a Frame around Nodes leaves room on every side and for its title', () => {
  expect(frameAround([box(100, 100), box(300, 200)])).toEqual({ x: 80, y: 60, width: 340, height: 200 })
})

const three = [placed('a', 0, 0, 100, 40), placed('b', 50, 100, 60, 20), placed('c', 300, 30, 100, 60)]

test('aligning lines boxes up on an edge of the outermost one or on the middle of them all', () => {
  expect(align(three, 'left')).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, c: { x: 0, y: 30 } })
  expect(align(three, 'right')).toEqual({ a: { x: 300, y: 0 }, b: { x: 340, y: 100 }, c: { x: 300, y: 30 } })
  expect(align(three, 'center')).toEqual({ a: { x: 150, y: 0 }, b: { x: 170, y: 100 }, c: { x: 150, y: 30 } })
  expect(align(three, 'top')).toEqual({ a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, c: { x: 300, y: 0 } })
  expect(align(three, 'bottom')).toEqual({ a: { x: 0, y: 80 }, b: { x: 50, y: 100 }, c: { x: 300, y: 60 } })
  expect(align(three, 'middle')).toEqual({ a: { x: 0, y: 40 }, b: { x: 50, y: 50 }, c: { x: 300, y: 30 } })
})

test('distributing leaves the outermost boxes and makes the gaps between all of them equal', () => {
  // Across: 400 wide, 260 of it boxes, so two gaps of 70.
  expect(distribute(three, 'x')).toEqual({ a: { x: 0, y: 0 }, b: { x: 170, y: 100 }, c: { x: 300, y: 30 } })
  // Down, in the order a, c, b: 120 high, 120 of it boxes, so no gaps.
  expect(distribute(three, 'y')).toEqual({ a: { x: 0, y: 0 }, c: { x: 300, y: 40 }, b: { x: 50, y: 100 } })
})
