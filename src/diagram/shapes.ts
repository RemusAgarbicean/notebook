/**
 * The shapes a Node can have. A Node stores the name (`data.shape`); the rectangle is the default and is not stored.
 * Each shape is drawn by `draw(w, h)`: SVG paths (only M, L, C and Z) for a w by h box. `fill` paths are filled and
 * outlined, back to front; `line` is outlined only. Its text sits in the `inset` part of the box (fractions of the
 * box left free at the top, right, bottom and left), with `pad` pixels around it, so it stays inside the shape.
 */
export type ShapeGroup = (typeof SHAPE_GROUPS)[number]
export const SHAPE_GROUPS = ['Basic', 'Flowchart', 'Data and systems', 'Annotation', 'Arrows', 'People'] as const

type Sides = [top: number, right: number, bottom: number, left: number]
export type Shape = {
  label: string
  group: ShapeGroup
  /** More words the picker finds it by. */
  words?: string
  /** `line` is the outline's width, for a shape that keeps a size in px (the cylinder's lid). */
  draw: (w: number, h: number, line?: number) => { fill: string[]; line?: string }
  /** Its usual size, in px: a Node is never smaller unless resized. */
  size: [number, number]
  inset: Sides
  pad: Sides
  /** The widest its text gets before it wraps, in px. */
  text: number
  /** A resize keeps the width-to-height ratio, and so does a long text. */
  aspect?: true
  /** The text goes below the drawing, not inside it. */
  below?: true
  /** Drawn by the Node's own CSS box, as in the first version: no SVG, no layout here. */
  box?: true
}

// --- Path helpers. Numbers are rounded to a tenth of a pixel.
type P = [number, number]
const f = (v: number) => String(Math.round(v * 10) / 10)
const pt = ([x, y]: P) => `${f(x)} ${f(y)}`
/** A path through `parts`: commands and points in px. */
const path = (...parts: (string | P)[]) => parts.map((p) => (typeof p === 'string' ? p : pt(p))).join(' ')
/** A closed polygon through unit points, scaled to w by h. */
const polygon =
  (...pts: P[]) =>
  (w: number, h: number) =>
    path('M', ...pts.flatMap(([x, y], i) => (i ? ['L', [x * w, y * h] as P] : [[x * w, y * h] as P])), 'Z')
/** Cubic segments along an ellipse from angle a0 to a1, in degrees, clockwise on screen from 3 o'clock. */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): string {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90))
  const out: string[] = []
  for (let s = 0; s < steps; s++) {
    const [t0, t1] = [a0 + ((a1 - a0) * s) / steps, a0 + ((a1 - a0) * (s + 1)) / steps].map((a) => (a * Math.PI) / 180)
    const k = (4 / 3) * Math.tan((t1 - t0) / 4)
    const on = (t: number): P => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]
    const [p0, p3] = [on(t0), on(t1)]
    out.push(
      path('C', [p0[0] - k * rx * Math.sin(t0), p0[1] + k * ry * Math.cos(t0)], [p3[0] + k * rx * Math.sin(t1), p3[1] - k * ry * Math.cos(t1)], p3),
    )
  }
  return out.join(' ')
}
const ellipse = (cx: number, cy: number, rx: number, ry: number) => path('M', [cx + rx, cy]) + ' ' + arc(cx, cy, rx, ry, 0, 360) + ' Z'
/** A rectangle with corners of radius r. */
function rounded(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2)
  return [
    path('M', [x + r, y], 'L', [x + w - r, y]),
    arc(x + w - r, y + r, r, r, 270, 360),
    path('L', [x + w, y + h - r]),
    arc(x + w - r, y + h - r, r, r, 0, 90),
    path('L', [x + r, y + h]),
    arc(x + r, y + h - r, r, r, 90, 180),
    path('L', [x, y + r]),
    arc(x + r, y + r, r, r, 180, 270),
    'Z',
  ].join(' ')
}
const rect = (x: number, y: number, w: number, h: number) => path('M', [x, y], 'L', [x + w, y], 'L', [x + w, y + h], 'L', [x, y + h], 'Z')
const one = (draw: (w: number, h: number) => string) => (w: number, h: number) => ({ fill: [draw(w, h)] })
/** A page with a wavy bottom edge. */
const page = (x: number, y: number, w: number, h: number) =>
  path('M', [x, y], 'L', [x + w, y], 'L', [x + w, y + 0.86 * h], 'C', [x + 0.7 * w, y + 0.72 * h], [x + 0.35 * w, y + 1.06 * h], [x, y + 0.9 * h], 'Z')
