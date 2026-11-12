import { beforeEach, expect, test } from 'vitest'
import { matchColumns, parseTable, runImport } from './bulk-import'
import { exportCsv, exportFileName } from './csv-export'
import { migrate } from './migrations'
import { db } from './notebook'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { addTag, createRecord, listRecords, listTags, recordTags, today } from './records'
import { slotsOf } from './relation-slots'
import { addToSlot, slotRecords } from './relations'
import { loadSqlite } from './sqlite'

const fresh = async () => {
  const d = new (await loadSqlite()).Database()
  migrate(d)
  db.value = d
}
beforeEach(fresh)

const TYPES = RECORD_TYPES.map((t) => t.type).filter((t) => t !== 'diagram')

// What an export must carry: everything about a type's Records except ids and the automatic timestamps.
const contents = (type: RecordType) =>
  listRecords(type).map((r) => ({
    title: r.title,
    notes: r.notes,
    fields: Object.fromEntries(RECORD_FIELDS[type].fields.map((f) => [f.name, r[f.name]])),
    tags: recordTags(type, r.id).map((t) => t.name),
    slots: slotsOf(type).map((s) => slotRecords(s, r.id).map((o) => `${o.type}: ${o.title}`)),
  }))

function seed() {
  const platform = createRecord('team', 'Platform', { notes: 'Runs the "core" systems;\n\n- SAP\n- Coupa, mostly' })
  const maria = createRecord('person', 'Maria Ionescu', { role: 'Buyer, senior', email: 'maria@example.com', go_to_for: 'Coupa' })
  const stefan = createRecord('person', 'Ștefan Țîru')
  addToSlot(slotsOf('person')[0], maria, { type: 'team', id: platform })
  const coupa = createRecord('system', 'Coupa', { summary: 'Procure-to-pay; "P2P"', url: 'https://coupa.example', notes: '  indented\nline two\n' })
  createRecord('system', '=SUM(A1)', { notes: 'tab\there' })
  createRecord('system', "'@home", { summary: '-5', notes: '- a list\n- of two' })
  createRecord('system', '+40', { summary: "'-x" })
  addToSlot(slotsOf('system')[0], coupa, { type: 'team', id: platform })
  addTag('system', coupa, 'finance')
  addTag('system', coupa, 'Core systems')
  addTag('person', maria, 'finance')
  createRecord('acronym', 'PO', { expansion: 'Purchase order', notes: 'Not "post office"' })
  createRecord('process', 'Purchase to pay')
  const erp = createRecord('project', 'ERP rollout', { status: 'on hold', due: '2027-03-31', summary: 'Phase 2' })
  addToSlot(slotsOf('project')[0], erp, { type: 'team', id: platform })
  createRecord('bookmark', 'Wiki', { url: 'https://wiki.example/a,b' })
  const who = createRecord('open_question', 'Who approves invoices?', { status: 'answered', answer: 'Finance.\nSee [[Coupa]]' })
  addToSlot(slotsOf('open_question')[0], who, { type: 'person', id: maria })
  createRecord('open_question', 'Why two ERPs?')
  const map = createRecord('task', 'Map interfaces', { due: '2026-12-01' })
  addToSlot(slotsOf('task')[0], map, { type: 'project', id: erp })
  createRecord('task', 'Old chore', { done: true })
  const sync = createRecord('journal_entry', 'Weekly sync', { date: '2026-11-02', kind: 'meeting', notes: '# Agenda\n\n1. Budget' })
  addToSlot(slotsOf('journal_entry')[0], sync, { type: 'person', id: maria })
  addToSlot(slotsOf('journal_entry')[0], sync, { type: 'person', id: stefan })
  createRecord('journal_entry', '', { date: '2026-11-03' })
}

test('exporting every type and importing the files into an empty Notebook gives the same Records, Tags and slot Relations', async () => {
  seed()
  const before = Object.fromEntries(TYPES.map((t) => [t, contents(t)]))
  const tags = listTags().map((t) => [t.name, t.count])
  const files = TYPES.map((t) => [t, exportCsv(t)] as const)

  await fresh()
  for (const [type, csv] of files) {
    const table = parseTable(csv)
    const result = await runImport(type, table, matchColumns(type, table[0]), 'fill')
    expect(result.skipped, type).toBe(0)
  }

  expect(Object.fromEntries(TYPES.map((t) => [t, contents(t)]))).toEqual(before)
  expect(listTags().map((t) => [t.name, t.count])).toEqual(tags)
})

test('the file is CSV as Excel reads it: a byte order mark, CRLF rows, quotes around what needs them', () => {
  createRecord('acronym', 'PO', { expansion: 'Purchase order, "the PO"', notes: 'line one\nline two' })
  createRecord('acronym', 'RFQ', { expansion: 'Request for quotation' })

  expect(exportCsv('acronym')).toBe(
    '﻿Title,Expansion,Tags,Notes\r\n' +
      'PO,"Purchase order, ""the PO""",,"line one\nline two"\r\n' +
      'RFQ,Request for quotation,,\r\n',
  )
})

test('a cell Excel would run as a formula gets a leading apostrophe; plain numbers stay as they are', () => {
  createRecord('acronym', '=SUM(A1)', { expansion: '@cmd', notes: '- item' })
  createRecord('acronym', '-5', { expansion: '+40' })
  createRecord('acronym', "'=x", { expansion: '+1-2' })
  expect(exportCsv('acronym')).toBe(
    '﻿Title,Expansion,Tags,Notes\r\n' +
      "''=x,'+1-2,,\r\n" +
      '-5,+40,,\r\n' +
      "'=SUM(A1),'@cmd,,'- item\r\n",
  )
})

test('the import drops one apostrophe in front of a formula character, and only there', () => {
  expect(parseTable("a,b,c,d,e\n'=1+1,''@x,'plain,'-5,'''=y")).toEqual([
    ['a', 'b', 'c', 'd', 'e'],
    ['=1+1', "'@x", "'plain", '-5', "''=y"],
  ])
})

test('an empty type exports just the column names', () => {
  expect(exportCsv('task')).toBe('﻿Title,Done,Due,Project,Tags,Notes\r\n')
})

test('the file is named after the list and the day', () => {
  expect(exportFileName('open_question')).toBe(`open-questions-${today()}.csv`)
})
