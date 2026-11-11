import { expect, test } from 'vitest'
import { clipOf, held, hold, pasted } from './clipboard'

const node = (id: string, x: number, y = 0) => ({ id, type: 'node', position: { x, y }, data: { label: `N${id}` } })
const edge = (id: string, source: string, target: string) => ({ id, source, target, label: `${source}-${target}` })
const nodes = [node('1', 0), node('2', 100), node('3', 200)]
const edges = [edge('1', '1', '2'), edge('2', '2', '3')]

test('a clip holds the chosen Nodes and only the Edges that run between them', () => {
  const clip = clipOf(nodes, edges, ['1', '2'])
  expect(clip.nodes.map((n) => n.id)).toEqual(['1', '2'])
  expect(clip.edges.map((e) => e.id)).toEqual(['1'])
})

test('a clip is a copy: later changes to the canvas do not reach it', () => {
  const live = [node('1', 0)]
  const clip = clipOf(live, [], ['1'])
  live[0].position.x = 50
  live[0].data.label = 'changed'
  expect(clip.nodes[0]).toEqual(node('1', 0))
})

test('pasting gives fresh ids after the ones in use, moves the Nodes and re-points the Edges', () => {
  const clip = clipOf(nodes, edges, ['2', '3'])
  const { nodes: added, edges: joined } = pasted(clip, nodes, edges, { x: 10, y: 20 })

  expect(added).toEqual([
    { ...node('4', 110, 20), data: { label: 'N2' } },
    { ...node('5', 210, 20), data: { label: 'N3' } },
  ])
  expect(joined).toEqual([{ ...edge('3', '4', '5'), label: '2-3' }])
  // The clip can be pasted again.
  expect(clip.nodes.map((n) => n.id)).toEqual(['2', '3'])
})

test('pasting into an empty canvas numbers from 1', () => {
  const { nodes: added, edges: joined } = pasted(clipOf(nodes, edges, ['2', '3']), [], [], { x: 0, y: 0 })
  expect(added.map((n) => n.id)).toEqual(['1', '2'])
  expect(joined).toMatchObject([{ id: '1', source: '1', target: '2' }])
})

test('what is held belongs to the Notebook it was copied in', () => {
  const [a, b] = [{}, {}]
  const clip = clipOf(nodes, edges, ['1'])
  hold(clip, a)
  expect(held(a)).toBe(clip)
  expect(held(b)).toBeNull()
})
