// @vitest-environment jsdom
// DOMPurify does not sanitize under happy-dom, so these run in jsdom.
import { expect, test } from 'vitest'
import { renderMarkdown, taskLines, toggleTask } from './markdown'

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

// ---- Task items that can be ticked in the rendered view

const boxes = (source: string) =>
  [...dom(source).querySelectorAll('input[type="checkbox"]')].map((b) => ({
    task: b.getAttribute('data-task'),
    checked: b.hasAttribute('checked'),
    name: b.getAttribute('aria-label'),
    disabled: b.hasAttribute('disabled'),
  }))

test('each task checkbox is enabled, numbered in order and named after its item', () => {
  expect(boxes('- [x] Book **workshop**\n- [ ] Ask [Ana](https://example.com)')).toEqual([
    { task: '0', checked: true, name: 'Book workshop', disabled: false },
    { task: '1', checked: false, name: 'Ask Ana', disabled: false },
  ])
})

test('ticking a task changes only its own line', () => {
  const source = '# Actions\n\n- [ ] one\n- [x] two\n- [ ] three'

  expect(toggleTask(source, 1)).toBe('# Actions\n\n- [ ] one\n- [ ] two\n- [ ] three')
  expect(toggleTask(source, 2)).toBe('# Actions\n\n- [ ] one\n- [x] two\n- [x] three')
  expect(toggleTask(source, 7)).toBe(source)
})

// Every shape of task item: the nth box on the page must be the nth task line of the text.
const SHAPES = [
  '- [ ] a\n- [x] b',
  '* [ ] star\n+ [X] plus',
  '1. [ ] numbered\n2. [x] done',
  '- [ ] parent\n    - [x] child\n    - [ ] second child\n- [ ] last',
  '> - [ ] quoted\n> - [x] quoted done',
  '- [ ] loose\n\n- [x] items\n\n- [ ] here',
  '- [ ] with [[Coupa]] and [ ] and [x] in its text',
  'text\n\n```\n- [ ] in a code block\n```\n\n- [x] real\n\n~~~md\n- [x] another block\n~~~\n- [ ] last',
  '- [ ] a\r\n- [x] b\r\n',
  '- [ ]\n- [ ] \n- [x] only this one has text',
  '- plain item\n- [ ]no space\n- [x] task',
  '| a | b |\n|---|---|\n| - [ ] cell | x |\n\n- [ ] after the table',
]
test.each(SHAPES)('the boxes of %j pair up with its task lines', (source) => {
  const found = boxes(source)
  const lines = taskLines(source)

  expect(found.length).toBeGreaterThan(0)
  expect(found.map((b) => b.task)).toEqual(lines.map((_, i) => String(i)))
  expect(found.map((b) => b.checked)).toEqual(lines.map((l) => l.checked))
  // Ticking each one flips exactly that box.
  lines.forEach((_, n) => {
    const after = boxes(toggleTask(source, n))
    expect(after.map((b) => b.checked)).toEqual(found.map((b, i) => (i === n ? !b.checked : b.checked)))
  })
})

test('a task line inside a code block is text, not a task', () => {
  const source = '```\n- [ ] sample\n```\n\n- [ ] real'

  expect(taskLines(source)).toEqual([{ line: 4, checked: false }])
  expect(toggleTask(source, 0)).toBe('```\n- [ ] sample\n```\n\n- [x] real')
})

test('when the boxes and the task lines do not pair up, every box stays read-only', () => {
  // An indented code block holds a task line the scan can\'t tell from a real one; a typed checkbox has no line.
  for (const source of ['- [ ] real\n\ntext\n\n        - [ ] indented code', '- [ ] real\n\n<input type="checkbox">']) {
    const found = boxes(source)
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((b) => b.disabled && b.task === null)).toBe(true)
  }
})
