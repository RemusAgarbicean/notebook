import { expect, test } from 'vitest'
import { greyEdge, nextId, parseCanvas, serialiseCanvas } from './canvas'

const saved = {
  nodes: [
    { id: '1', type: 'node', position: { x: 0, y: 0 }, data: { label: 'Coupa', fill: 'green' } },
    { id: '2', type: 'node', position: { x: 240, y: -80.5 }, data: { label: 'SAP' } },
  ],
  edges: [greyEdge({ id: 'e1', source: '1', target: '2', label: 'invoices' })],
  // A pan of exactly 0 is the case Vue Flow's own fromObject loses.
  viewport: { x: 0, y: 37, zoom: 1.5 },
}

test('a saved canvas comes back exactly, viewport included', () => {
  expect(parseCanvas(serialiseCanvas(saved))).toEqual(saved)
})

test('only nodes, edges and viewport are saved, without what Vue Flow works out while drawing', () => {
  const nodes = saved.nodes.map((n) => ({ ...n, initialized: true }))
  const edges = saved.edges.map((e) => ({ ...e, sourceX: 1, sourceY: 2, targetX: 3, targetY: 4 }))
  const json = serialiseCanvas({ ...saved, nodes, edges, position: [0, 37], zoom: 1.5 } as never)
  expect(JSON.parse(json)).toEqual(saved)
})

test('a new or unreadable canvas is empty at the default viewport', () => {
  const empty = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
  expect(parseCanvas(null)).toEqual(empty)
  expect(parseCanvas('')).toEqual(empty)
  expect(parseCanvas('{not json')).toEqual(empty)
  expect(parseCanvas('{"nodes":5}')).toEqual(empty)
})

test('restored Edges are always grey and unfilled, whatever was saved', () => {
  const json = JSON.stringify({ ...saved, edges: [{ id: 'e1', source: '1', target: '2', style: { stroke: 'red' } }] })
  expect(parseCanvas(json).edges[0].style).toEqual({ fill: 'none', stroke: '#a1a1aa', strokeWidth: 1.5 })
})

test('nextId is one more than the highest numeric id', () => {
  expect(nextId([])).toBe('1')
  expect(nextId([{ id: '2' }, { id: '10' }, { id: 'e1' }])).toBe('11')
})
