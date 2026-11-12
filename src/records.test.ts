import { beforeEach, expect, test } from 'vitest'
import { migrate } from './migrations'
import { db } from './notebook'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES } from './record-types'
import {
  addTag,
  createRecord,
  deleteRecord,
  duplicateRecord,
  getRecord,
  listRecords,
  listTags,
  recordCounts,
  recordTags,
  recordsWithTag,
  recordTitles,
  titled,
  transaction,
  removeTag,
  revision,
  textRevision,
  todaysLog,
  updateRecord,
} from './records'
import { saveStatus } from './save-status'
import { loadSqlite } from './sqlite'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const count = (sql: string) => db.value!.exec(sql)[0].values[0][0]
const today = new Date().toLocaleDateString('sv')

test('every one of the 11 types can be created, read, listed and deleted', () => {
  for (const { type } of RECORD_TYPES) {
    const id = createRecord(type, 'Coupa')

    expect(getRecord(type, id)).toMatchObject({ id, title: 'Coupa', notes: '' })
    expect(listRecords(type).map((r) => r.id)).toEqual([id])

    deleteRecord(type, id)
    expect(getRecord(type, id)).toBeNull()
    expect(listRecords(type)).toEqual([])
  }
})

test('each type has the fixed fields from the decisions', () => {
  const names = Object.fromEntries(
    RECORD_TYPES.map(({ type }) => [type, RECORD_FIELDS[type].fields.map((f) => f.name)]),
  )
  expect(names).toEqual({
    system: ['summary', 'url'],
    acronym: ['expansion'],
    person: ['role', 'email', 'go_to_for'],
    team: [],
    process: [],
    project: ['status', 'due', 'summary'],
    diagram: ['canvas'],
    bookmark: ['url'],
    open_question: ['status', 'answer'],
    task: ['done', 'due'],
    journal_entry: ['date', 'kind'],
  })
})

test('a Record needs a title, when created and when edited', () => {
  expect(() => createRecord('system', '  ')).toThrow('Title is required')

  const id = createRecord('system', 'Coupa')
  expect(() => updateRecord('system', id, { title: '' })).toThrow('Title is required')
  expect(getRecord('system', id)!.title).toBe('Coupa')
})

