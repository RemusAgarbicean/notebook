import { expect, test } from 'vitest'
import { Position } from '@vue-flow/core'
import { edgeEnd, greyEdge, nextId, parseCanvas, serialiseCanvas, viewportFor } from './canvas'

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

test('only nodes, edges and viewport are saved, without what Vue Flow works out while drawing or the tabindex of an Edge', () => {
  const nodes = saved.nodes.map((n) => ({ ...n, initialized: true }))
  const edges = saved.edges.map((e) => ({ ...e, sourceX: 1, sourceY: 2, targetX: 3, targetY: 4 }))
  const json = serialiseCanvas({ ...saved, nodes, edges, position: [0, 37], zoom: 1.5 } as never)
  const { domAttributes: _, ...edge } = saved.edges[0]
  expect(JSON.parse(json)).toEqual({ ...saved, edges: [edge] })
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

// ---- Where an Edge meets its Nodes

const box = (x: number, y: number) => ({ x, y, width: 100, height: 40 })

test('an Edge leaves a Node at its handle when the other Node lies that way', () => {
  expect(edgeEnd(box(0, 0), Position.Bottom, box(0, 200))).toEqual({ x: 50, y: 40, position: Position.Bottom })
  expect(edgeEnd(box(0, 200), Position.Top, box(0, 0))).toEqual({ x: 50, y: 200, position: Position.Top })
  expect(edgeEnd(box(0, 0), Position.Right, box(300, 0))).toEqual({ x: 100, y: 20, position: Position.Right })
})

test('an Edge uses the opposite side when the other Node lies behind the handle, so it never runs through its own Node', () => {
  // Source below its target: out of the top, into the bottom.
  expect(edgeEnd(box(0, 200), Position.Bottom, box(0, 0))).toEqual({ x: 50, y: 200, position: Position.Top })
  expect(edgeEnd(box(0, 0), Position.Top, box(0, 200))).toEqual({ x: 50, y: 40, position: Position.Bottom })
  expect(edgeEnd(box(300, 0), Position.Right, box(0, 0))).toEqual({ x: 300, y: 20, position: Position.Left })
  expect(edgeEnd(box(0, 0), Position.Left, box(300, 0))).toEqual({ x: 100, y: 20, position: Position.Right })
})

// ---- The viewport for an export

test('the export viewport shows the whole drawing, centred, with the margin around it', () => {
  // 800 x 100 of drawing into 1000 x 500 with 50 around: the width decides, zoom (1000 - 100) / 800.
  expect(viewportFor({ x: -100, y: 20, width: 800, height: 100 }, { width: 1000, height: 500 }, 50)).toEqual({
    zoom: 1.125,
    x: 162.5, // the left edge, -100, lands on the 50 margin
    y: 171.25, // 112.5 high, centred in 500, less the 20 offset
  })
})

test('the export viewport never zooms a small drawing in past 2, or a huge one out past 0.1', () => {
  expect(viewportFor({ x: 0, y: 0, width: 10, height: 10 }, { width: 1000, height: 500 }, 50).zoom).toBe(2)
  expect(viewportFor({ x: 0, y: 0, width: 1e6, height: 10 }, { width: 1000, height: 500 }, 50).zoom).toBe(0.1)
})
