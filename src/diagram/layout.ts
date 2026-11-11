import { Graph, layout } from '@dagrejs/dagre'
import { frameAround, parentsOf, type Box } from './arrange'

export type Direction = 'LR' | 'TB'

type Tidied = { id: string; width: number; height: number; x?: number; y?: number; frame?: boolean }

function run(nodes: Tidied[], edges: { source: string; target: string }[], direction: Direction, parents: Record<string, string>) {
  const graph = new Graph({ compound: true })
  graph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 })
  graph.setDefaultEdgeLabel(() => ({}))
  const filled = new Set(Object.values(parents))
  // A Frame with something in it is a cluster: dagre keeps what is in it together. An empty one is placed like a Node.
  for (const n of nodes) graph.setNode(n.id, filled.has(n.id) ? {} : { width: n.width, height: n.height })
  for (const [child, parent] of Object.entries(parents)) graph.setParent(child, parent)
  // setEdge would invent a Node for an id it has not seen.
  for (const e of edges) if (graph.hasNode(e.source) && graph.hasNode(e.target)) graph.setEdge(e.source, e.target)
  layout(graph)
  return graph
}

/**
 * Tidy boxes (top-left corners, as Vue Flow wants them) for every Node and Frame, by id.
 * Nodes keep their size. What was in a Frame stays together and in it; the Frame is drawn around it again.
 */
export function tidy(nodes: Tidied[], edges: { source: string; target: string }[], direction: Direction): Record<string, Box> {
  const parents = parentsOf(nodes.map((n) => ({ x: 0, y: 0, ...n })))
  let graph: Graph
  try {
    graph = run(nodes, edges, direction, parents)
  } catch {
    // dagre gives up on some graphs with clusters. Without them the Nodes are still tidied, and the Frames follow them.
    graph = run(nodes, edges, direction, {})
  }
  const boxes: Record<string, Box> = {}
  const filled = new Set(Object.values(parents))
  for (const n of nodes) {
    if (filled.has(n.id)) continue
    // dagre gives centres.
    const { x, y } = graph.node(n.id)
    boxes[n.id] = { x: x - n.width / 2, y: y - n.height / 2, width: n.width, height: n.height }
  }
  // Inner Frames first: an outer one goes around them.
  const frames = nodes.filter((n) => filled.has(n.id)).sort((a, b) => a.width * a.height - b.width * b.height)
  for (const f of frames) boxes[f.id] = frameAround(nodes.filter((n) => parents[n.id] === f.id).map((n) => boxes[n.id]))
  return boxes
}
