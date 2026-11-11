/** The Node fill palette. A Node stores the name; the shades live only here. */
const FILLS = {
  grey: { light: '#e4e4e7', dark: '#52525b' },
  red: { light: '#fecaca', dark: '#991b1b' },
  orange: { light: '#fed7aa', dark: '#9a3412' },
  green: { light: '#bbf7d0', dark: '#166534' },
  blue: { light: '#bfdbfe', dark: '#1e40af' },
  purple: { light: '#e9d5ff', dark: '#6b21a8' },
} as const

export type FillName = keyof typeof FILLS
export const FILL_NAMES = Object.keys(FILLS) as FillName[]

/**
 * The CSS variables for a fill: both shades, so CSS picks one by theme and the
 * PNG export can force the light one. Empty for no fill or an unknown name.
 */
export function fillVars(name: unknown): Record<string, string> {
  if (typeof name !== 'string' || !Object.hasOwn(FILLS, name)) return {}
  const { light, dark } = FILLS[name as FillName]
  return { '--fill-light': light, '--fill-dark': dark }
}