test('editing saves the fields, stores empty optional fields as null and bumps updated_at', () => {
  const id = createRecord('person', 'Maria Lopez')
  db.value!.run("update person set updated_at = '2020-01-01T00:00:00.000Z'")

  updateRecord('person', id, { role: 'Coupa platform lead', email: '', notes: 'Very responsive.' })

  const maria = getRecord('person', id)!
  expect(maria).toMatchObject({ role: 'Coupa platform lead', email: null, notes: 'Very responsive.' })
  expect(maria.updated_at.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
})

test('an Acronym expansion, a Bookmark url and a Journal date cannot be emptied', () => {
  const po = createRecord('acronym', 'PO', { expansion: 'Purchase order' })
  const wiki = createRecord('bookmark', 'Wiki', { url: 'https://wiki.example' })
  const entry = createRecord('journal_entry', '')

  expect(() => updateRecord('acronym', po, { expansion: ' ' })).toThrow('Expansion is required')
  expect(() => updateRecord('bookmark', wiki, { url: '' })).toThrow('URL is required')
  expect(() => updateRecord('journal_entry', entry, { date: '' })).toThrow('Date is required')
  expect(() => createRecord('acronym', 'S2P', { expansion: '' })).toThrow('Expansion is required')
  expect(listRecords('acronym').map((r) => r.title)).toEqual(['PO'])
})

test('a choice outside the list and a field the type does not have are rejected', () => {
  const id = createRecord('project', 'Spend cube')

  expect(() => updateRecord('project', id, { status: 'paused' })).toThrow()
  expect(() => updateRecord('project', id, { role: 'x' })).toThrow()
})

test("a Journal entry's date defaults to today and its title to the date and kind", () => {
  const entry = getRecord('journal_entry', createRecord('journal_entry', ''))!

  expect(entry).toMatchObject({ date: today, kind: 'log', title: `${today} log` })
})

test('ticking a Task sets done_at and unticking clears it', () => {
  const id = createRecord('task', 'Get Coupa access')
  expect(getRecord('task', id)).toMatchObject({ done: 0, done_at: null })

  updateRecord('task', id, { done: true })
  expect(getRecord('task', id)!.done).toBe(1)
  expect(getRecord('task', id)!.done_at).toMatch(/^\d{4}-\d\d-\d\dT/)

  updateRecord('task', id, { done: false })
  expect(getRecord('task', id)).toMatchObject({ done: 0, done_at: null })
})

test('a Project gets done_at when its status changes to done and loses it when it changes back', () => {
  const id = createRecord('project', 'Spend cube')
  expect(getRecord('project', id)).toMatchObject({ status: 'active', done_at: null })

  updateRecord('project', id, { status: 'done' })
  expect(getRecord('project', id)!.done_at).toMatch(/^\d{4}-/)

  updateRecord('project', id, { status: 'on hold' })
  expect(getRecord('project', id)!.done_at).toBeNull()
})

test('an Open question gets answered_at when answered and loses it when reopened', () => {
  const id = createRecord('open_question', 'Who approves POs?')

  updateRecord('open_question', id, { status: 'answered', answer: 'The budget owner.' })
  expect(getRecord('open_question', id)!.answered_at).toMatch(/^\d{4}-/)

  updateRecord('open_question', id, { status: 'open' })
  expect(getRecord('open_question', id)).toMatchObject({ answered_at: null, answer: 'The budget owner.' })
})

test('editing a done Task keeps its done_at', () => {
  const id = createRecord('task', 'Get Coupa access', { done: true })
  db.value!.run("update task set done_at = '2026-01-01T00:00:00.000Z'")

  updateRecord('task', id, { done: true, due: '2026-12-01' })

  expect(getRecord('task', id)!.done_at).toBe('2026-01-01T00:00:00.000Z')
})

test('Tasks and Open questions list open items first; the Journal lists the latest first', () => {
  createRecord('task', 'A done', { done: true })
  createRecord('task', 'B open')
  createRecord('open_question', 'A answered', { status: 'answered' })
  createRecord('open_question', 'B open')
  createRecord('journal_entry', 'Old', { date: '2026-11-01' })
  createRecord('journal_entry', 'New', { date: '2026-11-10' })
  createRecord('system', 'sap')
  createRecord('system', 'Coupa')

  expect(listRecords('task').map((r) => r.title)).toEqual(['B open', 'A done'])
  expect(listRecords('open_question').map((r) => r.title)).toEqual(['B open', 'A answered'])
  expect(listRecords('journal_entry').map((r) => r.title)).toEqual(['New', 'Old'])
  expect(listRecords('system').map((r) => r.title)).toEqual(['Coupa', 'sap'])
})

test('Tags can be added (new or existing, ignoring case) and removed', () => {
  const coupa = createRecord('system', 'Coupa')
  const maria = createRecord('person', 'Maria Lopez')

  addTag('system', coupa, 'S2P')
  addTag('person', maria, ' s2p ')
  addTag('person', maria, 'S2P')
  addTag('person', maria, '')

  expect(listTags().map((t) => t.name)).toEqual(['S2P'])
  const [tag] = recordTags('person', maria)
  expect(recordsWithTag(tag.id)).toEqual([
    { type: 'system', id: coupa, title: 'Coupa' },
    { type: 'person', id: maria, title: 'Maria Lopez' },
  ])

  removeTag('person', maria, tag.id)
  expect(recordTags('person', maria)).toEqual([])
  expect(recordsWithTag(tag.id).map((r) => r.title)).toEqual(['Coupa'])
})

test('a Tag that no Record has any more is gone from the Tag list', () => {
  const coupa = createRecord('system', 'Coupa')
  addTag('system', coupa, 'S2P')

  removeTag('system', coupa, recordTags('system', coupa)[0].id)

  expect(listTags()).toEqual([])
})

test("deleting a Record removes its Relations (both directions) and Tag links, and nobody else's", () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  const maria = createRecord('person', 'Maria Lopez') // same id as Coupa, different type
  expect(maria).toBe(coupa)
  const relate = (from: [string, number], to: [string, number]) =>
    db.value!.run(
      'insert into relation (from_type, from_id, label_id, to_type, to_id) values (?, ?, 1, ?, ?)',
      [...from, ...to],
    )
  relate(['person', maria], ['system', coupa])
  relate(['system', coupa], ['system', sap])
  relate(['person', maria], ['system', sap])
  addTag('system', coupa, 'S2P')
  addTag('person', maria, 'S2P')
  addTag('system', coupa, 'only-coupa')

  deleteRecord('system', coupa)

  expect(count('select count(*) from relation')).toBe(1)
  expect(count("select count(*) from record_tag where type = 'system'")).toBe(0)
  expect(recordTags('person', maria).map((t) => t.name)).toEqual(['S2P'])
  expect(listTags().map((t) => t.name)).toEqual(['S2P'])
  expect(getRecord('person', maria)).not.toBeNull()
})

