import { beforeEach, expect, test } from 'vitest'
import {
  detectSeparator,
  matchColumns,
  parseDate,
  parseTable,
  parseTrueFalse,
  planImport,
  runImport,
} from './bulk-import'
import { migrate } from './migrations'
import { db } from './notebook'
import { createRecord, getRecord, listRecords, listTags, recordTags, updateRecord } from './records'
import { slotsOf } from './relation-slots'
import { addToSlot, slotRecords } from './relations'
import { loadSqlite } from './sqlite'

const today = new Date().toLocaleDateString('sv')

// ---- Reading the table

test('a quoted cell keeps its outer spaces, unless it holds nothing else', () => {
  expect(parseTable('title,notes\n" Coupa ","  indented\nline two "\n"x","  "')).toEqual([
    ['title', 'notes'],
    [' Coupa ', '  indented\nline two '],
    ['x', ''],
  ])
})

test('a table pasted from Excel is separated by tabs, a CSV by commas', () => {
  expect(detectSeparator('Name\tRole, level\tTeam\nAna\tDev, senior\tPayments')).toBe('\t')
  expect(detectSeparator('Name,Role,Team\nAna,Dev,Payments')).toBe(',')
  expect(detectSeparator('Name;Role;Team\nAna;Dev, senior;Payments')).toBe(';')
  expect(detectSeparator('Name')).toBe(',')
})

test('parses a pasted table into rows of trimmed cells', () => {
  expect(parseTable('Name\tRole\tTeam\r\nAna\t Dev \tPayments\r\nBogdan\t\tPayments, Platform\r\n')).toEqual([
    ['Name', 'Role', 'Team'],
    ['Ana', 'Dev', 'Payments'],
    ['Bogdan', '', 'Payments, Platform'],
  ])
})

test('parses CSV with quoted fields holding commas, newlines and quotes', () => {
  const csv = '﻿Title,Notes,Tags\n"Doe, Jane","line one\nline two","a, b"\nPlain,"say ""hi""",\n\n'
  expect(parseTable(csv)).toEqual([
    ['Title', 'Notes', 'Tags'],
    ['Doe, Jane', 'line one\nline two', 'a, b'],
    ['Plain', 'say "hi"', ''],
  ])
})

// ---- Matching columns

test('matches columns to fields, Tags and slots ignoring case, with title aliases', () => {
  expect(matchColumns('person', ['NAME', 'role', 'Go to for', 'E-mail', 'Team', 'tags', 'Notes', 'Shoe size'])).toEqual([
    'title',
    'role',
    'go_to_for',
    'email',
    'slot:Team',
    'tags',
    'notes',
    '',
  ])
  expect(matchColumns('acronym', ['Abbreviation', 'Expansion'])).toEqual(['title', 'expansion'])
  // The type's own name heads the title column.
  expect(matchColumns('acronym', ['Acronym', 'Expansion'])).toEqual(['title', 'expansion'])
  expect(matchColumns('open_question', ['Open question', 'Status'])).toEqual(['title', 'status'])
  expect(matchColumns('person', ['go_to_for', 'Title'])).toEqual(['go_to_for', 'title'])
  expect(matchColumns('task', ['Title', 'Project', 'Done', 'Due'])).toEqual(['title', 'slot:Project', 'done', 'due'])
})

test('a field is matched by one column only', () => {
  expect(matchColumns('person', ['Name', 'Title'])).toEqual(['title', ''])
})

// ---- Values

test('reads dates as YYYY-MM-DD or DD.MM.YYYY', () => {
  expect(parseDate('2026-11-30')).toBe('2026-11-30')
  expect(parseDate('30.11.2026')).toBe('2026-11-30')
  expect(parseDate('1.2.2026')).toBe('2026-02-01')
  expect(parseDate('11/30/2026')).toBeNull()
  expect(parseDate('31.02.2026')).toBeNull()
  expect(parseDate('2026-13-01')).toBeNull()
  expect(parseDate('soon')).toBeNull()
})

test('reads true/false values', () => {
  for (const yes of ['yes', 'TRUE', 'x', 'X', '1']) expect(parseTrueFalse(yes)).toBe(true)
  for (const no of ['', 'no', 'False', '0']) expect(parseTrueFalse(no)).toBe(false)
  expect(parseTrueFalse('maybe')).toBeNull()
})

// ---- Planning the rows

const plan = (type: Parameters<typeof planImport>[0], text: string, existing: string[] = []) => {
  const table = parseTable(text)
  return planImport(type, table, matchColumns(type, table[0]), existing)
}

test('plans People with Tags and Teams split on commas', () => {
  expect(plan('person', 'Name\tRole\tTeam\tTags\nAna\tDev\tPayments, Platform\tgo-to, mentor')).toEqual([
    { title: 'Ana', fields: { role: 'Dev' }, tags: ['go-to', 'mentor'], slots: { Team: ['Payments', 'Platform'] } },
  ])
})

test('a row missing a required value is marked and the others are kept', () => {
  const rows = plan('acronym', 'Abbreviation,Expansion\nPO,Purchase order\nGR,\n,Nothing')
  expect(rows.map((r) => r.error)).toEqual([undefined, 'Expansion is required', 'Title is required'])
})

test('a row with an unreadable date, true/false value or choice is marked', () => {
  const rows = plan('task', 'Title,Done,Due\nA,x,24.12.2026\nB,perhaps,\nC,,next week')
  expect(rows[0]).toMatchObject({ title: 'A', fields: { done: true, due: '2026-12-24' } })
  expect(rows[1].error).toBe('Done: can\'t read "perhaps" as true or false')
  expect(rows[2].error).toBe('Due: can\'t read "next week" as a date')

  const projects = plan('project', 'Title,Status\nA,On Hold\nB,paused')
  expect(projects[0].fields).toEqual({ status: 'on hold' })
  expect(projects[1].error).toBe('Status must be one of: active, on hold, done')
})

