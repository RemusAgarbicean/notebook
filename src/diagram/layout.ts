import { Graph, layout } from '@dagrejs/dagre'

export type Direction = 'LR' | 'TB'

/** Tidy positions (top-left corners, as Vue Flow wants them) for every Node, by id. */
export function tidy(
  nodes: { id: string; width: number; height: number }[],
  edges: { source: string; target: string }[],
  direction: Direction,
): Record<string, { x: number; y: number }> {
  const graph = new Graph()
  graph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) graph.setNode(n.id, { width: n.width, height: n.height })
  // setEdge would invent a Node for an id it has not seen.
  for (const e of edges) if (graph.hasNode(e.source) && graph.hasNode(e.target)) graph.setEdge(e.source, e.target)
  layout(graph)
  return Object.fromEntries(
    nodes.map((n) => {
      // dagre gives centres.
      const { x, y } = graph.node(n.id)
      return [n.id, { x: x - n.width / 2, y: y - n.height / 2 }]
    }),
  )
}
