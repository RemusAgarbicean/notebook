// @vitest-environment jsdom
// DOMPurify does not sanitize under happy-dom, so these run in jsdom.
import { expect, test } from 'vitest'
import { renderMarkdown } from './markdown'

test('markdown renders to HTML', () => {
  const html = renderMarkdown('# Steps\n\n1. Requisition in **Coupa**\n2. Approval')

  expect(html).toContain('<h1>Steps</h1>')
  expect(html).toContain('<li>Requisition in <strong>Coupa</strong></li>')
})

test('scripts and event handlers in notes are removed', () => {
  const html = renderMarkdown(
    'Hello <script>window.hacked = true</script> <img src="x" onerror="window.hacked = true"> [x](javascript:alert(1))',
  )

  expect(html).toContain('Hello')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('onerror')
  expect(html).not.toContain('javascript:')
})

const dom = (source: string) => {
  const el = document.createElement('div')
  el.innerHTML = renderMarkdown(source)
  return el
}

test('a remote image becomes a link with its alt text, so reading a note makes no request', () => {
  const el = dom('![Org chart](https://example.com/org.png) and <img src="//example.com/x.png">')

  expect(el.querySelector('img')).toBeNull()
  const [a, b] = el.querySelectorAll('a')
  expect(a.textContent).toBe('Org chart')
  expect(a.getAttribute('href')).toBe('https://example.com/org.png')
  expect(a.target).toBe('_blank')
  expect(b).toBeUndefined()
  expect(el.querySelectorAll('[src]')).toHaveLength(0)
})

test('a remote image inside a link leaves the link with the alt text', () => {
  const el = dom('[![Logo](https://example.com/logo.png)](https://example.com)')

  expect(el.querySelector('img')).toBeNull()
  expect(el.querySelectorAll('a')).toHaveLength(1)
  expect(el.querySelector('a')!.textContent).toBe('Logo')
})

test('a data: image stays', () => {
  const src = 'data:image/png;base64,iVBORw0KGgo='

  expect(dom(`![dot](${src})`).querySelector('img')!.getAttribute('src')).toBe(src)
})

test('nothing else in a note can fetch: srcset, media, styles, backgrounds, SVG images', () => {
  const html = renderMarkdown(
    [
      '<img src="data:image/png;base64,iVBORw0KGgo=" srcset="https://evil.test/a.png 2x">',
      '<video src="https://evil.test/v.mp4" poster="https://evil.test/p.png"><source src="https://evil.test/s.mp4"></video>',
      '<audio src="https://evil.test/a.mp3"></audio>',
      '<picture><source srcset="https://evil.test/b.png"><img src="https://evil.test/c.png" alt="c"></picture>',
      '<p style="background: url(https://evil.test/d.png)">styled</p>',
      '<style>p { background: url(https://evil.test/e.png) }</style>',
      '<table background="https://evil.test/f.png"><tr><td>cell</td></tr></table>',
      '<svg><image href="https://evil.test/g.png" /></svg>',
      '<input type="image" src="https://evil.test/h.png">',
    ].join('\n\n'),
  )

  // The one place a remote address may remain is the href of the link that replaced an image.
  expect(html.replace(/href="[^"]*"/g, '')).not.toContain('evil.test')
  expect(html).toContain('styled')
  expect(html).toContain('cell')
})

test('a task list keeps its checkboxes', () => {
  expect(dom('- [x] done\n- [ ] open').querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
})
