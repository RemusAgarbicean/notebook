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
