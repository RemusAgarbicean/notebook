type Spot = { left: number; top: number; bottom: number }

const GAP = 4 // between the caret's line and the popup
const EDGE = 8 // kept free at the viewport's sides

/**
 * Where a popup of `size` goes for a caret at `caret`, all in viewport
 * coordinates: below the caret's line, above it when only that fits, and
 * moved left or right to stay inside the viewport.
 */
export function placePopup(
  caret: Spot,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const below = caret.bottom + GAP
  const above = caret.top - GAP - size.height
  return {
    left: Math.max(EDGE, Math.min(caret.left, viewport.width - size.width - EDGE)),
    top: below + size.height > viewport.height && above >= 0 ? above : below,
  }
}

// What decides where the text wraps and how tall a line is.
const COPIED = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'tabSize',
  'textIndent',
  'textTransform',
  'wordSpacing',
] as const

/**
 * The viewport position of the caret at `position` in a textarea. A textarea
 * can't say, so the text before the caret is laid out in a hidden copy of it
 * and a marker at its end is measured.
 */
export function caretSpot(area: HTMLTextAreaElement, position: number): Spot {
  const style = getComputedStyle(area)
  const mirror = document.createElement('div')
  for (const p of COPIED) mirror.style[p] = style[p]
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    boxSizing: 'content-box',
    // clientWidth leaves out a scrollbar, which narrows the lines.
    width: `${area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  })
  mirror.textContent = area.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.append(marker)
  document.body.append(mirror)
  const box = area.getBoundingClientRect()
  const left = box.left + area.clientLeft + marker.offsetLeft - area.scrollLeft
  const top = box.top + area.clientTop + marker.offsetTop - area.scrollTop
  const bottom = top + marker.offsetHeight
  mirror.remove()
  return { left, top, bottom }
}
