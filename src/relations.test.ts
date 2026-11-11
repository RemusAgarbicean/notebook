import { beforeEach, expect, test } from 'vitest'
import { migrate } from './migrations'
import { db } from './notebook'
import { searchRecords } from './record-search'
import { createRecord, deleteRecord, type RecordRef } from './records'
import { LABEL, RELATION_SLOTS, slotsOf } from './relation-slots'
import {
  addLabel,
  addRelation,
  deleteLabel,
  groupRelations,
  listLabels,
  readings,
  relate,
  removeRelation,
  renameLabel,
  slotRecords,
} from './relations'
import { loadSqlite } from './sqlite'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const make = (type: RecordRef['type'], title: string): RecordRef => ({ type, id: createRecord(type, title) })
const USES = 5
// What a Record's Relations section says: each reading with the titles under it.
const shown = (ref: RecordRef) =>
  groupRelations(ref).map((g) => [g.reading, g.entries.map((e) => e.other.title)])
const label = (id: number) => listLabels().find((l) => l.id === id)!

test('a Relation is grouped under the forward reading at one end and the reverse reading at the other', () => {
  const maria = make('person', 'Maria')
  const coupa = make('system', 'Coupa')
  const sap = make('system', 'SAP')
  const s2p = make('process', 'Source-to-Pay')

  addRelation(maria, USES, coupa)
  addRelation(maria, USES, sap)
  addRelation(s2p, USES, coupa)

  expect(shown(maria)).toEqual([['uses', ['Coupa', 'SAP']]])
  expect(shown(coupa)).toEqual([['used by', ['Maria', 'Source-to-Pay']]])
})

test('a Record at both ends of the same label gets one group per reading', () => {
  const p2p = make('process', 'Procure-to-Pay')
  const s2p = make('process', 'Source-to-Pay')
  const invoicing = make('process', 'Invoicing')

  addRelation(p2p, LABEL.partOf, s2p)
  addRelation(invoicing, LABEL.partOf, p2p)

  expect(shown(p2p)).toEqual([
    ['part of', ['Source-to-Pay']],
    ['contains', ['Invoicing']],
  ])
})

test('a label that reads the same both ways makes one group whichever way it was saved', () => {
  const coupa = make('system', 'Coupa')
  const sap = make('system', 'SAP')
  const ariba = make('system', 'Ariba')
  addRelation(coupa, 7, sap)
  addRelation(ariba, 7, coupa)

  expect(shown(coupa)).toEqual([['related to', ['Ariba', 'SAP']]])
})

test('picking a reverse reading saves the Relation the other way round', () => {
  const maria = make('person', 'Maria')
  const coupa = make('process', 'Coupa rollout')
  const usedBy = readings().find((r) => r.reading === 'used by')!

  relate(coupa, usedBy, maria)

  expect(shown(maria)).toEqual([['uses', ['Coupa rollout']]])
})

test('the reading list holds both readings of every label, and a symmetric one once', () => {
  const all = readings().map((r) => r.reading)
  expect(all).toContain('owns')
  expect(all).toContain('owned by')
  expect(all.filter((r) => r === 'related to')).toHaveLength(1)
})

test('a self-relation and a duplicate are refused, the same pair with another label is not', () => {
  const maria = make('person', 'Maria')
  const coupa = make('system', 'Coupa')
  addRelation(maria, USES, coupa)

  expect(() => addRelation(maria, USES, maria)).toThrow("A Record can't relate to itself")
  expect(() => addRelation(maria, USES, coupa)).toThrow('That Relation already exists')

  addRelation(maria, 7, coupa)
  expect(shown(maria)).toEqual([
    ['uses', ['Coupa']],
    ['related to', ['Coupa']],
  ])
})

test('removing a Relation and deleting a Record both clear it from the other end', () => {
  const maria = make('person', 'Maria')
  const coupa = make('system', 'Coupa')
  const sap = make('system', 'SAP')
  addRelation(maria, USES, coupa)
  addRelation(maria, USES, sap)

  removeRelation(maria, USES, coupa)
  expect(shown(coupa)).toEqual([])

  deleteRecord('person', maria.id)
  expect(shown(sap)).toEqual([])
})