test('every write bumps the refresh signal and marks the Notebook unsaved', () => {
  saveStatus.value = 'saved'
  const before = revision.value

  const id = createRecord('team', 'Procurement')
  expect(revision.value).toBeGreaterThan(before)
  expect(saveStatus.value).toBe('unsaved')

  const afterCreate = revision.value
  addTag('team', id, 'core')
  deleteRecord('team', id)
  expect(revision.value).toBeGreaterThanOrEqual(afterCreate + 2)
})

test('a notes edit bumps only the text signal, so lists and counts are not refreshed by typing', () => {
  const id = createRecord('team', 'Procurement')
  saveStatus.value = 'saved'
  const [before, text] = [revision.value, textRevision.value]

  updateRecord('team', id, { notes: 'x' })
  expect(revision.value).toBe(before)
  expect(textRevision.value).toBeGreaterThan(text)
  expect(saveStatus.value).toBe('unsaved')

  updateRecord('team', id, { notes: 'y', title: 'Buying' })
  expect(revision.value).toBeGreaterThan(before)
})

test('a transaction that throws leaves none of its writes, also when transactions nest', () => {
  expect(() =>
    transaction(() => {
      createRecord('team', 'Finance')
      transaction(() => createRecord('person', 'Maria'))
      throw new Error('halfway')
    }),
  ).toThrow('halfway')

  expect(listRecords('team')).toEqual([])
  expect(listRecords('person')).toEqual([])
  // The Notebook still accepts transactions afterwards.
  expect(transaction(() => createRecord('team', 'Finance'))).toBeGreaterThan(0)
})

test('recordCounts counts every Record per type, but only open Tasks and Open questions', () => {
  createRecord('system', 'Coupa')
  createRecord('system', 'SAP')
  createRecord('task', 'Call Ana')
  createRecord('task', 'Done already', { done: true })
  const q = createRecord('open_question', 'Who owns Coupa?')
  createRecord('open_question', 'Why two ERPs?')
  updateRecord('open_question', q, { status: 'answered' })

  expect(recordCounts()).toMatchObject({ system: 2, task: 1, open_question: 1, person: 0 })
})

test('listTags gives each Tag the number of Records that have it', () => {
  addTag('system', createRecord('system', 'Coupa'), 'S2P')
  addTag('person', createRecord('person', 'Ana'), 's2p')
  addTag('person', createRecord('person', 'Bo'), 'finance')

  expect(listTags()).toMatchObject([
    { name: 'finance', count: 1 },
    { name: 'S2P', count: 2 },
  ])
})

test("todaysLog starts today's Journal entry of kind log once, and finds it again after a rename", () => {
  createRecord('journal_entry', 'Standup', { kind: 'meeting' })
  createRecord('journal_entry', '', { kind: 'log', date: '2020-01-01' })

  const id = todaysLog()

  expect(getRecord('journal_entry', id)).toMatchObject({ title: `${today} log`, date: today, kind: 'log' })
  updateRecord('journal_entry', id, { title: 'What I learned' })
  expect(todaysLog()).toBe(id)
  expect(listRecords('journal_entry')).toHaveLength(3)
})

