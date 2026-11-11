import { expect, test } from 'vitest'
import { Position } from '@vue-flow/core'
import { arrowHead, edgeData, edgeEnd, edgeOptions, greyEdge, INTO_SIDE, NEW_EDGE_DATA, nextId, parseCanvas, serialiseCanvas, viewportFor } from './canvas'

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

// Copied from a Diagram this version's predecessor saved: free and linked Nodes, a fill, a Tidy, drawn and restored Edges.
const SAVED_BEFORE =
  '{"nodes":[{"id":"1","type":"node","position":{"x":206,"y":45.5},"data":{"label":"Coupa","recordType":"system","recordId":2,"fill":"blue"},"targetPosition":"left","sourcePosition":"right"},' +
  '{"id":"8","type":"node","position":{"x":40,"y":300},"data":{"label":"Plain node"}},{"id":"9","type":"node","position":{"x":427,"y":328.5},"data":{"label":""}}],' +
  '"edges":[{"id":"1","type":"default","source":"1","target":"8","data":{},"label":"POs nightly","style":{"fill":"none","stroke":"#a1a1aa","strokeWidth":1.5}},' +
  '{"id":"4","type":"default","source":"8","target":"9","data":{},"label":"","style":{"fill":"none","stroke":"#a1a1aa","strokeWidth":1.5}},' +
  '{"id":"6","type":"default","source":"9","target":"1","sourceHandle":null,"targetHandle":null,"data":{},"label":"","style":{"fill":"none","stroke":"#a1a1aa","strokeWidth":1.5}}],' +
  '"viewport":{"x":32,"y":137.97806451612905,"zoom":0.8438709677419355}}'

test('a canvas saved before shapes, sizes, Edge options and Frames existed is read and written back unchanged', () => {
  expect(serialiseCanvas(parseCanvas(SAVED_BEFORE))).toBe(SAVED_BEFORE)
})

test('an Edge without stored options has no arrowhead, a solid line and a curved path, as before they existed', () => {
  const plain = { arrow: 'none', line: 'solid', path: 'curved' }
  expect(edgeOptions(undefined)).toEqual(plain)
  expect(edgeOptions({})).toEqual(plain)
  expect(edgeOptions({ arrow: 'sideways', dash: 'yes', path: 7 })).toEqual(plain)
  expect(edgeData(plain as never)).toEqual({})
})

test('Edge options are stored by name and read back', () => {
  const options = { arrow: 'both', line: 'dashed', path: 'step' } as const
  expect(edgeData(options)).toEqual({ arrow: 'both', dash: true, path: 'step' })
  expect(edgeOptions(edgeData(options))).toEqual(options)
  expect(edgeOptions(NEW_EDGE_DATA).arrow).toBe('end')
})

test('an arrowhead has its tip on the point and opens against the direction it points in', () => {
  expect(arrowHead(100, 50, 0)).toBe('100,50 91,53.6 91,46.4')
  expect(arrowHead(0, 0, INTO_SIDE[Position.Top])).toBe('0,0 -3.6,-9 3.6,-9')
  expect(arrowHead(0, 0, INTO_SIDE[Position.Right])).toBe('0,0 9,-3.6 9,3.6')
})

test('snap to grid is saved with the Diagram only when it is on', () => {
  expect(JSON.parse(serialiseCanvas({ ...saved, snap: true })).snap).toBe(true)
  expect(parseCanvas(serialiseCanvas({ ...saved, snap: true })).snap).toBe(true)
  expect(serialiseCanvas({ ...saved, snap: false })).toBe(serialiseCanvas(saved))
  expect(parseCanvas('{"snap":"yes"}').snap).toBeUndefined()
})
