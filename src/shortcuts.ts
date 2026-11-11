export type ShortcutAction = 'filter' | 'new' | 'edit' | 'help' | 'next' | 'previous'

const KEYS: Record<string, ShortcutAction> = { '/': 'filter', n: 'new', e: 'edit', '?': 'help', j: 'next', k: 'previous' }
const ARROWS: Record<string, ShortcutAction> = { ArrowDown: 'next', ArrowUp: 'previous' }

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

/**
 * The action a key press asks for, or null. Single keys never fire while
 * typing, with a modifier held, while a dialog or the palette is open, or with the
 * focus anywhere in a Diagram (its canvas and its toolbar), which has keys of its own. The arrow keys count only on a list row, so they still scroll elsewhere.
 */
export function shortcutAction(e: KeyboardEvent): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return null
  const letter = /^[a-z]$/i.test(e.key)
  // Shift is how some keyboards reach `/` and `?`, so it only rules out the letters.
  if (letter && e.shiftKey) return null
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest(`${TYPING}, .diagram-canvas`)) return null
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return null
  if (e.key in ARROWS) return target?.closest('[data-testid="list-row"]') ? ARROWS[e.key] : null
  return KEYS[letter ? e.key.toLowerCase() : e.key] ?? null
}