test('a Journal entry with no date gets today, and with no title is named after its date', () => {
  expect(plan('journal_entry', 'Title,Date,Kind\nKickoff,,meeting\n,03.11.2026,')).toMatchObject([
    { title: 'Kickoff', fields: { date: today, kind: 'meeting' } },
    { title: '2026-11-03 log', fields: { date: '2026-11-03' } },
  ])
})

test('rows with the same title are merged into one, the first value winning', () => {
  expect(plan('person', 'Name,Role,Team,Tags\nAna,,Payments,a\nana,Dev,Platform,b\nANA,Lead,payments,A')).toEqual([
    { title: 'Ana', fields: { role: 'Dev' }, tags: ['a', 'b'], slots: { Team: ['Payments', 'Platform'] } },
  ])
})

test('rows whose title an existing Record has are marked as duplicates', () => {
  const rows = plan('person', 'Name\nana\nBogdan', ['Ana'])
  expect(rows.map((r) => r.duplicate)).toEqual([true, undefined])
})

// ---- Saving

const PEOPLE = 'Name\tRole\tTeam\nAna\tDev\tPayments\nBogdan\tLead\tpayments, Platform'
const teamSlot = slotsOf('person')[0]
const run = (type: Parameters<typeof planImport>[0], text: string, mode: 'skip' | 'fill' = 'skip') => {
  const table = parseTable(text)
  return runImport(type, table, matchColumns(type, table[0]), mode)
}
const person = (title: string) => listRecords('person').find((r) => r.title === title)!
const teams = (title: string) => slotRecords(teamSlot, person(title).id).map((t) => t.title)

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

test('importing People creates them with their Teams, creating each missing Team once', async () => {
  createRecord('team', 'Platform')
  expect(await run('person', PEOPLE)).toEqual({ created: 2, filled: 0, skipped: 0 })
  expect(person('Ana').role).toBe('Dev')
  expect(teams('Ana')).toEqual(['Payments'])
  expect(teams('Bogdan')).toEqual(['Payments', 'Platform'])
  expect(listRecords('team').map((t) => t.title)).toEqual(['Payments', 'Platform'])
})

test('an unmatched Owner becomes a Team, while an existing Person or Team is matched', async () => {
  createRecord('team', 'Finance')
  createRecord('person', 'Maria')
  await run('system', 'Title,Owner\nCoupa,"finance, maria, Procurement"')
  await run('project', 'Title,Owner\nRollout,Change office')
  expect(listRecords('person').map((p) => p.title)).toEqual(['Maria'])
  expect(listRecords('team').map((t) => t.title)).toEqual(['Change office', 'Finance', 'Procurement'])
  expect(slotRecords(slotsOf('system')[0], listRecords('system')[0].id).map((r) => r.title)).toEqual([
    'Finance',
    'Maria',
    'Procurement',
  ])
})

test('rows marked red are skipped and the rest are saved with their Tags', async () => {
  expect(await run('acronym', 'Abbreviation,Expansion,Tags\nPO,Purchase order,"sap, buying"\nGR,,sap')).toEqual({
    created: 1,
    filled: 0,
    skipped: 1,
  })
  expect(listRecords('acronym').map((a) => a.title)).toEqual(['PO'])
  expect(listTags().map((t) => t.name)).toEqual(['buying', 'sap'])
})

test('importing the same table again with Skip adds nothing', async () => {
  await run('person', PEOPLE)
  updateRecord('person', person('Ana').id, { role: '' })
  expect(await run('person', PEOPLE + ', Extra')).toEqual({ created: 0, filled: 0, skipped: 2 })
  expect(listRecords('person')).toHaveLength(2)
  expect(person('Ana').role).toBeNull()
  expect(listRecords('team')).toHaveLength(2)
})

test('Fill empty fields fills blanks and adds Teams and Tags without overwriting', async () => {
  const ana = createRecord('person', 'ana', { role: 'Architect' })
  addToSlot(teamSlot, ana, { type: 'team', id: createRecord('team', 'Payments') })
  const result = await run(
    'person',
    'Name,Role,Email,Team,Tags,Notes\nAna,Dev,ana@example.com,"Payments, Platform",mentor,Knows SAP',
    'fill',
  )
  expect(result).toEqual({ created: 0, filled: 1, skipped: 0 })
  expect(getRecord('person', ana)).toMatchObject({
    title: 'ana',
    role: 'Architect',
    email: 'ana@example.com',
    notes: 'Knows SAP',
  })
  expect(slotRecords(teamSlot, ana).map((t) => t.title)).toEqual(['Payments', 'Platform'])
  expect(recordTags('person', ana).map((t) => t.name)).toEqual(['mentor'])
})

test('Fill empty fields never changes a true/false value or a choice', async () => {
  const task = createRecord('task', 'Ship it')
  await run('task', 'Title,Done,Due\nShip it,x,2026-12-01', 'fill')
  expect(getRecord('task', task)).toMatchObject({ done: 0, due: '2026-12-01' })
})

test('a failed import saves nothing', async () => {
  // Without its label the Team slot can't be saved, which fails the import halfway.
  db.value!.run('delete from label where id = ?', [teamSlot.labelId])
  await expect(run('person', PEOPLE)).rejects.toThrow('That label no longer exists')
  expect(listRecords('person')).toEqual([])
  expect(listRecords('team')).toEqual([])
})
