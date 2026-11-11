import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { useVueFlow } from '@vue-flow/core'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from '../App.vue'
import { current, openRecord } from '../navigation'
import { closeNotebook } from '../notebook'
import { createRecord, getRecord, listRecords, updateRecord } from '../records'
import { memoryFolder } from '../storage-memory'
import { parseCanvas } from './canvas'

let app: VueWrapper
let id: number

beforeEach(async () => {
  closeNotebook()
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => null, reopen: async () => null } },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
  id = createRecord('diagram', 'S2P overview')
})
afterEach(() => app.unmount())

const node = (n: string, x: number, data: object = { label: n }) => ({ id: n, type: 'node', position: { x, y: 0 }, data })
const saved = () => parseCanvas(getRecord('diagram', id)!.canvas as string | null)
const flow = () => useVueFlow(`diagram-${id}`)
const canvas = () => app.get('.vue-flow')
const nodeEl = (n: string) => app.get<HTMLElement>(`.vue-flow__node[data-id="${n}"]`)
const press = async (key: string, init: KeyboardEventInit = {}, on = canvas()) => {
  await on.trigger('keydown', { key, ...init })
  await flushPromises()
}
/** Opens the Diagram with Nodes 1 and 2 and an Edge between them. */
async function open(first: object = { label: 'Coupa' }) {
  updateRecord('diagram', id, {
    canvas: JSON.stringify({
      nodes: [node('1', 0, first), node('2', 200)],
      edges: [{ id: '1', source: '1', target: '2', label: 'invoices' }],
    }),
  })
  openRecord('diagram', id)
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
  await expect.poll(() => app.findAll('[data-testid="diagram-node"]')).toHaveLength(2)
}
async function select(n: string) {
  flow().addSelectedNodes([flow().findNode(n)!])
  await flushPromises()
}
const menu = () => app.find('[role="menu"]')

test('the Node menu button opens the menu for the selected Node, and Esc gives the focus back to the Node', async () => {
  await open()
  const button = app.get('[data-testid="node-menu-button"]')
  expect(button.attributes('disabled')).toBeDefined()

  await select('1')
  expect(button.attributes('disabled')).toBeUndefined()
  await button.trigger('click')
  await flushPromises()

  expect(menu().exists()).toBe(true)
  expect(document.activeElement).toBe(menu().get('[aria-label="No fill"]').element)

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await flushPromises()
  expect(menu().exists()).toBe(false)
  expect(document.activeElement).toBe(nodeEl('1').element)
})

test('the context-menu key and Shift+F10 open the menu for the selection, and do nothing without one', async () => {
  await open()
  await press('ContextMenu')
  expect(menu().exists()).toBe(false)

  await select('1')
  for (const [key, init] of [['ContextMenu', {}], ['F10', { shiftKey: true }]] as const) {
    await press(key, init)
    expect(menu().exists()).toBe(true)
    await menu().get('[aria-label="Fill green"]').trigger('click')
    await flushPromises()
    expect(menu().exists()).toBe(false)
  }
  await expect.poll(() => saved().nodes[0].data?.fill).toBe('green')
})

test('the arrow keys walk the menu, wrapping round, and leave a text box alone', async () => {
  await open()
  await select('1')
  await press('ContextMenu')
  const at = () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim()
  const key = (k: string) => press(k, {}, menu())

  expect(at()).toBe('No fill')
  await key('ArrowRight')
  expect(at()).toBe('Fill grey')
  await key('ArrowLeft')
  await key('ArrowUp')
  expect(at()).toBe('Link to a Record')
  // In the picker the arrows choose a Record.
  await press('ArrowDown', {}, menu().get('[data-testid="record-picker"]'))
  expect(at()).toBe('Link to a Record')
})

test('a letter typed in the Node menu is not a shortcut of the page behind', async () => {
  await open()
  await select('1')
  await press('ContextMenu')

  await press('n', {}, menu().get('[aria-label="No fill"]'))

  expect(listRecords('diagram')).toHaveLength(1)
  expect(menu().exists()).toBe(true)
})

test('Enter or F2 edits the text of the selected Node, and Enter in the text gives the focus back to the Node', async () => {
  await open()
  for (const key of ['Enter', 'F2']) {
    await select('1')
    await press(key)
    await expect.poll(() => nodeEl('1').find('textarea').exists()).toBe(true)
    const input = nodeEl('1').get('textarea')
    ;(input.element as HTMLTextAreaElement).value = `Coupa ${key}`
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(nodeEl('1').text()).toBe(`Coupa ${key}`)
    expect(document.activeElement).toBe(nodeEl('1').element)
  }
})

test('Enter on a selected linked Node opens its Record', async () => {
  const coupa = createRecord('system', 'Coupa')
  await open({ label: 'Coupa', recordType: 'system', recordId: coupa })
  await select('1')

  await press('Enter')

  expect(current.value).toEqual({ type: 'system', id: coupa })
})

test('Enter or F2 on a selected Edge opens its label dialog', async () => {
  await open()
  for (const key of ['Enter', 'F2']) {
    flow().addSelectedEdges([flow().findEdge('1')!])
    await press(key)
    expect(app.get<HTMLInputElement>('[data-testid="edge-label-input"]').element.value).toBe('invoices')
    await app.get('[data-testid="dialog-cancel"]').trigger('click')
  }
})

test('Delete and Backspace remove the selection only from the canvas, never while typing or from elsewhere on the page', async () => {
  await open()
  await select('1')

  // Elsewhere on the page.
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  await press('Backspace', {}, app.get('[data-testid="record-title"]'))
  // While typing a Node's text.
  await press('F2')
  await expect.poll(() => nodeEl('1').find('textarea').exists()).toBe(true)
  await press('Backspace', {}, nodeEl('1').get('textarea'))
  await press('Delete', { shiftKey: true }, nodeEl('1').get('textarea'))
  await press('Escape', {}, nodeEl('1').get('textarea'))
  // In the menu.
  await press('ContextMenu')
  await press('Delete', {}, menu().get('[aria-label="No fill"]'))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await flushPromises()
  expect(app.findAll('[data-testid="diagram-node"]')).toHaveLength(2)

  await press('Delete', {}, nodeEl('1'))
  expect(app.findAll('[data-testid="diagram-node"]')).toHaveLength(1)
  await select('2')
  await press('Backspace')
  expect(app.findAll('[data-testid="diagram-node"]')).toHaveLength(0)
  await expect.poll(() => saved().nodes).toEqual([])
})
