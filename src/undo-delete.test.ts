import { beforeEach, expect, test } from 'vitest'
import { parseCanvas } from './diagram/canvas'
import { inDiagrams } from './diagram/links'
import { migrate } from './migrations'
import { db } from './notebook'
import { addTag, createRecord, deleteRecord, getRecord, listTags, recordTags, updateRecord } from './records'
import { LABEL } from './relation-slots'
import { addLabel, addRelation, deleteLabel, listLabels, recordRelations, renameLabel } from './relations'
import { loadSqlite } from './sqlite'
import { lastDeleted, undoDelete } from './undo-delete'

const fresh = async () => {
  const d = new (await loadSqlite()).Database()
  migrate(d)
  db.value = d
}
beforeEach(fresh)

const node = (id: string, label: string, link?: { type: string; id: number }) => ({
  id,
  type: 'node',
  position: { x: 0, y: 0 },
  data: { label, ...(link && { recordType: link.type, recordId: link.id }) },
})
const diagramWith = (...nodes: object[]) =>
  createRecord('diagram', 'Map', { canvas: JSON.stringify({ nodes, edges: [], viewport: { x: 0, y: 0, zoom: 1 } }) })
const nodesOf = (id: number) => parseCanvas(getRecord('diagram', id)!.canvas as string).nodes.map((n) => n.data)
const relationsOf = (type: 'system' | 'person', id: number) =>
  recordRelations({ type, id }).map((e) => `${e.reading} ${e.other.title}`)

test('Undo puts a deleted Record back as it was, under the same id', () => {
  const id = createRecord('task', 'File expenses', { done: true, due: '2026-01-05', notes: 'See [[Coupa]]' })
  const before = getRecord('task', id)

  deleteRecord('task', id)
  expect(lastDeleted()).toMatchObject({ type: 'task', id, title: 'File expenses' })
  expect(undoDelete()).toEqual({ type: 'task', id })

  expect(getRecord('task', id)).toEqual(before)
  expect(lastDeleted()).toBeNull()
})

test('Undo puts back the Relations from both ends and the Tag links, recreating a Tag that was dropped', () => {
  const coupa = createRecord('system', 'Coupa')
  const maria = createRecord('person', 'Maria')
  const sap = createRecord('system', 'SAP')
  addRelation({ type: 'person', id: maria }, LABEL.owns, { type: 'system', id: coupa })
  addRelation({ type: 'system', id: coupa }, 5, { type: 'system', id: sap })
  addTag('system', coupa, 'finance')
  addTag('system', coupa, 'core')
  addTag('system', sap, 'core')

  deleteRecord('system', coupa)
  expect(listTags().map((t) => t.name)).toEqual(['core'])
  undoDelete()

  expect(relationsOf('system', coupa)).toEqual(['owned by Maria', 'uses SAP'])
  expect(recordTags('system', coupa).map((t) => t.name)).toEqual(['core', 'finance'])
})

test('Undo links the Nodes this delete unlinked again, but not one the user retyped since', () => {
  const coupa = createRecord('system', 'Coupa')
  const link = { type: 'system', id: coupa }
  const map = diagramWith(node('1', 'Coupa', link), node('2', 'Coupa', link), node('3', 'Coupa'))

  deleteRecord('system', coupa)
  const canvas = JSON.parse(getRecord('diagram', map)!.canvas as string)
  canvas.nodes[1].data.label = 'Something else'
  updateRecord('diagram', map, { canvas: JSON.stringify(canvas) })
  undoDelete()

  expect(nodesOf(map)).toEqual([
    { label: 'Coupa', recordType: 'system', recordId: coupa },
    { label: 'Something else' },
    { label: 'Coupa' },
  ])
  expect(inDiagrams({ type: 'system', id: coupa })).toHaveLength(1)
})

test('a deleted Diagram comes back with its canvas and its linked Nodes', () => {
  const coupa = createRecord('system', 'Coupa')
  const map = diagramWith(node('1', 'Coupa', { type: 'system', id: coupa }))

  deleteRecord('diagram', map)
  undoDelete()

  expect(nodesOf(map)).toEqual([{ label: 'Coupa', recordType: 'system', recordId: coupa }])
})

test('a deleted Record keeps its id for Undo: a Record created meanwhile gets another', () => {
  const coupa = createRecord('system', 'Coupa')
  deleteRecord('system', coupa)

  const sap = createRecord('system', 'SAP')
  expect(sap).not.toBe(coupa)
  undoDelete()

  expect(getRecord('system', coupa)!.title).toBe('Coupa')
  expect(getRecord('system', sap)!.title).toBe('SAP')
})

