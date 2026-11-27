/**
 * The border styles a Node or Frame can have. A Node stores the name; the solid line, the
 * default, is stored as nothing, so a Diagram saved before borders existed looks as it did.
 */
export const BORDER_NAMES = ['solid', 'dashed', 'dotted', 'none'] as const
export type BorderName = (typeof BORDER_NAMES)[number]
/** What a Node stores: only a border that is not solid. */
export type StoredBorder = Exclude<BorderName, 'solid'>

/** The border to draw for a stored value: solid for none or an unknown one. */
export const borderOf = (stored: unknown): BorderName =>
  typeof stored === 'string' && (BORDER_NAMES as readonly string[]).includes(stored) ? (stored as BorderName) : 'solid'

/** The value to store for a border: undefined, so left out of the JSON, for solid. */
export const storedBorder = (name: BorderName): StoredBorder | undefined => (name === 'solid' ? undefined : name)

/** The CSS class a Node or Frame gets for its border; none for solid. */
export const borderClass = (stored: unknown): string | undefined => {
  const name = borderOf(stored)
  return name === 'solid' ? undefined : `border-${name}-line`
}