test('a Relation shown in a slot stays out of the Relations section, but shows at the other end', () => {
  const maria = make('person', 'Maria')
  const coupa = make('system', 'Coupa')
  const owner = slotsOf('system')[0]

  relate(coupa, readings().find((r) => r.reading === 'owned by')!, maria)

  expect(slotRecords(owner, coupa.id).map((r) => r.title)).toEqual(['Maria'])
  expect(shown(coupa)).toEqual([])
  expect(shown(maria)).toEqual([['owns', ['Coupa']]])
})

test('a slot label between types the slot does not offer shows in the Relations section', () => {
  const coupa = make('system', 'Coupa')
  const s2p = make('process', 'Source-to-Pay')
  addRelation(s2p, LABEL.owns, coupa)

  expect(slotRecords(slotsOf('system')[0], coupa.id)).toEqual([])
  expect(shown(coupa)).toEqual([['owned by', ['Source-to-Pay']]])
})

test('the slots are the six from the decisions', () => {
  expect(RELATION_SLOTS.map((s) => [s.type, s.name, s.labelId, s.end, s.offers])).toEqual([
    ['system', 'Owner', LABEL.owns, 'to', ['person', 'team']],
    ['person', 'Team', LABEL.memberOf, 'from', ['team']],
    ['open_question', 'Ask', LABEL.askAbout, 'to', ['person']],
    ['journal_entry', 'Attendees', LABEL.attended, 'to', ['person']],
    ['task', 'Project', LABEL.partOf, 'from', ['project']],
    ['project', 'Owner', LABEL.owns, 'to', ['person', 'team']],
  ])
  // The ids the slots and features rely on are the seeded, protected labels.
  expect(Object.entries(LABEL).map(([, id]) => [label(id).forward, label(id).protected])).toEqual([
    ['owns', 1],
    ['member of', 1],
    ['ask about', 1],
    ['attended', 1],
    ['part of', 1],
    ['answered by', 1],
  ])
})

test('labels list their readings and how many Relations use them', () => {
  addRelation(make('person', 'Maria'), USES, make('system', 'Coupa'))

  expect(label(USES)).toMatchObject({ forward: 'uses', reverse: 'used by', uses: 1 })
  expect(label(7)).toMatchObject({ forward: 'related to', reverse: 'related to', uses: 0 })
  expect(listLabels()).toHaveLength(8)
})

test('a label can be added and renamed, and the rename shows on every Record', () => {
  const maria = make('person', 'Maria')
  const ana = make('person', 'Ana')
  const id = addLabel(' reports to ', 'manages')
  addRelation(maria, id, ana)

  renameLabel(id, 'reports into', 'leads')

  expect(shown(maria)).toEqual([['reports into', ['Ana']]])
  expect(shown(ana)).toEqual([['leads', ['Maria']]])
  expect(() => renameLabel(id, '', 'leads')).toThrow('Both readings are required')
  expect(() => addLabel('x', ' ')).toThrow('Both readings are required')
})

test('a label can be deleted only when it is unused and not protected', () => {
  const maria = make('person', 'Maria')
  const coupa = make('system', 'Coupa')
  addRelation(maria, USES, coupa)

  expect(() => deleteLabel(USES)).toThrow('1 Relation uses this label')
  expect(() => deleteLabel(LABEL.owns)).toThrow("can't be deleted")
  expect(label(USES).deletable).toBe(false)
  expect(label(LABEL.answeredBy).deletable).toBe(false)
  expect(label(7).deletable).toBe(true)

  removeRelation(maria, USES, coupa)
  deleteLabel(USES)
  expect(listLabels().map((l) => l.forward)).not.toContain('uses')
  expect(listLabels()).toHaveLength(7)
})

test('searching Records matches titles ignoring case, within the offered types', () => {
  make('person', 'Émile Coupat')
  make('system', 'Coupa')
  make('team', 'Analytics')

  expect(searchRecords('COUP').map((r) => [r.type, r.title])).toEqual([
    ['system', 'Coupa'],
    ['person', 'Émile Coupat'],
  ])
  expect(searchRecords('émile').map((r) => r.title)).toEqual(['Émile Coupat'])
  expect(searchRecords('coup', ['person', 'team']).map((r) => r.title)).toEqual(['Émile Coupat'])
  expect(searchRecords('', ['team']).map((r) => r.title)).toEqual(['Analytics'])
})