function cylinder(w: number, h: number, cap: number) {
  const c = Math.min(cap, h / 4)
  return path('M', [0, c]) + ' ' + arc(w / 2, c, w / 2, c, 180, 360) + ' ' + path('L', [w, h - c]) + ' ' + arc(w / 2, h - c, w / 2, c, 0, 180) + ' Z'
}
const frontArc = (w: number, y: number, c: number) => path('M', [0, y]) + ' ' + arc(w / 2, y, w / 2, c, 180, 0)
// A five-pointed star with fat arms, fitted to the unit square.
const STAR: P[] = (() => {
  const pts: P[] = Array.from({ length: 10 }, (_, i) => {
    const [a, r] = [-Math.PI / 2 + (i * Math.PI) / 5, i % 2 ? 0.5 : 1]
    return [r * Math.cos(a), r * Math.sin(a)]
  })
  const [xs, ys] = [pts.map((p) => p[0]), pts.map((p) => p[1])]
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  return pts.map(([x, y]) => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)])
})()

const PAD: Sides = [4, 6, 4, 6]
const def = (s: Omit<Shape, 'pad' | 'text' | 'inset'> & Partial<Pick<Shape, 'pad' | 'text' | 'inset'>>): Shape => ({ inset: [0, 0, 0, 0], pad: PAD, text: 128, ...s })
const BOX = { box: true } as const

