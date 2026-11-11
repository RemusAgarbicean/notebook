import { Position, type Edge, type Node, type ViewportTransform } from '@vue-flow/core'
import type { FillName } from './fills'
import type { ShapeName } from './shapes'

/**
 * What a Node carries. `fill` is a palette name, absent for no fill. A linked
 * Node also has its Record's type and id, and `label` is then the title snapshot.
 * Everything but the label is optional, so a Diagram saved before a field existed reads as it did.
 */
export type NodeData = {
  label: string
  fill?: FillName
  recordType?: string
  recordId?: number
  /** A shape name; absent for the rectangle. */
  shape?: ShapeName
  /** The size a resize gave it, in canvas pixels; absent while its text decides. */
  width?: number
  height?: number
}

/** The grid the canvas shows, and snaps to when asked. */
export const GRID = 16

/** The JSON kept in `diagram.canvas`. */
export type Canvas = { nodes: Node<NodeData>[]; edges: Edge[]; viewport: ViewportTransform }

/** The one custom node type; the name is stored in every saved Node. */
export const NODE_TYPE = 'node'

// Inline, because html-to-image fills edge paths black without an inline `fill: none`.
const EDGE_STYLE = { fill: 'none', stroke: '#a1a1aa', strokeWidth: 1.5 }

// The tabindex: Vue Flow writes `tabIndex` on the SVG group, which SVG does not know, so Tab would skip every Edge.
const EDGE_ATTRS = { tabindex: 0 }

/** An Edge with the one look every Edge has, reachable with Tab. */
export const greyEdge = <E extends object>(edge: E) => ({ ...edge, style: EDGE_STYLE, domAttributes: EDGE_ATTRS })

/** Vue Flow's `toObject()` result as the text to store. */
export function serialiseCanvas({ nodes, edges, viewport }: { nodes: object[]; edges: object[]; viewport: object }): string {
  // Dropped: what Vue Flow works out again while drawing, and what `greyEdge` adds for the keyboard. Saving it would rewrite a Diagram just for being opened.
  return JSON.stringify({
    nodes: (nodes as Record<string, unknown>[]).map(({ initialized: _, ...node }: Record<string, unknown>) => node),
    edges: (edges as Record<string, unknown>[]).map(({ sourceX: _a, sourceY: _b, targetX: _c, targetY: _d, domAttributes: _e, ...edge }: Record<string, unknown>) => edge),
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

/** How far the canvas zooms out and in; a large Diagram must still fit in its export. */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2

type Box = { x: number; y: number; width: number; height: number }
const OPPOSITE = {
  [Position.Top]: Position.Bottom,
  [Position.Bottom]: Position.Top,
  [Position.Left]: Position.Right,
  [Position.Right]: Position.Left,
}

/**
 * Where an Edge meets `node`: the middle of the side its handle is on, or of the
 * opposite side when the `other` Node lies behind the handle. Without the swap
 * an Edge to a Node above its source ran down, behind both Nodes and in from above.
 */
export function edgeEnd(node: Box, handle: Position, other: Box): { x: number; y: number; position: Position } {
  const dx = other.x + other.width / 2 - (node.x + node.width / 2)
  const dy = other.y + other.height / 2 - (node.y + node.height / 2)
  const behind = { [Position.Top]: dy > 0, [Position.Bottom]: dy < 0, [Position.Left]: dx > 0, [Position.Right]: dx < 0 }
  const position = behind[handle] ? OPPOSITE[handle] : handle
  return {
    position,
    x: node.x + (position === Position.Left ? 0 : position === Position.Right ? node.width : node.width / 2),
    y: node.y + (position === Position.Top ? 0 : position === Position.Bottom ? node.height : node.height / 2),
  }
}

/** The viewport that shows all of `bounds` (in canvas coordinates) centred in `size`, with `margin` pixels around it. */
export function viewportFor(bounds: Box, size: { width: number; height: number }, margin: number): ViewportTransform {
  const fit = Math.min((size.width - 2 * margin) / bounds.width, (size.height - 2 * margin) / bounds.height)
  const zoom = Math.max(MIN_ZOOM, Math.min(fit, MAX_ZOOM))
  return {
    zoom,
    x: (size.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (size.height - bounds.height * zoom) / 2 - bounds.y * zoom,
  }
}

/** An id for a new Node or Edge: one more than the highest numeric id in use. */
export function nextId(items: { id: string }[]): string {
  return String(Math.max(0, ...items.map((i) => Number(i.id) || 0)) + 1)
}
