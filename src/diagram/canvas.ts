import type { Edge, Node, ViewportTransform } from '@vue-flow/core'
import type { FillName } from './fills'

/** What a Node carries. `fill` is a palette name, absent for no fill. */
export type NodeData = { label: string; fill?: FillName }

/** The JSON kept in `diagram.canvas`. */
export type Canvas = { nodes: Node<NodeData>[]; edges: Edge[]; viewport: ViewportTransform }

/** The one custom node type; the name is stored in every saved Node. */
export const NODE_TYPE = 'node'

// Inline, because html-to-image fills edge paths black without an inline `fill: none`.
const EDGE_STYLE = { fill: 'none', stroke: '#a1a1aa', strokeWidth: 1.5 }

/** An Edge with the one look every Edge has. */
export const greyEdge = <E extends object>(edge: E) => ({ ...edge, style: EDGE_STYLE })

/** Vue Flow's `toObject()` result as the text to store. */
export function serialiseCanvas({ nodes, edges, viewport }: { nodes: object[]; edges: object[]; viewport: object }): string {
  // Dropped: what Vue Flow works out again while drawing. Saving it would rewrite a Diagram just for being opened.
  return JSON.stringify({
    nodes: (nodes as Record<string, unknown>[]).map(({ initialized: _, ...node }: Record<string, unknown>) => node),
    edges: (edges as Record<string, unknown>[]).map(({ sourceX: _a, sourceY: _b, targetX: _c, targetY: _d, ...edge }: Record<string, unknown>) => edge),
    viewport,
  })
}

/** The stored text as a canvas; empty when there is none or it cannot be read. */
export function parseCanvas(json: string | null | undefined): Canvas {
  let saved: Partial<Canvas> = {}
  try {
    saved = JSON.parse(json || '{}') ?? {}
  } catch {
    // An unreadable canvas opens empty rather than breaking the page.
  }
  const { x, y, zoom } = saved.viewport ?? {}
  return {
    nodes: Array.isArray(saved.nodes) ? saved.nodes : [],
    edges: Array.isArray(saved.edges) ? saved.edges.map(greyEdge) : [],
    viewport: { x: Number(x) || 0, y: Number(y) || 0, zoom: Number(zoom) || 1 },
  }
}

/** An id for a new Node or Edge: one more than the highest numeric id in use. */
export function nextId(items: { id: string }[]): string {
  return String(Math.max(0, ...items.map((i) => Number(i.id) || 0)) + 1)
}