test('deletes are undone latest first, and each brings back the Relations it took', () => {
  const coupa = createRecord('system', 'Coupa')
  const maria = createRecord('person', 'Maria')
  addRelation({ type: 'person', id: maria }, LABEL.owns, { type: 'system', id: coupa })

  deleteRecord('system', coupa)
  deleteRecord('person', maria)
  expect(undoDelete()).toEqual({ type: 'person', id: maria })
  expect(relationsOf('person', maria)).toEqual([])
  expect(undoDelete()).toEqual({ type: 'system', id: coupa })

  expect(relationsOf('person', maria)).toEqual(['owns Coupa'])
  expect(undoDelete()).toBeNull()
})

test('only the last five deletes can be undone', () => {
  const ids = [1, 2, 3, 4, 5, 6].map((i) => createRecord('team', `Team ${i}`))
  for (const id of ids) deleteRecord('team', id)
  for (let i = 0; i < 5; i++) expect(undoDelete()).not.toBeNull()

  expect(undoDelete()).toBeNull()
  expect(getRecord('team', ids[0])).toBeNull()
  expect(getRecord('team', ids[1])!.title).toBe('Team 2')
})

test('a Relation whose label was deleted meanwhile comes back with its label', () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  const feeds = addLabel('feeds', 'fed by')
  addRelation({ type: 'system', id: coupa }, feeds, { type: 'system', id: sap })

  deleteRecord('system', coupa)
  deleteLabel(feeds)
  addLabel('replaces', 'replaced by')
  undoDelete()

  expect(relationsOf('system', coupa)).toEqual(['feeds SAP'])
  expect(listLabels().filter((l) => l.forward === 'feeds')).toHaveLength(1)
})

test("Undo still works when the deleted label's reading was taken by a new label: the Relation joins that label", () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  addRelation({ type: 'system', id: coupa }, 5, { type: 'system', id: sap })

  deleteRecord('system', coupa)
  deleteLabel(5)
  addLabel('uses', 'utilised by')
  undoDelete()

  expect(getRecord('system', coupa)!.title).toBe('Coupa')
  expect(relationsOf('system', coupa)).toEqual(['uses SAP'])
  expect(listLabels().filter((l) => l.forward === 'uses')).toHaveLength(1)
})

test("Undo comes through even when the deleted label's readings now belong to a label that reads the other way round", () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  addRelation({ type: 'system', id: coupa }, 5, { type: 'system', id: sap })

  deleteRecord('system', coupa)
  deleteLabel(5)
  addLabel('used by', 'uses')
  undoDelete()

  expect(relationsOf('system', coupa)).toEqual(['uses SAP'])
  expect(relationsOf('system', sap)).toEqual(['used by Coupa'])
})

test('a label renamed since the delete keeps its new readings: Undo does not bring the old label back', () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  addRelation({ type: 'system', id: coupa }, 5, { type: 'system', id: sap })

  deleteRecord('system', coupa)
  renameLabel(5, 'depends on', 'needed by')
  undoDelete()

  expect(relationsOf('system', coupa)).toEqual(['depends on SAP'])
  expect(listLabels()).toHaveLength(8)
})

test("a new label that took a deleted label's id does not take its Relations", () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  const feeds = addLabel('feeds', 'fed by')
  addRelation({ type: 'system', id: coupa }, feeds, { type: 'system', id: sap })

  deleteRecord('system', coupa)
  deleteLabel(feeds)
  expect(addLabel('replaces', 'replaced by')).toBe(feeds)
  undoDelete()

  expect(relationsOf('system', coupa)).toEqual(['feeds SAP'])
})

test('a bare Mention of another Record with the same title is not taken over by the Record put back', () => {
  const coupa = createRecord('system', 'Coupa')
  deleteRecord('system', coupa)
  createRecord('team', 'Coupa')
  const note = createRecord('process', 'Buying', { notes: 'Ask [[Coupa]]' })

  undoDelete()

  expect(getRecord('process', note)!.notes).toBe('Ask [[Team: Coupa]]')
})

test('another Notebook has nothing to undo', async () => {
  deleteRecord('system', createRecord('system', 'Coupa'))
  await fresh()

  expect(lastDeleted()).toBeNull()
  expect(undoDelete()).toBeNull()
})
