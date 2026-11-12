import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { useVueFlow } from '@vue-flow/core'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from '../App.vue'
import { current, openRecord } from '../navigation'
import { closeNotebook } from '../notebook'
import { createRecord, getRecord, listRecords, updateRecord } from '../records'
import { memoryFolder } from '../storage-memory'
import { parseCanvas } from './canvas'

// Building a Diagram: undo, the quick ways to add Nodes, shapes, Edge options, Frames and arranging.

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
const button = (name: string) => app.get(`button[aria-label="${name}"]`)
const labels = () => flow().nodes.value.map((n) => n.data.label)
const press = async (key: string, init: KeyboardEventInit = {}, on = canvas()) => {
  await on.trigger('keydown', { key, ...init })
  await flushPromises()
}
const ctrl = (key: string, init: KeyboardEventInit = {}) => press(key, { ctrlKey: true, ...init })
/** Opens the Diagram with Nodes 1 and 2 and an Edge between them. */
async function open(nodes: object[] = [node('1', 0), node('2', 200)]) {
  updateRecord('diagram', id, {
    canvas: JSON.stringify({ nodes, edges: [{ id: '1', source: '1', target: '2', label: 'invoices' }] }),
  })
  openRecord('diagram', id)
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
  await expect.poll(() => app.findAll('.vue-flow__node')).toHaveLength(nodes.length)
}
async function select(...ids: string[]) {
  flow().removeSelectedNodes(flow().getSelectedNodes.value)
  flow().addSelectedNodes(ids.map((n) => flow().findNode(n)!))
  await flushPromises()
}

test('Ctrl+Z takes back the last change and Ctrl+Shift+Z or Ctrl+Y brings it again', async () => {
  await open()
  expect(button('Undo').attributes('disabled')).toBeDefined()
  await select('2')
  await press('Delete')
  expect(labels()).toEqual(['1'])
  expect(flow().edges.value).toHaveLength(0)

  await ctrl('z')
  expect(labels()).toEqual(['1', '2'])
  expect(flow().edges.value.map((e) => e.label)).toEqual(['invoices'])
  expect(button('Undo').attributes('disabled')).toBeDefined()

  await ctrl('z', { shiftKey: true })
  expect(labels()).toEqual(['1'])
  await ctrl('z')
  await ctrl('y')
  expect(labels()).toEqual(['1'])
  expect(button('Redo').attributes('disabled')).toBeDefined()
  await expect.poll(() => saved().nodes).toHaveLength(1)
})

test('the Undo and Redo buttons do the same, and a fill is one step', async () => {
  await open()
  await select('1')
  await app.get('[aria-label="Fill green"]').trigger('click')
  await flushPromises()
  expect(flow().findNode('1')!.data.fill).toBe('green')

  await button('Undo').trigger('click')
  await flushPromises()
  expect(flow().findNode('1')!.data.fill).toBeUndefined()
  await button('Redo').trigger('click')
  await flushPromises()
  expect(flow().findNode('1')!.data.fill).toBe('green')
})

test('Ctrl+Z while typing a Node\'s text is left to the text box', async () => {
  await open()
  await select('2')
  await press('Delete')
  await app.get('[data-testid="diagram-node"]').trigger('dblclick')
  await press('z', { ctrlKey: true }, app.get('[aria-label="Node text"]'))
  expect(labels()).toEqual(['1'])
})

test('a new Node and the text typed into it are one step', async () => {
  await open()
  await button('Add Node').trigger('click')
  await expect.poll(() => app.find('[aria-label="Node text"]').exists()).toBe(true)
  const input = app.get<HTMLTextAreaElement>('[aria-label="Node text"]')
  input.element.value = 'Ariba'
  await input.trigger('blur')
  await flushPromises()
  expect(labels()).toEqual(['1', '2', 'Ariba'])

  await ctrl('z')
  expect(labels()).toEqual(['1', '2'])
})

// --- Faster building

const typeText = async (text: string) => {
  await expect.poll(() => app.find('[aria-label="Node text"]').exists()).toBe(true)
  const input = app.get<HTMLTextAreaElement>('[aria-label="Node text"]')
  input.element.value = text
  await input.trigger('blur')
  await flushPromises()
}
const edgeEnds = () => flow().edges.value.map((e) => `${e.source}>${e.target}`)

test('a double-click on the empty canvas adds a Node there, ready for typing', async () => {
  await open()
  await app.get('.vue-flow__pane').trigger('dblclick', { clientX: 300, clientY: 200 })
  await typeText('Ariba')

  expect(labels()).toEqual(['1', '2', 'Ariba'])
  expect(flow().findNode('3')!.selected).toBe(true)
})

