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