export const SHAPES = {
  // --- Basic
  rectangle: def({ label: 'Rectangle', group: 'Basic', words: 'box square', ...BOX, size: [112, 36], draw: one((w, h) => rect(0, 0, w, h)) }),
  rounded: def({ label: 'Rounded rectangle', group: 'Basic', ...BOX, size: [112, 36], draw: one((w, h) => rounded(0, 0, w, h, 10)) }),
  pill: def({ label: 'Pill', group: 'Basic', words: 'rounded stadium', ...BOX, size: [112, 36], draw: one((w, h) => rounded(0, 0, w, h, h / 2)) }),
  circle: def({ label: 'Circle', group: 'Basic', words: 'round', size: [80, 80], aspect: true, inset: [0.16, 0.16, 0.16, 0.16], draw: one((w, h) => ellipse(w / 2, h / 2, w / 2, h / 2)) }),
  ellipse: def({ label: 'Ellipse', group: 'Basic', words: 'oval round', size: [120, 64], inset: [0.16, 0.16, 0.16, 0.16], draw: one((w, h) => ellipse(w / 2, h / 2, w / 2, h / 2)) }),
  triangle: def({ label: 'Triangle', group: 'Basic', size: [96, 80], inset: [0.5, 0.27, 0.08, 0.27], draw: one(polygon([0.5, 0], [1, 1], [0, 1])) }),
  'right-triangle': def({ label: 'Right triangle', group: 'Basic', size: [96, 80], inset: [0.45, 0.58, 0.08, 0.06], draw: one(polygon([0, 0], [1, 1], [0, 1])) }),
  pentagon: def({ label: 'Pentagon', group: 'Basic', size: [84, 80], aspect: true, inset: [0.3, 0.2, 0.08, 0.2], draw: one(polygon([0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38])) }),
  hexagon: def({ label: 'Hexagon', group: 'Basic', size: [104, 64], inset: [0.1, 0.22, 0.1, 0.22], draw: one(polygon([0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5])) }),
  octagon: def({ label: 'Octagon', group: 'Basic', words: 'stop', size: [80, 80], aspect: true, inset: [0.16, 0.16, 0.16, 0.16], draw: one(polygon([0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29])) }),
  star: def({ label: 'Star', group: 'Basic', size: [88, 84], aspect: true, inset: [0.4, 0.33, 0.3, 0.33], text: 64, draw: one(polygon(...STAR)) }),
  plus: def({ label: 'Plus', group: 'Basic', words: 'cross add', size: [80, 80], aspect: true, inset: [0.33, 0.04, 0.33, 0.04], draw: one(polygon([0.3, 0], [0.7, 0], [0.7, 0.3], [1, 0.3], [1, 0.7], [0.7, 0.7], [0.7, 1], [0.3, 1], [0.3, 0.7], [0, 0.7], [0, 0.3], [0.3, 0.3])) }),
  parallelogram: def({ label: 'Parallelogram', group: 'Basic', words: 'slanted', size: [112, 56], inset: [0.08, 0.2, 0.08, 0.2], draw: one(polygon([0.2, 0], [1, 0], [0.8, 1], [0, 1])) }),
  trapezoid: def({ label: 'Trapezoid', group: 'Basic', size: [112, 56], inset: [0.08, 0.2, 0.08, 0.2], draw: one(polygon([0.2, 0], [0.8, 0], [1, 1], [0, 1])) }),

  // --- Flowchart
  terminator: def({ label: 'Terminator', group: 'Flowchart', words: 'start end begin stop pill', size: [112, 44], inset: [0.12, 0.2, 0.12, 0.2], draw: one((w, h) => rounded(0, 0, w, h, Math.min(w, h) / 2)) }),
  process: def({ label: 'Process', group: 'Flowchart', words: 'step rectangle box', ...BOX, size: [112, 36], draw: one((w, h) => rect(0, 0, w, h)) }),
  // Sized from its text alone (no usual size), as in the first version.
  diamond: def({ label: 'Decision', group: 'Flowchart', words: 'diamond rhombus question if', size: [0, 0], inset: [0.25, 0.25, 0.25, 0.25], draw: one(polygon([0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5])) }),
  data: def({ label: 'Data', group: 'Flowchart', words: 'input output parallelogram', size: [112, 56], inset: [0.08, 0.2, 0.08, 0.2], draw: one(polygon([0.2, 0], [1, 0], [0.8, 1], [0, 1])) }),
  document: def({ label: 'Document', group: 'Flowchart', words: 'page report', size: [104, 64], inset: [0.08, 0.06, 0.22, 0.06], draw: one((w, h) => page(0, 0, w, h)) }),
  documents: def({
    label: 'Multiple documents', group: 'Flowchart', words: 'pages reports', size: [112, 72], inset: [0.2, 0.18, 0.22, 0.06],
    draw: (w, h) => ({ fill: [page(0.12 * w, 0, 0.88 * w, 0.88 * h), page(0.06 * w, 0.06 * h, 0.88 * w, 0.88 * h), page(0, 0.12 * h, 0.88 * w, 0.88 * h)] }),
  }),
  predefined: def({
    label: 'Predefined process', group: 'Flowchart', words: 'subroutine function', size: [120, 48], inset: [0.06, 0.12, 0.06, 0.12],
    draw: (w, h) => ({ fill: [rect(0, 0, w, h)], line: path('M', [0.08 * w, 0], 'L', [0.08 * w, h], 'M', [0.92 * w, 0], 'L', [0.92 * w, h]) }),
  }),
  'manual-input': def({ label: 'Manual input', group: 'Flowchart', words: 'keyboard', size: [112, 56], inset: [0.34, 0.06, 0.08, 0.06], draw: one(polygon([0, 0.3], [1, 0], [1, 1], [0, 1])) }),
  'manual-operation': def({ label: 'Manual operation', group: 'Flowchart', words: 'trapezoid', size: [112, 56], inset: [0.08, 0.2, 0.08, 0.2], draw: one(polygon([0, 0], [1, 0], [0.8, 1], [0.2, 1])) }),
  preparation: def({ label: 'Preparation', group: 'Flowchart', words: 'hexagon setup', size: [120, 48], inset: [0.08, 0.15, 0.08, 0.15], draw: one(polygon([0.12, 0], [0.88, 0], [1, 0.5], [0.88, 1], [0.12, 1], [0, 0.5])) }),
  delay: def({
    label: 'Delay', group: 'Flowchart', words: 'wait', size: [104, 56], inset: [0.12, 0.17, 0.12, 0.06],
    draw: one((w, h) => path('M', [0, 0], 'L', [0.65 * w, 0]) + ' ' + arc(0.65 * w, h / 2, 0.35 * w, h / 2, 270, 450) + ' ' + path('L', [0, h], 'Z')),
  }),
  display: def({
    label: 'Display', group: 'Flowchart', words: 'screen monitor', size: [112, 56], inset: [0.12, 0.1, 0.12, 0.15],
    draw: one((w, h) => path('M', [0, h / 2], 'L', [0.15 * w, 0], 'L', [0.85 * w, 0], 'C', [1.03 * w, 0], [1.03 * w, h], [0.85 * w, h], 'L', [0.15 * w, h], 'Z')),
  }),
  'stored-data': def({
    label: 'Stored data', group: 'Flowchart', words: 'storage', size: [112, 56], inset: [0.1, 0.16, 0.1, 0.12],
    draw: one((w, h) => path('M', [0.15 * w, 0], 'L', [w, 0], 'C', [0.85 * w, 0.1 * h], [0.85 * w, 0.9 * h], [w, h], 'L', [0.15 * w, h], 'C', [-0.05 * w, 0.9 * h], [-0.05 * w, 0.1 * h], [0.15 * w, 0], 'Z')),
  }),
  'internal-storage': def({
    label: 'Internal storage', group: 'Flowchart', words: 'memory', size: [96, 64], inset: [0.24, 0.06, 0.06, 0.18],
    draw: (w, h) => ({ fill: [rect(0, 0, w, h)], line: path('M', [0.14 * w, 0], 'L', [0.14 * w, h], 'M', [0, 0.2 * h], 'L', [w, 0.2 * h]) }),
  }),
  connector: def({ label: 'Connector', group: 'Flowchart', words: 'circle on-page', size: [40, 40], aspect: true, text: 64, inset: [0.16, 0.16, 0.16, 0.16], draw: one((w, h) => ellipse(w / 2, h / 2, w / 2, h / 2)) }),
  'off-page': def({ label: 'Off-page connector', group: 'Flowchart', words: 'page', size: [56, 64], text: 64, inset: [0.08, 0.1, 0.38, 0.1], draw: one(polygon([0, 0], [1, 0], [1, 0.65], [0.5, 1], [0, 0.65])) }),
  merge: def({ label: 'Merge', group: 'Flowchart', words: 'triangle down', size: [80, 64], text: 64, inset: [0.06, 0.27, 0.5, 0.27], draw: one(polygon([0, 0], [1, 0], [0.5, 1])) }),
  extract: def({ label: 'Extract', group: 'Flowchart', words: 'triangle up', size: [80, 64], text: 64, inset: [0.5, 0.27, 0.06, 0.27], draw: one(polygon([0.5, 0], [1, 1], [0, 1])) }),
  or: def({
    label: 'Or', group: 'Flowchart', words: 'circle cross', size: [48, 48], aspect: true, text: 64, inset: [0.16, 0.16, 0.16, 0.16],
    draw: (w, h) => ({ fill: [ellipse(w / 2, h / 2, w / 2, h / 2)], line: path('M', [w / 2, 0], 'L', [w / 2, h], 'M', [0, h / 2], 'L', [w, h / 2]) }),
  }),
  'summing-junction': def({
    label: 'Summing junction', group: 'Flowchart', words: 'circle cross and', size: [48, 48], aspect: true, text: 64, inset: [0.16, 0.16, 0.16, 0.16],
    draw: (w, h) => {
      const [a, b] = [0.5 - Math.SQRT1_2 / 2, 0.5 + Math.SQRT1_2 / 2]
      return { fill: [ellipse(w / 2, h / 2, w / 2, h / 2)], line: path('M', [a * w, a * h], 'L', [b * w, b * h], 'M', [b * w, a * h], 'L', [a * w, b * h]) }
    },
  }),

  // --- Data and systems
  // The lid has the height the first version gave it, 0.45rem, at any size.
  cylinder: def({
    label: 'Cylinder', group: 'Data and systems', words: 'database storage', size: [0, 0], pad: [18.4, 12, 9.6, 12], text: 198,
    draw: (w, h, line = 1) => {
      const c = Math.min(7.2 - line / 2, h / 4)
      return { fill: [cylinder(w, h, c)], line: frontArc(w, c, c) }
    },
  }),
  'database-stack': def({
    label: 'Database stack', group: 'Data and systems', words: 'cylinder disks', size: [96, 96], inset: [0.5, 0.04, 0.12, 0.04],
    draw: (w, h) => ({ fill: [cylinder(w, h, 0.1 * h)], line: [0.1, 0.24, 0.38].map((y) => frontArc(w, y * h, 0.1 * h)).join(' ') }),
  }),
  queue: def({
    label: 'Queue', group: 'Data and systems', words: 'cylinder horizontal tube', size: [120, 56], inset: [0.08, 0.22, 0.08, 0.06],
    draw: (w, h) => ({
      fill: [path('M', [0.1 * w, 0], 'L', [0.9 * w, 0]) + ' ' + arc(0.9 * w, h / 2, 0.1 * w, h / 2, 270, 450) + ' ' + path('L', [0.1 * w, h]) + ' ' + arc(0.1 * w, h / 2, 0.1 * w, h / 2, 90, 270) + ' Z'],
      line: path('M', [0.9 * w, 0]) + ' ' + arc(0.9 * w, h / 2, 0.1 * w, h / 2, 270, 90),
    }),
  }),
  server: def({
    label: 'Server', group: 'Data and systems', words: 'machine host rack', size: [72, 96], inset: [0.44, 0.08, 0.06, 0.08],
    draw: (w, h) => {
      const r = Math.min(0.03 * h, 0.06 * w, 3)
      return { fill: [rect(0, 0, w, h)], line: [path('M', [0, 0.2 * h], 'L', [w, 0.2 * h], 'M', [0, 0.4 * h], 'L', [w, 0.4 * h]), ellipse(0.82 * w, 0.1 * h, r, r), ellipse(0.82 * w, 0.3 * h, r, r)].join(' ') }
    },
  }),
  cloud: def({
    label: 'Cloud', group: 'Data and systems', words: 'internet saas', size: [128, 80], inset: [0.4, 0.2, 0.06, 0.2],
    draw: one((w, h) => {
      const u = ([x, y]: P): P => [x * w, y * h]
      return path('M', u([0.25, 1]), 'C', u([0.05, 1]), u([0.02, 0.62]), u([0.17, 0.55]), 'C', u([0.1, 0.25]), u([0.38, 0.08]), u([0.5, 0.25]), 'C', u([0.6, 0]), u([0.95, 0.05]), u([0.88, 0.4]), 'C', u([1.04, 0.45]), u([1.02, 1]), u([0.8, 1]), 'Z')
    }),
  }),
  component: def({
    label: 'Component', group: 'Data and systems', words: 'module uml', size: [112, 64], inset: [0.1, 0.06, 0.1, 0.28],
    draw: (w, h) => ({ fill: [rect(0, 0.2 * h, 0.24 * w, 0.18 * h), rect(0, 0.62 * h, 0.24 * w, 0.18 * h), rect(0.12 * w, 0, 0.88 * w, h)] }),
  }),
  folder: def({ label: 'Folder', group: 'Data and systems', words: 'package directory', size: [104, 64], inset: [0.26, 0.06, 0.06, 0.06], draw: one(polygon([0, 0], [0.38, 0], [0.45, 0.18], [1, 0.18], [1, 1], [0, 1])) }),

  // --- Annotation
  'folded-note': def({
    label: 'Note', group: 'Annotation', words: 'sticky folded corner comment', size: [104, 64], inset: [0.14, 0.12, 0.06, 0.06],
    draw: (w, h) => {
      const c = Math.min(14, 0.2 * w, 0.3 * h)
      return { fill: [path('M', [0, 0], 'L', [w - c, 0], 'L', [w, c], 'L', [w, h], 'L', [0, h], 'Z')], line: path('M', [w - c, 0], 'L', [w - c, c], 'L', [w, c]) }
    },
  }),
  speech: def({
    label: 'Speech bubble', group: 'Annotation', words: 'say talk comment', size: [112, 64], inset: [0.08, 0.06, 0.33, 0.06],
    draw: one((w, h) => {
      const [b, r] = [0.75 * h, Math.min(8, w / 4, 0.18 * h)]
      return [
        path('M', [r, 0], 'L', [w - r, 0]), arc(w - r, r, r, r, 270, 360), path('L', [w, b - r]), arc(w - r, b - r, r, r, 0, 90),
        path('L', [0.42 * w, b], 'L', [0.2 * w, h], 'L', [0.26 * w, b], 'L', [r, b]), arc(r, b - r, r, r, 90, 180), path('L', [0, r]), arc(r, r, r, r, 180, 270), 'Z',
      ].join(' ')
    }),
  }),
  callout: def({
    label: 'Callout', group: 'Annotation', words: 'pointer comment', size: [120, 64], inset: [0.08, 0.04, 0.38, 0.24],
    draw: (w, h) => ({ fill: [rect(0.2 * w, 0, 0.8 * w, 0.7 * h)], line: path('M', [0.3 * w, 0.7 * h], 'L', [0, h]) }),
  }),
  bracket: def({
    label: 'Bracket', group: 'Annotation', words: 'comment brace', size: [104, 56], inset: [0.06, 0.04, 0.06, 0.1],
    draw: (w, h) => {
      const arm = Math.min(12, 0.3 * w)
      return { fill: [], line: path('M', [arm, 0], 'L', [0, 0], 'L', [0, h], 'L', [arm, h]) }
    },
  }),
  note: def({ label: 'Text', group: 'Annotation', words: 'text note label plain no border', ...BOX, size: [112, 36], draw: (w, h) => ({ fill: [], line: path('M', [0.3 * w, 0.2 * h], 'L', [0.7 * w, 0.2 * h], 'M', [w / 2, 0.2 * h], 'L', [w / 2, 0.85 * h]) }) }),

  // --- Arrows
  'arrow-right': def({ label: 'Arrow right', group: 'Arrows', size: [112, 56], inset: [0.32, 0.15, 0.32, 0.03], draw: one(polygon([0, 0.3], [0.65, 0.3], [0.65, 0], [1, 0.5], [0.65, 1], [0.65, 0.7], [0, 0.7])) }),
  'arrow-left': def({ label: 'Arrow left', group: 'Arrows', size: [112, 56], inset: [0.32, 0.03, 0.32, 0.15], draw: one(polygon([1, 0.3], [0.35, 0.3], [0.35, 0], [0, 0.5], [0.35, 1], [0.35, 0.7], [1, 0.7])) }),
  'arrow-up': def({ label: 'Arrow up', group: 'Arrows', size: [64, 104], text: 64, inset: [0.15, 0.32, 0.03, 0.32], draw: one(polygon([0.3, 1], [0.3, 0.35], [0, 0.35], [0.5, 0], [1, 0.35], [0.7, 0.35], [0.7, 1])) }),
  'arrow-down': def({ label: 'Arrow down', group: 'Arrows', size: [64, 104], text: 64, inset: [0.03, 0.32, 0.15, 0.32], draw: one(polygon([0.3, 0], [0.3, 0.65], [0, 0.65], [0.5, 1], [1, 0.65], [0.7, 0.65], [0.7, 0])) }),
  'arrow-left-right': def({
    label: 'Arrow left and right', group: 'Arrows', words: 'both double', size: [128, 56], inset: [0.32, 0.15, 0.32, 0.15],
    draw: one(polygon([0, 0.5], [0.25, 0], [0.25, 0.3], [0.75, 0.3], [0.75, 0], [1, 0.5], [0.75, 1], [0.75, 0.7], [0.25, 0.7], [0.25, 1])),
  }),
  chevron: def({ label: 'Chevron', group: 'Arrows', words: 'step', size: [112, 56], inset: [0.1, 0.2, 0.1, 0.27], draw: one(polygon([0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5])) }),
  'block-arrow': def({ label: 'Block arrow', group: 'Arrows', words: 'pentagon home plate tag', size: [112, 56], inset: [0.1, 0.22, 0.1, 0.06], draw: one(polygon([0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1])) }),

  // --- People: the drawing scales with its height and stays centred, however wide the text below makes the Node.
  actor: def({
    label: 'Actor', group: 'People', words: 'stick figure user role', size: [40, 56], below: true,
    draw: (w, h) => {
      const [c, s] = [w / 2, Math.min(h, 2 * w)]
      const y = (v: number) => h - s + v * s
      return {
        fill: [ellipse(c, y(0.13), 0.12 * s, 0.12 * s)],
        line: path('M', [c, y(0.25)], 'L', [c, y(0.62)], 'M', [c - 0.25 * s, y(0.38)], 'L', [c + 0.25 * s, y(0.38)], 'M', [c - 0.2 * s, y(1)], 'L', [c, y(0.62)], 'L', [c + 0.2 * s, y(1)]),
      }
    },
  }),
  person: def({
    label: 'Person', group: 'People', words: 'user head shoulders', size: [48, 44], below: true,
    draw: (w, h) => {
      const [c, s] = [w / 2, Math.min(h, w / 0.9)]
      const y = (v: number) => h - s + v * s
      return { fill: [path('M', [c - 0.45 * s, h], 'C', [c - 0.45 * s, y(0.5)], [c + 0.45 * s, y(0.5)], [c + 0.45 * s, h], 'Z'), ellipse(c, y(0.27), 0.22 * s, 0.22 * s)] }
    },
  }),
} as const satisfies Record<string, Shape>

