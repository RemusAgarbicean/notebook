import { expect, test } from 'vitest'
import { tidy } from './layout'

const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id, width: 120, height: 40 }))
// a -> b -> d and a -> c
const edges = [
  { source: 'a', target: 'b' },
  { source: 'a', target: 'c' },
  { source: 'b', target: 'd' },
]

test('left-to-right puts each rank further right and siblings one above the other', () => {
  const p = tidy(nodes, edges, 'LR')
  expect(p.a.x + 120).toBeLessThan(p.b.x)
  expect(p.b.x + 120).toBeLessThan(p.d.x)
  expect(p.b.x).toBe(p.c.x)
  expect(Math.abs(p.b.y - p.c.y)).toBeGreaterThanOrEqual(40)
})

test('top-down puts each rank lower and siblings side by side', () => {
  const p = tidy(nodes, edges, 'TB')
  expect(p.a.y + 40).toBeLessThan(p.b.y)
  expect(p.b.y + 40).toBeLessThan(p.d.y)
  expect(p.b.y).toBe(p.c.y)
  expect(Math.abs(p.b.x - p.c.x)).toBeGreaterThanOrEqual(120)
})

test('an Edge to a Node that is gone is ignored', () => {
  expect(Object.keys(tidy(nodes, [{ source: 'a', target: 'zz' }], 'LR')).sort()).toEqual(['a', 'b', 'c', 'd'])
})

const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test('Tidy keeps what is in a Frame together and draws the Frame around it, clear of the other Nodes', () => {
  const n = (id: string, x: number, y: number) => ({ id, x, y, width: 100, height: 40 })
  const nodes = [
    { id: 'f', x: 0, y: 0, width: 300, height: 300, frame: true },
    n('a', 20, 50),
    n('b', 150, 200),
    n('out1', 600, 0),
    n('out2', 600, 400),
    { id: 'empty', x: 2000, y: 2000, width: 240, height: 160, frame: true },
  ]
  const edges = [
    { source: 'out1', target: 'a' },
    { source: 'a', target: 'out2' },
    { source: 'out1', target: 'b' },
  ]
  for (const direction of ['LR', 'TB'] as const) {
    const boxes = tidy(nodes, edges, direction)
    const f = boxes.f
    for (const id of ['a', 'b']) {
      expect(boxes[id].x).toBeGreaterThanOrEqual(f.x + 20)
      expect(boxes[id].y).toBeGreaterThanOrEqual(f.y + 40)
      expect(boxes[id].x + 100).toBeLessThanOrEqual(f.x + f.width - 20)
      expect(boxes[id].y + 40).toBeLessThanOrEqual(f.y + f.height - 20)
    }
    for (const id of ['out1', 'out2', 'empty']) expect(overlap(boxes[id], f)).toBe(false)
    expect(boxes.empty).toMatchObject({ width: 240, height: 160 })
    expect(boxes.a).toMatchObject({ width: 100, height: 40 })
  }
})
