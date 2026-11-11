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