test('Tab on the selected Node adds a connected child to its right, and another below that', async () => {
  await open()
  await select('2')
  await press('Tab')
  await typeText('Bank')
  expect(edgeEnds()).toEqual(['1>2', '2>3'])
  const [parent, first] = [flow().findNode('2')!, flow().findNode('3')!]
  expect(first.position.x).toBeGreaterThan(parent.position.x)
  expect(first.position.y).toBe(parent.position.y)
  expect(first.selected).toBe(true)

  await select('2')
  await press('Tab')
  await typeText('Tax')
  expect(edgeEnds()).toEqual(['1>2', '2>3', '2>4'])
  expect(flow().findNode('4')!.position.x).toBe(first.position.x)
  expect(flow().findNode('4')!.position.y).toBeGreaterThan(first.position.y)

  // One step each.
  await ctrl('z')
  expect(labels()).toEqual(['1', '2', 'Bank'])
})

test('Ctrl+D duplicates the selected Nodes with the Edge between them', async () => {
  await open()
  await select('1', '2')
  await ctrl('d')

  expect(labels()).toEqual(['1', '2', '1', '2'])
  expect(edgeEnds()).toEqual(['1>2', '3>4'])
  expect(flow().findNode('3')!.position).toEqual({ x: 24, y: 24 })
  expect(flow().getSelectedNodes.value.map((n) => n.id)).toEqual(['3', '4'])
  expect(flow().edges.value[1].label).toBe('invoices')
})

