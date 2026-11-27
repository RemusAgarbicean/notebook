import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { createRecord, updateRecord, type RecordRef } from './records'
import { LABEL, RELATION_SLOTS } from './relation-slots'
import { addRelation, addToSlot, groupRelations } from './relations'
import { memoryFolder, memoryStorage } from './storage-memory'

// Diagrams attached to a Process or a Project: a Diagrams slot, and a picture of each on the page.

let app: VueWrapper

beforeEach(async () => {
  closeNotebook()
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: memoryStorage(async () => folder) },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
})
afterEach(() => app.unmount())

const make = (type: RecordRef['type'], title: string): RecordRef => ({ type, id: createRecord(type, title) })
const slot = (type: RecordRef['type']) => RELATION_SLOTS.find((s) => s.type === type && s.name === 'Diagrams')!
const previews = () => app.findAll('[data-testid="attached-diagram"]')
async function open(r: RecordRef) {
  openRecord(r.type, r.id)
  await flushPromises()
}
function diagram(title: string, labels: string[]) {
  const d = make('diagram', title)
  const nodes = labels.map((label, i) => ({ id: `${i + 1}`, type: 'node', position: { x: i * 200, y: 0 }, data: { label } }))
  updateRecord('diagram', d.id, { canvas: JSON.stringify({ nodes, edges: [] }) })
  return d
}

for (const type of ['process', 'project'] as const) {
  test(`a ${type} shows a picture of each Diagram in its Diagrams slot, by title, and one opens its Diagram`, async () => {
    const host = make(type, 'Source-to-Pay')
    const flow = diagram('S2P flow', ['Requisition', 'PO'])
    addToSlot(slot(type), host.id, diagram('Approvals', ['Manager']))
    addToSlot(slot(type), host.id, flow)

    await open(host)

    await expect.poll(() => previews().map((p) => p.get('[data-testid="attached-diagram-title"]').text())).toEqual(['Approvals', 'S2P flow'])
    await expect.poll(() => previews()[1].findAll('[data-testid="diagram-node"]').map((n) => n.text())).toEqual(['Requisition', 'PO'])
    // A picture only: no toolbar, nothing to edit.
    expect(previews()[1].find('[data-testid="diagram-toolbar"]').exists()).toBe(false)

    await previews()[1].get('button[aria-label="Open Diagram S2P flow"]').trigger('click')
    expect(current.value).toEqual(flow)
  })
}

test('an attached Diagram shows in the slot, not again in the Relations section, and reads "shows" from its own page', async () => {
  const s2p = make('process', 'Source-to-Pay')
  const flow = diagram('S2P flow', [])
  addToSlot(slot('process'), s2p.id, flow)

  expect(groupRelations(s2p)).toEqual([])
  expect(groupRelations(flow).map((g) => [g.reading, g.entries.map((e) => e.other.title)])).toEqual([['shows', ['Source-to-Pay']]])
})

test('a Process with no attached Diagram has no pictures, and a Diagram related another way is not one', async () => {
  const s2p = make('process', 'Source-to-Pay')
  addRelation(diagram('S2P flow', ['PO']), LABEL.partOf, s2p)

  await open(s2p)

  expect(previews()).toHaveLength(0)
  expect(app.find('[data-testid="attached-diagrams"]').exists()).toBe(false)
})
