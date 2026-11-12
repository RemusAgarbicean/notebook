import { expect, test } from 'vitest'
import { findShapes, SHAPE_GROUPS, SHAPE_NAMES, SHAPES, shapeLayout, shapeOf, usedShape, type ShapeName } from './shapes'

// The flattened outline of a path made of M, L, C and Z: the points a polygon test needs.
function flatten(d: string): [number, number][] {
  const tokens = d.trim().split(/[\s,]+/)
  const points: [number, number][] = []
  let at: [number, number] = [0, 0]
  for (let i = 0; i < tokens.length; ) {
    const cmd = tokens[i++]
    const num = () => {
      const v = Number(tokens[i++])
      if (!Number.isFinite(v)) throw new Error(`not a number in ${d}`)
      return v
    }
    if (cmd === 'M' || cmd === 'L') points.push((at = [num(), num()]))
    else if (cmd === 'C') {
      const [c1, c2, end]: [number, number][] = [[num(), num()], [num(), num()], [num(), num()]]
      for (let s = 1; s <= 16; s++) {
        const t = s / 16
        const m = (k: 0 | 1) => (1 - t) ** 3 * at[k] + 3 * (1 - t) ** 2 * t * c1[k] + 3 * (1 - t) * t ** 2 * c2[k] + t ** 3 * end[k]
        points.push([m(0), m(1)])
      }
      at = end
    } else if (cmd !== 'Z') throw new Error(`unknown command ${cmd} in ${d}`)
  }
  return points
}

const inside = (poly: [number, number][], [x, y]: [number, number]) => {
  let odd = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [poly[i], poly[j]]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd
  }
  return odd
}

const sizes = (name: ShapeName) => {
  // A shape sized from its text alone has no usual size.
  const [w, h] = SHAPES[name].size.map((v, i) => v || [96, 64][i])
  return [[w, h], [w * 2, h], [w, h * 2], [w * 3, h * 3], [w / 2, h / 2]]
}

test('a Node without a shape, or with one this version does not know, is a rectangle', () => {
  expect(shapeOf(undefined)).toBe('rectangle')
  expect(shapeOf('hexagonal-prism')).toBe('rectangle')
  expect(shapeOf('toString')).toBe('rectangle')
  expect(shapeOf(7)).toBe('rectangle')
  expect(shapeOf('diamond')).toBe('diamond')
  expect(shapeOf('hexagon')).toBe('hexagon')
})

test('the shapes of the first version keep their stored names', () => {
  expect(SHAPE_NAMES.slice(0, 1)).toEqual(['rectangle'])
  expect(SHAPE_NAMES).toEqual(expect.arrayContaining(['rectangle', 'pill', 'diamond', 'cylinder', 'note']))
  expect(SHAPE_NAMES.length).toBeGreaterThanOrEqual(50)
})

test('every shape has a group, a name, and a drawing of only valid numbers at any size', () => {
  for (const name of SHAPE_NAMES) {
    const shape = SHAPES[name]
    expect(SHAPE_GROUPS, name).toContain(shape.group)
    expect(shape.label, name).toMatch(/^[A-Z]/)
    for (const [w, h] of sizes(name)) {
      const { fill, line } = shape.draw(w, h)
      for (const d of [...fill, ...(line ? [line] : [])]) {
        expect(d, name).toMatch(/^M /)
        expect(() => flatten(d), name).not.toThrow()
      }
      expect(fill.length || line, `${name} draws something`).toBeTruthy()
    }
  }
})

test('every drawing stays in its box, give or take a pixel', () => {
  for (const name of SHAPE_NAMES)
    for (const [w, h] of sizes(name)) {
      const { fill, line } = SHAPES[name].draw(w, h)
      for (const [x, y] of [...fill, ...(line ? [line] : [])].flatMap(flatten)) {
        expect(x, `${name} at ${w}x${h}`).toBeGreaterThanOrEqual(-1)
        expect(x, `${name} at ${w}x${h}`).toBeLessThanOrEqual(w + 1)
        expect(y, `${name} at ${w}x${h}`).toBeGreaterThanOrEqual(-1)
        expect(y, `${name} at ${w}x${h}`).toBeLessThanOrEqual(h + 1)
      }
    }
})

test("the text's box lies inside the shape's front outline at any size", () => {
  for (const name of SHAPE_NAMES) {
    const shape = SHAPES[name]
    if (shape.box || shape.below) continue
    const [t, r, b, l] = shape.inset
    expect(l + r, name).toBeLessThan(1)
    expect(t + b, name).toBeLessThan(1)
    for (const [w, h] of sizes(name)) {
      const front = shape.draw(w, h).fill.at(-1)
      // An open shape (a bracket) has no outline to be inside of: its box is the limit.
      if (!front) continue
      const poly = flatten(front)
      // A pixel in from each side: the diamond's corners touch its edges, and its pad keeps the text off them.
      // The pad, in px, counts too: a cylinder keeps its text under the lid that way.
      const [pt, pr, pb, pl] = shape.pad
      const [x0, x1, y0, y1] = [Math.max(l * w, pl) + 1, w - Math.max(r * w, pr) - 1, Math.max(t * h, pt) + 1, h - Math.max(b * h, pb) - 1]
      for (const p of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]] as [number, number][])
        expect(inside(poly, p), `${name} at ${w}x${h}: ${p}`).toBe(true)
    }
  }
})