test('Ctrl+X cuts, Ctrl+V pastes, also into another Diagram', async () => {
  await open()
  await select('1', '2')
  await ctrl('x')
  expect(labels()).toEqual([])
  await ctrl('v')
  expect(labels()).toEqual(['1', '2'])
  expect(edgeEnds()).toEqual(['1>2'])

  await select('1')
  await ctrl('c')
  const other = createRecord('diagram', 'Other')
  openRecord('diagram', other)
  await expect.poll(() => getRecord('diagram', other) && app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
  await flushPromises()
  await press('v', { ctrlKey: true })
  expect(useVueFlow(`diagram-${other}`).nodes.value.map((n) => n.data.label)).toEqual(['1'])
})

test('the arrow keys nudge the selection, further with Shift', async () => {
  await open()
  await select('1', '2')
  await press('ArrowRight')
  await press('ArrowDown', { shiftKey: true })

  expect(flow().findNode('1')!.position).toEqual({ x: 4, y: 16 })
  expect(flow().findNode('2')!.position).toEqual({ x: 204, y: 16 })
})

// --- Add Record

test('Add Record puts a Node linked to the picked Record on the canvas, also when it is there already', async () => {
  const coupa = createRecord('system', 'Coupa')
  await open()
  const picker = app.get('[data-testid="add-record"] [data-testid="record-picker"]')
  for (const _ of [1, 2]) {
    await picker.setValue('coup')
    await app.findAll('[data-testid="add-record"] [data-testid="picker-option"]').find((o) => o.text() === 'Coupa')!.trigger('click')
    await flushPromises()
  }

  expect(flow().nodes.value.slice(2).map((n) => n.data)).toEqual([
    { label: 'Coupa', recordType: 'system', recordId: coupa },
    { label: 'Coupa', recordType: 'system', recordId: coupa },
  ])
  expect(flow().findNode('3')!.position).not.toEqual(flow().findNode('4')!.position)
  expect(app.find('[aria-label="Node text"]').exists()).toBe(false)
})

test('Add Record can make the Record from the typed title', async () => {
  await open()
  await app.get('[data-testid="add-record"] [data-testid="record-picker"]').setValue('Ariba')
  await app.findAll('[data-testid="picker-option"]').find((o) => o.text() === "Create System 'Ariba'")!.trigger('click')
  await flushPromises()

  const [ariba] = listRecords('system')
  expect(flow().nodes.value.at(-1)!.data).toEqual({ label: 'Ariba', recordType: 'system', recordId: ariba.id })
})

// --- Shapes, text with line breaks, sizes

test('a shape chosen for the selection is saved by name, and the rectangle by no name', async () => {
  await open()
  await select('1', '2')
  await pickShape('diam')

  expect(app.findAll('[data-testid="diagram-node"]').map((n) => n.classes('diamond'))).toEqual([true, true])
  await expect.poll(() => saved().nodes.map((n) => n.data)).toEqual([
    { label: '1', shape: 'diamond' },
    { label: '2', shape: 'diamond' },
  ])

  await app.get('[data-testid="diagram-node"]').trigger('contextmenu')
  await app.get('[role="menu"] [aria-label="Shape: Decision"]').trigger('click')
  await type('rect')
  await press('Enter', {}, app.get('[aria-label="Find a shape"]'))
  await expect.poll(() => saved().nodes.map((n) => n.data)).toEqual([{ label: '1' }, { label: '2' }])
})

async function type(text: string) {
  const input = app.get<HTMLInputElement>('[aria-label="Find a shape"]')
  input.element.value = text
  await input.trigger('input')
}
/** Opens the toolbar's shape picker, types `query` and takes the first shape it finds. */
async function pickShape(query: string) {
  await button('Shape').trigger('click')
  await type(query)
  await press('Enter', {}, app.get('[aria-label="Find a shape"]'))
}
const shownShapes = () => app.findAll('[role="option"]').map((o) => o.attributes('data-shape'))

test('the shape picker finds shapes as you type, walks them with the arrows, and Esc closes it', async () => {
  await open()
  await select('1')
  await button('Shape').trigger('click')
  expect(shownShapes().length).toBeGreaterThanOrEqual(50)
  await type('arrow')
  expect(shownShapes()).toEqual(['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'arrow-left-right', 'chevron', 'block-arrow'])
  const input = app.get('[aria-label="Find a shape"]')
  await press('ArrowDown', {}, input)
  await press('ArrowDown', {}, input)
  await press('ArrowUp', {}, input)
  expect(app.get('[role="option"][aria-selected="true"]').attributes('data-shape')).toBe('arrow-left')
  await press('Escape', {}, input)
  expect(app.find('[data-testid="shape-picker"]').exists()).toBe(false)
  // Esc closed only the list: the Node is still selected.
  expect(flow().getSelectedNodes.value).toHaveLength(1)

  await button('Shape').trigger('click')
  await type('ARROW LEFT')
  await app.get('[data-shape="arrow-left"]').trigger('click')
  expect(flow().findNode('1')!.data.shape).toBe('arrow-left')
})

test('the shapes used last come first in the picker', async () => {
  await open()
  await select('1')
  await pickShape('cloud')
  await pickShape('star')
  await button('Shape').trigger('click')
  expect(shownShapes().slice(0, 2)).toEqual(['star', 'cloud'])
  expect(app.get('[data-testid="shape-picker"] [role="group"]').attributes('aria-label')).toBe('Recent')
})

test('a linked Node keeps its border and icon in every shape', async () => {
  const coupa = createRecord('system', 'Coupa')
  await open([node('1', 0, { label: 'Coupa', recordType: 'system', recordId: coupa, shape: 'cylinder' }), node('2', 200, { label: 'x', shape: 'hexagonal-prism' })])
  const [linked, unknown] = app.findAll('[data-testid="diagram-node"]')
  expect(linked.classes()).toEqual(expect.arrayContaining(['cylinder', 'linked']))
  expect(linked.find('svg').exists()).toBe(true)
  expect(unknown.classes()).toContain('rectangle')
})

test('Shift+Enter keeps typing, Enter ends the edit, and the line break is kept', async () => {
  await open()
  await app.get('[data-testid="diagram-node"]').trigger('dblclick')
  const input = app.get<HTMLTextAreaElement>('textarea[aria-label="Node text"]')
  input.element.value = 'Coupa\nP2P'
  await input.trigger('keydown', { key: 'Enter', shiftKey: true })
  expect(app.find('[aria-label="Node text"]').exists()).toBe(true)
  await input.trigger('keydown', { key: 'Enter' })

  expect(app.find('[aria-label="Node text"]').exists()).toBe(false)
  expect(flow().findNode('1')!.data.label).toBe('Coupa\nP2P')
})

test('dragging a corner handle of a selected Node gives it a size, in one undo step', async () => {
  await open()
  expect(app.find('[data-testid="resize-handle"]').exists()).toBe(false)
  await select('1')
  flow().findNode('1')!.dimensions = { width: 80, height: 34 }
  const handle = app.findAll('[data-testid="resize-handle"]')[3] // bottom right
  await handle.trigger('pointerdown', { clientX: 80, clientY: 34 })
  await handle.trigger('pointermove', { clientX: 100, clientY: 40 })
  await handle.trigger('pointermove', { clientX: 120, clientY: 60 })
  await handle.trigger('pointerup')
  await flushPromises()

  expect(flow().findNode('1')!.data).toEqual({ label: '1', width: 120, height: 60 })
  expect(app.get('[data-testid="diagram-node"]').attributes('style')).toContain('width: 120px')
  await ctrl('z')
  expect(flow().findNode('1')!.data).toEqual({ label: '1' })
})

// --- Edge options

const edgeDialog = () => app.find('[data-testid="edge-label-dialog"]')
const choose = (group: string, value: string) => edgeDialog().get(`input[name="edge-${group}"][value="${value}"]`).setValue(true)
const arrows = () => app.findAll('.diagram-arrow').length

test('an Edge drawn now has an arrowhead at its end; one saved before has none and stays as it was', async () => {
  await open([node('1', 0), node('2', 200), node('3', 400)])
  expect(arrows()).toBe(0)

  flow().emits.connect({ source: '2', target: '3', sourceHandle: null, targetHandle: null })
  await flushPromises()

  expect(flow().edges.value.map((e) => e.data)).toEqual([{}, { arrow: 'end' }])
  expect(arrows()).toBe(1)
  await expect.poll(() => saved().edges.map((e) => e.data)).toEqual([{}, { arrow: 'end' }])
})

test('a right-click on an Edge opens its dialog, where arrowheads, dashes and the path are chosen', async () => {
  await open()
  flow().emits.edgeContextMenu({ edge: flow().findEdge('1')!, event: new MouseEvent('contextmenu') })
  await flushPromises()
  expect(edgeDialog().get<HTMLInputElement>('[data-testid="edge-label-input"]').element.value).toBe('invoices')
  expect(edgeDialog().get<HTMLInputElement>('input[name="edge-arrow"][value="none"]').element.checked).toBe(true)

  await choose('arrow', 'both')
  await choose('line', 'dashed')
  await choose('path', 'step')
  await edgeDialog().get('form').trigger('submit')
  await flushPromises()

  expect(flow().findEdge('1')).toMatchObject({ label: 'invoices', data: { arrow: 'both', dash: true, path: 'step' } })
  expect(arrows()).toBe(2)
  expect(app.get('.vue-flow__edge-path').attributes('style')).toContain('stroke-dasharray')
  // Still the one grey.
  expect(app.get('.vue-flow__edge-path').attributes('style')).toContain('stroke: #a1a1aa')
  await expect.poll(() => saved().edges[0].data).toEqual({ arrow: 'both', dash: true, path: 'step' })

  // One undo step, and back to stored defaults by choosing them.
  await ctrl('z')
  expect(flow().findEdge('1')!.data).toEqual({})
  expect(arrows()).toBe(0)
})

test('the context-menu key on a selected Edge opens its dialog', async () => {
  await open()
  flow().addSelectedEdges([flow().findEdge('1')!])
  await flushPromises()
  await press('ContextMenu')
  expect(edgeDialog().exists()).toBe(true)
})

// --- Frames

const frame = (n: string, x: number, y: number, width: number, height: number, label = 'Lane') => ({ id: n, type: 'frame', position: { x, y }, data: { label, width, height } })
const at = (n: string) => flow().findNode(n)!.position

test('Add Frame puts a titled Frame on the canvas, ready for its title', async () => {
  await open()
  await button('Add Frame').trigger('click')
  await expect.poll(() => app.find('[aria-label="Frame title"]').exists()).toBe(true)
  const input = app.get<HTMLInputElement>('[aria-label="Frame title"]')
  input.element.value = 'Finance'
  await input.trigger('blur')
  await flushPromises()

  expect(app.get('[data-testid="diagram-frame"]').text()).toBe('Finance')
  await expect.poll(() => saved().nodes[2]).toMatchObject({ type: 'frame', data: { label: 'Finance', width: 320, height: 200 } })
  await ctrl('z')
  expect(flow().nodes.value).toHaveLength(2)
})

test('Add Frame with Nodes selected draws the Frame around them', async () => {
  await open()
  await select('1', '2')
  await button('Add Frame').trigger('click')
  await flushPromises()
  // Nodes have no size in this test environment: the Frame is its padding around their corners.
  expect(flow().findNode('3')).toMatchObject({ type: 'frame', position: { x: -20, y: -40 }, data: { width: 240, height: 60 } })
})

test('moving a Frame takes the Nodes in it along, and leaves the others', async () => {
  await open([node('1', 10), node('2', 500), frame('3', -50, -50, 200, 200)])
  await select('3')
  await press('ArrowRight', { shiftKey: true })

  expect(at('3')).toEqual({ x: -34, y: -50 })
  expect(at('1')).toEqual({ x: 26, y: 0 })
  expect(at('2')).toEqual({ x: 500, y: 0 })
})

test('duplicating a Frame duplicates what is in it; deleting it leaves that where it is', async () => {
  await open([node('1', 10), node('2', 500), frame('3', -50, -50, 200, 200)])
  await select('3')
  await ctrl('d')
  expect(flow().nodes.value.map((n) => `${n.type}:${n.data.label}`)).toEqual(['node:1', 'node:2', 'frame:Lane', 'node:1', 'frame:Lane'])

  await ctrl('z')
  await select('3')
  await press('Delete')
  expect(labels()).toEqual(['1', '2'])
})

test('a Frame takes a fill but no shape and no Record, and Tidy leaves it around its Nodes', async () => {
  await open([node('1', 10), node('2', 500), frame('3', -50, -50, 200, 200)])
  await select('3')
  await app.get('[data-testid="node-menu-button"]').trigger('click')
  await flushPromises()
  expect(app.find('[role="menu"] [aria-label="Shape: Diamond"]').exists()).toBe(false)
  expect(app.find('[role="menu"] [data-testid="record-picker"]').exists()).toBe(false)
  await app.get('[role="menu"] [aria-label="Fill blue"]').trigger('click')
  expect(flow().findNode('3')!.data.fill).toBe('blue')

  await button('Tidy left to right').trigger('click')
  await flushPromises()
  const [f, inside] = [flow().findNode('3')!, at('1')]
  expect(inside.x).toBeGreaterThanOrEqual(f.position.x)
  expect(inside.x).toBeLessThanOrEqual(f.position.x + f.data.width)
  expect(inside.y).toBeGreaterThanOrEqual(f.position.y)
  expect(inside.y).toBeLessThanOrEqual(f.position.y + f.data.height)
  expect(f.type).toBe('frame')
})

// --- Arranging by hand

test('align and distribute act on a selection of two or three Nodes and more', async () => {
  await open([node('1', 0), { ...node('2', 200), position: { x: 200, y: 50 } }, { ...node('3', 300), position: { x: 300, y: 80 } }])
  expect(button('Align top').attributes('disabled')).toBeDefined()
  await select('1', '2')
  expect(button('Align top').attributes('disabled')).toBeUndefined()
  expect(button('Distribute horizontally').attributes('disabled')).toBeDefined()
  await button('Align top').trigger('click')
  expect(at('2')).toEqual({ x: 200, y: 0 })

  await select('1', '2', '3')
  await button('Distribute horizontally').trigger('click')
  expect(at('2')).toEqual({ x: 150, y: 0 })
  await flushPromises()
  await ctrl('z')
  expect(at('2')).toEqual({ x: 200, y: 0 })
})

test('snap to grid is remembered in the Diagram, and the arrow keys then step by the grid', async () => {
  await open()
  expect(button('Snap to grid').attributes('aria-pressed')).toBe('false')
  await button('Snap to grid').trigger('click')
  await expect.poll(() => JSON.parse(getRecord('diagram', id)!.canvas as string).snap).toBe(true)
  expect(button('Undo').attributes('disabled')).toBeDefined()

  await select('1')
  await press('ArrowRight')
  expect(at('1')).toEqual({ x: 16, y: 0 })

  current.value = null
  await flushPromises()
  openRecord('diagram', id)
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
  expect(button('Snap to grid').attributes('aria-pressed')).toBe('true')
})

test('the minimap is always shown, whether or not the drawing fits', async () => {
  await open()
  flow().dimensions.value = { width: 1000, height: 600 }
  await flow().setViewport({ x: 0, y: 0, zoom: 1 })
  await flushPromises()
  expect(app.find('.vue-flow__minimap').exists()).toBe(true)

  await flow().setViewport({ x: -150, y: 0, zoom: 1 })
  await flushPromises()
  expect(app.find('.vue-flow__minimap').exists()).toBe(true)
})

test('opening a Diagram with snap on leaves Nodes off the grid where they are, and saves nothing', async () => {
  const canvas = JSON.stringify({ nodes: [node('1', 5), node('2', 203)], edges: [], viewport: { x: 0, y: 0, zoom: 1 }, snap: true })
  updateRecord('diagram', id, { canvas })
  openRecord('diagram', id)
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
  await expect.poll(() => app.findAll('.vue-flow__node')).toHaveLength(2)
  await new Promise((r) => setTimeout(r, 400))
  await flushPromises()

  expect(at('1')).toEqual({ x: 5, y: 0 })
  expect(at('2')).toEqual({ x: 203, y: 0 })
  expect(getRecord('diagram', id)!.canvas).toBe(canvas)
})
