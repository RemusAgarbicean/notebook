import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from '../App.vue'
import { current, openRecord } from '../navigation'
import { closeNotebook, db, listBackups, reloadFromDisk, restoreBackup, saveNow, takeBackup } from '../notebook'
import { createRecord, getRecord, updateRecord } from '../records'
import { saveStatus } from '../save-status'
import { memoryFolder } from '../storage-memory'
import { useVueFlow } from '@vue-flow/core'
import { parseCanvas } from './canvas'

let app: VueWrapper
let id: number
let folder: ReturnType<typeof memoryFolder>

beforeEach(async () => {
  closeNotebook()
  folder = memoryFolder()
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

const button = (name: string) => app.findAll('button').find((b) => b.text() === name || b.attributes('aria-label') === name)!
const saved = () => parseCanvas(getRecord('diagram', id)!.canvas as string | null)
const nodeTexts = () => app.findAll('[data-testid="diagram-node"]').map((n) => n.text())
async function open() {
  openRecord('diagram', id)
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')
}
async function close() {
  current.value = null
  await flushPromises()
}

test('Add Node puts a Node on the canvas and into the saved Diagram', async () => {
  await open()

  await button('Add Node').trigger('click')

  await expect.poll(() => app.findAll('[data-testid="diagram-node"]')).toHaveLength(1)
  await expect.poll(() => saved().nodes).toHaveLength(1)
  expect(saved().nodes[0]).toMatchObject({ id: '1', type: 'node', data: { label: '' } })
})

test('a saved Diagram comes back as it was, and looking at it does not rewrite it', async () => {
  const canvas = {
    nodes: [
      { id: '1', type: 'node', position: { x: 0, y: 0 }, data: { label: 'Coupa', fill: 'green' } },
      { id: '2', type: 'node', position: { x: 200, y: 0 }, data: { label: 'SAP' } },
    ],
    edges: [{ id: '1', source: '1', target: '2', label: 'invoices' }],
    viewport: { x: 0, y: 40, zoom: 2 },
  }
  updateRecord('diagram', id, { canvas: JSON.stringify(canvas) })

  await open()
  await expect.poll(nodeTexts).toEqual(['Coupa', 'SAP'])
  await close()
  expect(saved()).toMatchObject(canvas)

  const before = getRecord('diagram', id)!.canvas
  await open()
  await expect.poll(nodeTexts).toEqual(['Coupa', 'SAP'])
  await close()
  expect(getRecord('diagram', id)!.canvas).toBe(before)
})

test('a fill chosen from a Node\'s right-click menu is saved by name', async () => {
  updateRecord('diagram', id, {
    canvas: JSON.stringify({ nodes: [{ id: '1', type: 'node', position: { x: 0, y: 0 }, data: { label: 'Coupa' } }] }),
  })
  await open()
  await expect.poll(nodeTexts).toEqual(['Coupa'])

  await app.get('[data-testid="diagram-node"]').trigger('contextmenu')
  await app.get('[role="menu"] [aria-label="Fill green"]').trigger('click')

  await expect.poll(() => saved().nodes[0].data).toEqual({ label: 'Coupa', fill: 'green' })

  await app.get('[data-testid="diagram-node"]').trigger('contextmenu')
  await app.get('[role="menu"] [aria-label="No fill"]').trigger('click')

  await expect.poll(() => saved().nodes[0].data).toEqual({ label: 'Coupa' })
})

test('double-clicking a Node edits its text', async () => {
  updateRecord('diagram', id, {
    canvas: JSON.stringify({ nodes: [{ id: '1', type: 'node', position: { x: 0, y: 0 }, data: { label: 'Coupa' } }] }),
  })
  await open()
  await expect.poll(nodeTexts).toEqual(['Coupa'])

  await app.get('[data-testid="diagram-node"]').trigger('dblclick')
  const input = app.get('[data-testid="diagram-node"] textarea')
  ;(input.element as HTMLTextAreaElement).value = 'Coupa P2P'
  await input.trigger('blur')

  expect(nodeTexts()).toEqual(['Coupa P2P'])
  await expect.poll(() => saved().nodes[0].data?.label).toBe('Coupa P2P')
})

test('Full screen hides the list and Esc brings it back', async () => {
  await open()
  expect(app.find('[data-testid="list-column"]').exists()).toBe(true)

  await button('Full screen').trigger('click')
  expect(app.find('[data-testid="list-column"]').exists()).toBe(false)

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await flushPromises()
  expect(app.find('[data-testid="list-column"]').exists()).toBe(true)
})

test('leaving a Diagram leaves full screen', async () => {
  await open()
  await button('Full screen').trigger('click')

  current.value = null
  await flushPromises()

  expect(app.find('[data-testid="list-column"]').exists()).toBe(true)
})

test('double-clicking an Edge edits its label in a dialog: Enter saves, Esc cancels', async () => {
  const node = (n: string, x: number) => ({ id: n, type: 'node', position: { x, y: 0 }, data: { label: n } })
  updateRecord('diagram', id, {
    canvas: JSON.stringify({ nodes: [node('1', 0), node('2', 200)], edges: [{ id: '1', source: '1', target: '2', label: 'invoices' }] }),
  })
  await open()
  const { onEdgeDoubleClick: _, emits } = useVueFlow(`diagram-${id}`)
  const dblclick = async () => {
    emits.edgeDoubleClick({ edge: useVueFlow(`diagram-${id}`).findEdge('1')!, event: new MouseEvent('dblclick') })
    await flushPromises()
  }
  const input = () => app.get<HTMLInputElement>('[data-testid="edge-label-input"]')

  await dblclick()
  expect(input().element.value).toBe('invoices')
  expect(document.activeElement).toBe(input().element)
  await input().setValue('  POs  ')
  await app.get('[data-testid="edge-label-dialog"] form').trigger('submit')
  expect(app.find('[data-testid="edge-label-dialog"]').exists()).toBe(false)
  await expect.poll(() => saved().edges[0].label).toBe('POs')

  await dblclick()
  await input().setValue('other')
  await app.get('[data-testid="edge-label-dialog"]').trigger('keydown', { key: 'Escape' })
  expect(app.find('[data-testid="edge-label-dialog"]').exists()).toBe(false)

  // An emptied label is removed.
  await dblclick()
  await input().setValue('')
  await app.get('[data-testid="edge-label-dialog"] form').trigger('submit')
  await expect.poll(() => saved().edges[0].label).toBeUndefined()
})

test('a Diagram edited just before a Backup is restored does not write into the restored Notebook', async () => {
  await takeBackup('manual')
  const [backup] = await listBackups()
  await open()
  await button('Add Node').trigger('click')
  await expect.poll(() => app.findAll('[data-testid="diagram-node"]')).toHaveLength(1)

  await restoreBackup(backup.name)
  await flushPromises()
  await new Promise((r) => setTimeout(r, 400)) // past the canvas's debounced save

  expect(app.find('[data-testid="diagram-canvas"]').exists()).toBe(false)
  expect(saved().nodes).toEqual([])
})

test('an open Diagram does not write into the Notebook reloaded from disk, even with nothing pending', async () => {
  const team = createRecord('team', 'Procurement')
  const canvas = JSON.stringify({
    nodes: [{ id: '1', type: 'node', position: { x: 0, y: 0 }, data: { label: 'Procurement', recordType: 'team', recordId: team } }],
  })
  updateRecord('diagram', id, { canvas })
  await saveNow()
  // The Team is renamed in the app only: the file on disk still says Procurement.
  db.value!.run("update team set title = 'Buying desk' where id = ?", [team])
  await open()
  await expect.poll(nodeTexts).toEqual(['Buying desk'])

  await reloadFromDisk()
  await flushPromises()

  expect(app.find('[data-testid="diagram-canvas"]').exists()).toBe(false)
  expect(getRecord('diagram', id)!.canvas).toBe(canvas)
})

test('a canvas change counts as unsaved at once, and closing the tab right after it still saves it', async () => {
  await open()
  await saveNow()
  expect(saveStatus.value).toBe('saved')

  await button('Add Node').trigger('click')
  await flushPromises()
  expect(saveStatus.value).toBe('unsaved')
  window.dispatchEvent(new Event('pagehide'))

  expect(saved().nodes).toHaveLength(1)
  await saveNow()
  db.value = null
  expect(folder.file).not.toBeNull()
})

test('opening a Diagram and looking at it leaves the Notebook saved', async () => {
  await saveNow()
  await open()
  await flushPromises()
  expect(saveStatus.value).toBe('saved')
})
