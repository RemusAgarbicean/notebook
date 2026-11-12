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
 * With `aspect`, it keeps its proportions instead, scaled by the larger of the two pulls, and ignores the grid.
 */
export function resize(box: Box, corner: Corner, dx: number, dy: number, min: { width: number; height: number }, grid = 0, aspect = false): Box {
  if (aspect) {
    const [sx, sy] = [(box.width + (corner[1] === 'w' ? -dx : dx)) / box.width, (box.height + (corner[0] === 'n' ? -dy : dy)) / box.height]
    const k = Math.max(sx, sy, min.width / box.width, min.height / box.height)
    const [width, height] = [Math.round(box.width * k), Math.round(box.height * k)]
    return { x: corner[1] === 'w' ? box.x + box.width - width : box.x, y: corner[0] === 'n' ? box.y + box.height - height : box.y, width, height }
  }
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

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** New top-left corners, by id, that line the boxes up: on the edge of the outermost one, or on the middle of them all. */
export function align(boxes: Placed[], how: Alignment): Record<string, Point> {
  const all = around(boxes)
  const to: Record<Alignment, (b: Box) => Point> = {
    left: (b) => ({ x: all.x, y: b.y }),
    center: (b) => ({ x: all.x + (all.width - b.width) / 2, y: b.y }),
    right: (b) => ({ x: all.x + all.width - b.width, y: b.y }),
    top: (b) => ({ x: b.x, y: all.y }),
    middle: (b) => ({ x: b.x, y: all.y + (all.height - b.height) / 2 }),
    bottom: (b) => ({ x: b.x, y: all.y + all.height - b.height }),
  }
  return Object.fromEntries(boxes.map((b) => [b.id, to[how](b)]))
}

/** New top-left corners, by id, with the same gap between each box and the next along the axis; the outermost two stay. */
export function distribute(boxes: Placed[], axis: 'x' | 'y'): Record<string, Point> {
  const size = axis === 'x' ? 'width' : 'height'
  const sorted = [...boxes].sort((a, b) => a[axis] - b[axis])
  const [first, last] = [sorted[0], sorted.at(-1)!]
  const free = last[axis] + last[size] - first[axis] - sorted.reduce((sum, b) => sum + b[size], 0)
  const gap = free / Math.max(sorted.length - 1, 1)
  let at = first[axis]
  return Object.fromEntries(
    sorted.map((b) => {
      const corner = { x: b.x, y: b.y, [axis]: at }
      at += b[size] + gap
      return [b.id, corner]
    }),
  )
}
