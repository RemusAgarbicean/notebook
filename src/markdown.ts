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

/** Markdown to sanitized HTML, safe for `v-html`. The only way notes reach the page. */
export const renderMarkdown = (source: string): string =>
  DOMPurify.sanitize(markdown.parse(source, { async: false }))
