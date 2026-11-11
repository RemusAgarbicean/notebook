import { nextId } from './canvas'

// The Diagram's own clipboard: it needs no permission and lasts as long as the page.

type Item = { id: string }
type ClipNode = Item & { position: { x: number; y: number } }
type ClipEdge = Item & { source: string; target: string }
export type Clip<N extends ClipNode = ClipNode, E extends ClipEdge = ClipEdge> = { nodes: N[]; edges: E[] }

/** A copy of the Nodes with these ids and of the Edges that run between two of them. */
export function clipOf<N extends ClipNode, E extends ClipEdge>(nodes: N[], edges: E[], ids: string[]): Clip<N, E> {
  const picked = new Set(ids)
  return structuredClone({
    nodes: nodes.filter((n) => picked.has(n.id)),
    edges: edges.filter((e) => picked.has(e.source) && picked.has(e.target)),
  })
}

/** The clip ready to add to a canvas that has `nodes` and `edges`: fresh ids, moved by `by`. */
export function pasted<N extends ClipNode, E extends ClipEdge>(clip: Clip<N, E>, nodes: Item[], edges: Item[], by: { x: number; y: number }): Clip<N, E> {
  const copy = structuredClone(clip)
  const ids = new Map<string, string>()
  const [firstNode, firstEdge] = [Number(nextId(nodes)), Number(nextId(edges))]
  copy.nodes.forEach((n, i) => {
    ids.set(n.id, String(firstNode + i))
    n.id = ids.get(n.id)!
    n.position = { x: n.position.x + by.x, y: n.position.y + by.y }
  })
  copy.edges.forEach((e, i) => Object.assign(e, { id: String(firstEdge + i), source: ids.get(e.source), target: ids.get(e.target) }))
  return copy
}

let holding: { clip: Clip; from: unknown } | null = null

/** Keeps a clip. `from` is the Notebook it was copied in: a linked Node means nothing in another one. */
export function hold(clip: Clip, from: unknown) {
  holding = { clip, from }
}
/** The clip held for this Notebook, or null. */
export const held = (from: unknown) => (holding && holding.from === from ? holding.clip : null)
