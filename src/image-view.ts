import type { Directive } from 'vue'
import { imageData, imageInfo } from './images'

/** A blob URL for an Image's bytes, or null when the Image is gone. Whoever asks revokes it. */
export function imageUrl(id: number): string | null {
  const data = imageData(id)
  return data && URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: imageInfo(id)?.mime }))
}

const shown = new WeakMap<HTMLElement, Map<number, string>>()

// Gives every `<img data-image>` inside `el` its picture and revokes the URLs of those no longer there.
function fill(el: HTMLElement, show = true) {
  const had = shown.get(el) ?? new Map<number, string>()
  const now = new Map<number, string>()
  for (const img of show ? el.querySelectorAll<HTMLImageElement>('img[data-image]') : []) {
    const id = Number(img.dataset.image)
    const url = now.get(id) ?? had.get(id) ?? imageUrl(id)
    if (!url) continue
    now.set(id, url)
    if (img.getAttribute('src') !== url) img.src = url
    // Opens in the viewer, by click or by key.
    img.tabIndex = 0
    img.setAttribute('role', 'button')
  }
  for (const [id, url] of had) if (!now.has(id)) URL.revokeObjectURL(url)
  shown.set(el, now)
}

/**
 * For an element showing `renderMarkdown` HTML: its Images get blob URLs made from the stored bytes,
 * so showing them asks nothing of the network, and the URLs are revoked once the Images are no longer shown.
 */
export const vImages: Directive<HTMLElement> = {
  mounted: (el) => fill(el),
  updated: (el) => fill(el),
  unmounted: (el) => fill(el, false),
}

// A file dropped beside the textarea must not make the browser open it in place of the app.
for (const type of ['dragover', 'drop'] as const)
  window.addEventListener(type, (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    if (!(e.target as Element).closest?.('textarea')) e.dataTransfer.dropEffect = 'none'
  })
