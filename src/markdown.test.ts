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
