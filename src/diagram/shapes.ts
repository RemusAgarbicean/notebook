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