test('duplicating a Record copies its fields, notes and Tags under "<title> copy"', () => {
  const id = createRecord('system', 'Coupa', { summary: 'Procure-to-pay', url: 'https://coupa.example', notes: 'See [[SAP]]' })
  addTag('system', id, 'finance')

  const copy = duplicateRecord('system', id)

  expect(copy).not.toBe(id)
  expect(getRecord('system', copy)).toMatchObject({
    title: 'Coupa copy',
    summary: 'Procure-to-pay',
    url: 'https://coupa.example',
    notes: 'See [[SAP]]',
  })
  expect(recordTags('system', copy).map((t) => t.name)).toEqual(['finance'])
  expect(listTags()).toMatchObject([{ name: 'finance', count: 2 }])
})

test('a copy starts open: not done, not answered, without the answer', () => {
  const task = duplicateRecord('task', createRecord('task', 'File expenses', { done: true, due: '2026-12-01' }))
  expect(getRecord('task', task)).toMatchObject({ done: 0, done_at: null, due: '2026-12-01' })

  const question = duplicateRecord(
    'open_question',
    createRecord('open_question', 'Who approves?', { status: 'answered', answer: 'Finance' }),
  )
  expect(getRecord('open_question', question)).toMatchObject({ status: 'open', answer: null, answered_at: null })

  const project = duplicateRecord('project', createRecord('project', 'ERP', { status: 'done', summary: 'Phase 1' }))
  expect(getRecord('project', project)).toMatchObject({ status: 'active', done_at: null, summary: 'Phase 1' })
  expect(getRecord('acronym', duplicateRecord('acronym', createRecord('acronym', 'PO')))).toMatchObject({ expansion: '' })
  const held = duplicateRecord('project', createRecord('project', 'CRM', { status: 'on hold' }))
  expect(getRecord('project', held)).toMatchObject({ status: 'on hold' })
})

test('a copy has none of the Relations, and a Diagram copy keeps its canvas', () => {
  const coupa = createRecord('system', 'Coupa')
  const maria = createRecord('person', 'Maria')
  db.value!.run("insert into relation (from_type, from_id, label_id, to_type, to_id) values ('person', ?, 1, 'system', ?)", [maria, coupa])
  duplicateRecord('system', coupa)
  expect(count('select count(*) from relation')).toBe(1)

  const canvas = JSON.stringify({ nodes: [{ id: '1', data: { label: 'Coupa', recordType: 'system', recordId: coupa } }], edges: [] })
  const map = createRecord('diagram', 'Map', { canvas })
  expect(getRecord('diagram', duplicateRecord('diagram', map))).toMatchObject({ title: 'Map copy', canvas })
})

test('titles stay in sidebar order then by id while Records are created, renamed and deleted', () => {
  const fresh = () =>
    RECORD_TYPES.flatMap(({ type }) =>
      (db.value!.exec(`select id, title from ${type} order by id`)[0]?.values ?? []).map(([id, title]) => ({ type, id, title })),
    )
  recordTitles()
  transaction(() => {
    for (const type of ['task', 'system', 'person', 'system', 'journal_entry', 'acronym'] as const)
      createRecord(type, `${type} ${recordTitles().length}`, type === 'acronym' ? { expansion: 'x' } : {})
  })
  expect(recordTitles()).toEqual(fresh())
  const team = createRecord('team', 'Finance')
  updateRecord('team', team, { title: 'Buying' })
  createRecord('team', 'finance')
  expect(recordTitles()).toEqual(fresh())
  expect(titled('FINANCE').map((r) => r.type)).toEqual(['team'])
  deleteRecord('team', team)
  expect(recordTitles()).toEqual(fresh())
  expect(titled('buying')).toEqual([])
})