export type ShapeName = keyof typeof SHAPES
export const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[]

/** The shape to draw for a stored name: the rectangle for none or an unknown one. */
export const shapeOf = (name: unknown): ShapeName =>
  typeof name === 'string' && Object.hasOwn(SHAPES, name) ? (name as ShapeName) : 'rectangle'

export type ShapeLayout = {
  /** The Node's padding around its text, in px: top, right, bottom, left. */
  padding: Sides
  /** Its smallest size, border included. */
  width: number
  height: number
  /** How far down from the top the drawing goes, border included; the text is below it for a `below` shape. */
  figure: number
}

/**
 * Where a Node's text goes and how big the Node is, from the size of its text and, if resized, its stored size:
 * the text stays in the shape's inset area. `line` is the border's width. Null for a box shape (CSS draws it).
 */
export function shapeLayout(name: ShapeName, text: { width: number; height: number }, resized: { width: number; height?: number } | undefined, line: number): ShapeLayout | null {
  const shape: Shape = SHAPES[name]
  if (shape.box) return null
  const [t, r, b, l] = shape.inset
  const [pt, pr, pb, pl] = shape.pad
  const [sw, sh] = shape.size
  const fixed = resized ? [resized.width - 2 * line, (resized.height ?? 0) - 2 * line] : [0, 0]
  if (shape.below) {
    const w = resized ? fixed[0] : Math.max(sw, text.width + pl + pr)
    const h = Math.max(fixed[1], sh + text.height + pt + pb)
    const figure = h - text.height - pt - pb
    return { padding: [figure + pt, pr, pb, pl], width: w + 2 * line, height: h + 2 * line, figure: figure + line }
  }
  // The size at which the text just fits the inset area with its pad.
  const needW = text.width / (1 - l - r) + pl + pr
  const needH = text.height / (1 - t - b) + pt + pb
  let [w, h] = resized ? [fixed[0], Math.max(fixed[1], needH)] : [Math.max(sw, needW), Math.max(sh, needH)]
  if (shape.aspect && !resized) {
    const k = Math.max(w / sw, h / sh)
    ;[w, h] = [sw * k, sh * k]
  }
  // A resized Node's text wraps to its width, so the inset area only has to keep at least the pad.
  const side = (p: number, frac: number, size: number, pads: number) => (resized ? Math.max(p, frac * size) : p + frac * (size - pads))
  const padding: Sides = [pt + t * (h - pt - pb), side(pr, r, w, pl + pr), pb + b * (h - pt - pb), side(pl, l, w, pl + pr)]
  return { padding, width: w + 2 * line, height: h + 2 * line, figure: h + 2 * line }
}

/** Every word of the query is in the shape's name, its other words or its group. */
const matches = (name: ShapeName, words: string[]) => {
  const { label, words: more = '', group } = SHAPES[name] as Shape
  const text = `${label} ${more} ${group} ${name}`.toLowerCase()
  return words.every((w) => text.includes(w))
}

/** What the shape picker lists for a query: the recent shapes first, then each group, only those that match. */
export function findShapes(query: string, recent: readonly string[]): { group: 'Recent' | ShapeGroup; names: ShapeName[] }[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const known = recent.filter((n): n is ShapeName => shapeOf(n) === n)
  return [
    { group: 'Recent' as const, names: known.filter((n) => matches(n, words)) },
    ...SHAPE_GROUPS.map((group) => ({ group, names: SHAPE_NAMES.filter((n) => SHAPES[n].group === group && matches(n, words)) })),
  ].filter((g) => g.names.length)
}

/** The recent shapes after `name` was used: it first, at most six. */
export const usedShape = (recent: readonly string[], name: ShapeName): ShapeName[] =>
  [name, ...recent.filter((n): n is ShapeName => n !== name && shapeOf(n) === n)].slice(0, 6)
