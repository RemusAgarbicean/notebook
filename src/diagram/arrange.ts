import type { Direction } from './layout'

// Where things go when the canvas places them: plain geometry in canvas coordinates.

export type Box = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }

/** The gaps Tidy leaves, so a child added by hand lands where Tidy would put it. */
export const RANK_GAP = 80
export const NODE_GAP = 24

/** Where a new child of `parent` goes: one rank along, after the `children` it already has. */
export function childPosition(parent: Box, children: Box[], direction: Direction): Point {
  if (direction === 'LR') {
    const x = parent.x + parent.width + RANK_GAP
    return { x, y: children.length ? Math.max(...children.map((c) => c.y + c.height)) + NODE_GAP : parent.y }
  }
  const y = parent.y + parent.height + RANK_GAP
  return { x: children.length ? Math.max(...children.map((c) => c.x + c.width)) + NODE_GAP : parent.x, y }
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

/**
 * The box after its `corner` was dragged by (dx, dy): the opposite corner stays put,
 * the box keeps at least the `min` size, and with a `grid` the dragged corner lands on it.
 */
export function resize(box: Box, corner: Corner, dx: number, dy: number, min: { width: number; height: number }, grid = 0): Box {
  const snap = (v: number) => (grid ? Math.round(v / grid) * grid : Math.round(v))
  const [right, bottom] = [box.x + box.width, box.y + box.height]
  const west = corner[1] === 'w'
  const north = corner[0] === 'n'
  const x = west ? Math.min(snap(box.x + dx), right - min.width) : box.x
  const y = north ? Math.min(snap(box.y + dy), bottom - min.height) : box.y
  return {
    x,
    y,
    width: west ? right - x : Math.max(snap(right + dx) - x, min.width),
    height: north ? bottom - y : Math.max(snap(bottom + dy) - y, min.height),
  }
}

type Placed = Box & { id: string; frame?: boolean }

/** What a Frame leaves free around what is in it; the top holds its title. */
export const FRAME_PADDING = { top: 40, side: 20, bottom: 20 }

/**
 * The Frame each Node or Frame is in, by id: the smallest Frame that holds its middle.
 * Nothing is stored about it: what lies in a Frame is in it.
 */
export function parentsOf(nodes: Placed[]): Record<string, string> {
  const area = (b: Box) => b.width * b.height
  const frames = nodes.filter((n) => n.frame).sort((a, b) => area(a) - area(b))
  const parents: Record<string, string> = {}
  for (const n of nodes) {
    const [cx, cy] = [n.x + n.width / 2, n.y + n.height / 2]
    // A Frame can only be in a larger one, so two Frames are never in each other.
    const parent = frames.find((f) => f.id !== n.id && (!n.frame || area(f) > area(n)) && cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height)
    if (parent) parents[n.id] = parent.id
  }
  return parents
}

/** Everything in the Frame `id`, at any depth. */
export function within(parents: Record<string, string>, id: string): string[] {
  const direct = Object.keys(parents).filter((child) => parents[child] === id)
  return direct.flatMap((child) => [child, ...within(parents, child)])
}

/** The box around all of `boxes`. */
export function around(boxes: Box[]): Box {
  const [x, y] = [Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y))]
  return { x, y, width: Math.max(...boxes.map((b) => b.x + b.width)) - x, height: Math.max(...boxes.map((b) => b.y + b.height)) - y }
}

/** The box of a Frame drawn around `boxes`, with room for its title. */
export function frameAround(boxes: Box[]): Box {
  const { x, y, width, height } = around(boxes)
  const { top, side, bottom } = FRAME_PADDING
  return { x: x - side, y: y - top, width: width + 2 * side, height: height + top + bottom }
}
