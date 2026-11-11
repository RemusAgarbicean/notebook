/**
 * Puts text on the clipboard. The clipboard API can refuse (a page opened from
 * `file://` in some browsers), so the old copy command is tried next. False
 * when both refuse: the caller then shows the text for the user to copy.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Refused or missing: try the old way.
  }
  const had = document.activeElement
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('aria-hidden', 'true')
  Object.assign(area.style, { position: 'fixed', top: '0', opacity: '0' })
  document.body.append(area)
  area.focus()
  area.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    // Refused as well.
  }
  area.remove()
  if (had instanceof HTMLElement) had.focus()
  return copied
}
