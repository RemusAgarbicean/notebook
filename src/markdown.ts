import DOMPurify from 'dompurify'
import { Marked } from 'marked'

/** The app's markdown parser. Extend it with `markdown.use(...)` (e.g. the Mention syntax). */
export const markdown = new Marked({ gfm: true, breaks: true })

// A link in notes must not navigate away from the app, which lives in this one page.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement && /^https?:/i.test(node.getAttribute('href') ?? '')) {
    node.target = '_blank'
    node.rel = 'noopener noreferrer'
  }
})

/**
 * Markdown to sanitized HTML, safe for `v-html`. The only way notes reach the page.
 * Nothing in the result makes a network request: no styles, media or SVG, and
 * an image that is not a `data:` image becomes a link showing its alt text.
 */
export function renderMarkdown(source: string): string {
  const body = DOMPurify.sanitize(markdown.parse(source, { async: false }), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'video', 'audio', 'source', 'track', 'picture'],
    FORBID_ATTR: ['style', 'srcset', 'background', 'poster'],
    RETURN_DOM: true,
  }) as HTMLElement
  // e.g. <input type="image" src>
  for (const el of body.querySelectorAll('[src]:not(img)')) el.removeAttribute('src')
  for (const img of body.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? ''
    if (/^data:image\//i.test(src)) continue
    const text = img.getAttribute('alt') || src
    if (!/^https?:/i.test(src) || img.closest('a')) {
      img.replaceWith(text)
      continue
    }
    const a = document.createElement('a')
    Object.assign(a, { href: src, target: '_blank', rel: 'noopener noreferrer', textContent: text })
    img.replaceWith(a)
  }
  return body.innerHTML
}
