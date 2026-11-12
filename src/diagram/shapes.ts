/** The shapes a Node can have. A Node stores the name; the rectangle is the default and is not stored. */
export const SHAPES = {
  rectangle: 'Rectangle',
  pill: 'Rounded',
  diamond: 'Diamond',
  cylinder: 'Cylinder',
  note: 'Text note',
} as const

export type ShapeName = keyof typeof SHAPES
export const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[]

/** The shape to draw for a stored name: the rectangle for none or an unknown one. */
export const shapeOf = (name: unknown): ShapeName =>
  typeof name === 'string' && Object.hasOwn(SHAPES, name) ? (name as ShapeName) : 'rectangle'

/**
 * The padding, in px, around a diamond's w by h text: half the text's size on
 * each side (and a little more) makes the diamond twice as wide and high as
 * the text, whose box then sits inside it corner to edge.
 */
export const diamondPadding = (w: number, h: number) => ({ block: h / 2 + 4, inline: w / 2 + 6 })
