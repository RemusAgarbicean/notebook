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

const TASK = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+\S/

/** The task items (`- [ ]`, `- [x]`) of a markdown text, in order: the line each is on and whether it is ticked. */
export function taskLines(source: string): { line: number; checked: boolean }[] {
  const tasks: { line: number; checked: boolean }[] = []
  let fenced = false
  source.split('\n').forEach((text, line) => {
    if (/^\s*(```|~~~)/.test(text)) fenced = !fenced
    const task = fenced ? null : TASK.exec(text)
    if (task) tasks.push({ line, checked: task[1] !== ' ' })
  })
  return tasks
}

/** The text with its nth task item ticked or unticked; unchanged when there is no such item. */
export function toggleTask(source: string, n: number): string {
  const task = taskLines(source)[n]
  if (!task) return source
  const lines = source.split('\n')
  lines[task.line] = lines[task.line].replace(/\[([ xX])\]/, (_, mark) => (mark === ' ' ? '[x]' : '[ ]'))
  return lines.join('\n')
}

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
  // A task item's checkbox can be ticked in place: `data-task` is its place among `taskLines(source)`.
  // That holds only while the boxes on the page and the task lines in the text pair up one to one
  // (an indented code block or a typed <input> breaks it); otherwise they all stay read-only.
  const tasks = taskLines(source)
  const boxes = [...body.querySelectorAll('input[type="checkbox"]')]
  if (boxes.length === tasks.length && boxes.every((box, i) => box.hasAttribute('checked') === tasks[i].checked))
    boxes.forEach((box, i) => {
      const item = box.closest('li')?.cloneNode(true) as HTMLElement | undefined
      // The item's own text names the box, without the items nested in it.
      item?.querySelectorAll('ul, ol').forEach((nested) => nested.remove())
      box.removeAttribute('disabled')
      box.setAttribute('data-task', String(i))
      box.setAttribute('aria-label', item?.textContent?.trim() || 'Task')
    })
  else for (const box of boxes) box.setAttribute('disabled', '')
  return body.innerHTML
}
