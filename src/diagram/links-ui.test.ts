import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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

const node = (nodeId: string, data: object) => ({ id: nodeId, type: 'node', position: { x: 0, y: 0 }, data })
const draw = (diagram: number, ...data: object[]) =>
  updateRecord('diagram', diagram, { canvas: JSON.stringify({ nodes: data.map((d, i) => node(String(i + 1), d)) }) })
const savedData = () => parseCanvas(getRecord('diagram', id)!.canvas as string | null).nodes.map((n) => n.data)
const nodes = () => app.findAll('[data-testid="diagram-node"]')
const nodeTexts = () => nodes().map((n) => n.text())
async function open() {
  openRecord('diagram', id)
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
}
async function menu() {
  await expect.poll(nodes).toHaveLength(1)
  await nodes()[0].trigger('contextmenu')
  return app.get('[role="menu"]')
}

test("a linked Node shows its Record's title now, and saving refreshes the snapshot", async () => {
  const coupa = createRecord('system', 'Coupa')
  draw(id, { label: 'Coupa', recordType: 'system', recordId: coupa })
  updateRecord('system', coupa, { title: 'Coupa P2P' })

  await open()
  await expect.poll(nodeTexts).toEqual(['Coupa P2P'])
  expect(nodes()[0].classes()).toContain('linked')

  // Any change saves the Diagram; the snapshot goes along.
  await (await menu()).get('[aria-label="Fill green"]').trigger('click')
  await expect.poll(savedData).toEqual([{ label: 'Coupa P2P', fill: 'green', recordType: 'system', recordId: coupa }])
})

test('double-clicking a linked Node opens its Record', async () => {
  const coupa = createRecord('system', 'Coupa')
  draw(id, { label: 'Coupa', recordType: 'system', recordId: coupa })
  await open()
  await expect.poll(nodeTexts).toEqual(['Coupa'])

  await nodes()[0].trigger('dblclick')
  await flushPromises()

  expect(current.value).toEqual({ type: 'system', id: coupa })
})

test('Make Record turns a free-text Node into a Record of the picked type and links the Node', async () => {
  draw(id, { label: 'Coupa', fill: 'green' })
  await open()

  const m = await menu()
  await m.get('[data-testid="make-record-type"]').setValue('system')
  await m.get('[data-testid="make-record"]').trigger('submit')

  const [coupa] = listRecords('system')
  expect(coupa.title).toBe('Coupa')
  await expect.poll(savedData).toEqual([{ label: 'Coupa', fill: 'green', recordType: 'system', recordId: coupa.id }])
  expect(app.find('[role="menu"]').exists()).toBe(false)
  expect(nodes()[0].classes()).toContain('linked')
})

test('a linked Node offers no Make Record', async () => {
  draw(id, { label: 'Coupa', recordType: 'system', recordId: createRecord('system', 'Coupa') })
  await open()

  expect((await menu()).find('[data-testid="make-record"]').exists()).toBe(false)
})

test('a Node can be linked to an existing Record, another Diagram included, through the picker', async () => {
  const detail = createRecord('diagram', 'Invoice detail')
  draw(id, { label: 'see detail' })
  await open()

  const m = await menu()
  await m.get('[data-testid="record-picker"]').setValue('invoice')
  await m.findAll('[data-testid="picker-option"]').find((o) => o.text() === 'Invoice detail')!.trigger('click')

  await expect.poll(nodeTexts).toEqual(['Invoice detail'])
  await expect.poll(savedData).toEqual([{ label: 'Invoice detail', recordType: 'diagram', recordId: detail }])
})

test('a Record page lists the Diagrams it is in, and deleting it warns how many', async () => {
  const coupa = createRecord('system', 'Coupa')
  const link = { label: 'Coupa', recordType: 'system', recordId: coupa }
  draw(id, link)
  draw(createRecord('diagram', 'Invoices'), link, link)
  const confirm = vi.fn((_message: string) => false)
  vi.stubGlobal('confirm', confirm)

  openRecord('system', coupa)
  await flushPromises()

  expect(app.findAll('[data-testid="in-diagrams"]').map((d) => d.text())).toEqual(['Invoices', 'S2P overview'])

  await app.get('[data-testid="delete-record"]').trigger('click')
  expect(confirm.mock.calls[0][0]).toContain('used in 2 Diagrams')

  await app.findAll('[data-testid="in-diagrams"]')[1].trigger('click')
  expect(current.value).toEqual({ type: 'diagram', id })
})