test("a diamond's room around its text is what it was: half the text's size and a little more on each side", () => {
  for (const [width, height] of [[40, 16], [112, 18], [112, 200], [128, 46]]) {
    const { padding } = shapeLayout('diamond', { width, height }, undefined, 1)!
    expect(padding).toEqual([height / 2 + 4, width / 2 + 6, height / 2 + 4, width / 2 + 6])
    // A centred w by h box fits inside a W by H diamond when w/W + h/H <= 1.
    const [W, H] = [width + 2 * (width / 2 + 6), height + 2 * (height / 2 + 4)]
    expect(width / W + height / H).toBeLessThanOrEqual(1)
  }
})

test("a resized diamond gives its text the middle half of its width, as before", () => {
  const { padding, height } = shapeLayout('diamond', { width: 80, height: 30 }, { width: 180, height: 84 }, 1)!
  expect(padding[1]).toBe(44.5)
  expect(padding[3]).toBe(44.5)
  expect(height).toBe(84)
})

test("a cylinder keeps its lid's room above the text, as before", () => {
  expect(shapeLayout('cylinder', { width: 60, height: 15 }, undefined, 1)!.padding).toEqual([18.4, 12, 9.6, 12])
  expect(shapeLayout('cylinder', { width: 60, height: 15 }, { width: 200, height: 64 }, 2)!.padding).toEqual([18.4, 12, 9.6, 12])
})

test('the box shapes of the first version are drawn by the Node itself and need no layout', () => {
  for (const name of ['rectangle', 'pill', 'note'] as const) expect(shapeLayout(name, { width: 10, height: 10 }, undefined, 1)).toBeNull()
})

test('a shape grows with its text so the text stays inside, and is never smaller than its usual size', () => {
  const small = shapeLayout('hexagon', { width: 20, height: 15 }, undefined, 1)!
  expect([small.width, small.height]).toEqual([SHAPES.hexagon.size[0] + 2, SHAPES.hexagon.size[1] + 2])
  const big = shapeLayout('hexagon', { width: 200, height: 60 }, undefined, 1)!
  const [t, r, b, l] = SHAPES.hexagon.inset
  expect(big.width - 2 - big.padding[1] - big.padding[3]).toBeGreaterThanOrEqual(200)
  expect(big.padding[3]).toBeGreaterThanOrEqual(l * (big.width - 2))
  expect(big.padding[1]).toBeGreaterThanOrEqual(r * (big.width - 2))
  expect(big.padding[0]).toBeGreaterThanOrEqual(t * (big.height - 2))
  expect(big.padding[2]).toBeGreaterThanOrEqual(b * (big.height - 2))
})

test('a circle stays a circle however long its text', () => {
  expect(SHAPES.circle.aspect).toBe(true)
  expect(SHAPES.rectangle.aspect).toBeFalsy()
  for (const width of [10, 60, 128]) {
    const { width: w, height: h } = shapeLayout('circle', { width, height: 15 }, undefined, 1)!
    expect(w).toBeCloseTo(h)
  }
})

test("an actor's text goes below the figure, which keeps its usual height", () => {
  const { padding, figure, height } = shapeLayout('actor', { width: 80, height: 15 }, undefined, 1)!
  expect(figure).toBe(SHAPES.actor.size[1] + 1)
  expect(padding[0]).toBeGreaterThanOrEqual(SHAPES.actor.size[1])
  expect(height).toBe(padding[0] + 15 + padding[2] + 2)
})

test('the picker lists every shape by group, with the recently used ones first', () => {
  const all = findShapes('', [])
  expect(all.map((g) => g.group)).toEqual([...SHAPE_GROUPS])
  expect(all.flatMap((g) => g.names).sort()).toEqual([...SHAPE_NAMES].sort())

  const recent = usedShape(usedShape([], 'circle'), 'cloud')
  expect(recent).toEqual(['cloud', 'circle'])
  expect(usedShape(recent, 'circle')).toEqual(['circle', 'cloud'])
  expect(findShapes('', recent)[0]).toEqual({ group: 'Recent', names: ['cloud', 'circle'] })
})

test('only a few recent shapes are kept, and unknown names are dropped', () => {
  let recent: ShapeName[] = []
  for (const name of SHAPE_NAMES.slice(0, 12)) recent = usedShape(recent, name)
  expect(recent).toHaveLength(6)
  expect(recent[0]).toBe(SHAPE_NAMES[11])
  expect(findShapes('', ['nonsense', 'circle'])[0]).toEqual({ group: 'Recent', names: ['circle'] })
})

test('typing filters by name, words in any order, and by group', () => {
  const names = (q: string) => findShapes(q, []).flatMap((g) => g.names)
  expect(names('cyl')[0]).toBe('cylinder')
  expect(names('DOC')).toEqual(['document', 'documents'])
  expect(names('arrow left')).toEqual(expect.arrayContaining(['arrow-left', 'arrow-left-right']))
  expect(names('arrows')).toHaveLength(7)
  expect(names('rounded')).toEqual(expect.arrayContaining(['rounded', 'pill']))
  expect(names('zzz')).toEqual([])
  expect(findShapes('cyl', ['circle', 'cylinder'])[0]).toEqual({ group: 'Recent', names: ['cylinder'] })
})
