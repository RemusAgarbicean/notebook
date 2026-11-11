import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import { defineComponent, h, ref, withDirectives } from 'vue'
import { vDialog } from './dialog'

const open = ref(false)
const Page = defineComponent(() => () => [
  h('button', { id: 'opener', onClick: () => (open.value = true) }, 'Open'),
  h('input', { id: 'elsewhere' }),
  open.value
    ? withDirectives(h('div', { id: 'dialog' }, [h('input', { id: 'first' }), h('button', { id: 'last' }, 'OK')]), [[vDialog]])
    : null,
])

const el = (id: string) => document.getElementById(id)!
const tab = (shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
  document.activeElement!.dispatchEvent(event)
  return event.defaultPrevented
}

test('Tab wraps inside a dialog, and closing it gives the focus back', async () => {
  open.value = false
  const page = mount(Page, { attachTo: document.body })
  el('opener').focus()
  open.value = true
  await page.vm.$nextTick()

  el('last').focus()
  expect(tab()).toBe(true)
  expect(document.activeElement).toBe(el('first'))
  expect(tab(true)).toBe(true)
  expect(document.activeElement).toBe(el('last'))
  // In the middle, Tab is the browser's.
  el('first').focus()
  expect(tab()).toBe(false)

  ;(document.activeElement as HTMLElement).blur()
  open.value = false
  await page.vm.$nextTick()
  expect(document.activeElement).toBe(el('opener'))
  page.unmount()
})

test('closing a dialog leaves the focus alone when something else took it', async () => {
  open.value = false
  const page = mount(Page, { attachTo: document.body })
  el('opener').focus()
  open.value = true
  await page.vm.$nextTick()

  el('elsewhere').focus()
  open.value = false
  await page.vm.$nextTick()
  expect(document.activeElement).toBe(el('elsewhere'))
  page.unmount()
})
