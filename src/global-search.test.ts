import { beforeEach, expect, test } from 'vitest'
import { globalSearch } from './global-search'
import { migrate } from './migrations'
import { db } from './notebook'
import { addTag, createRecord, updateRecord } from './records'
import { loadSqlite } from './sqlite'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const found = (text: string) => globalSearch(text).map((h) => `${h.type}: ${h.title}${h.where ? ` (${h.where})` : ''}`)

test('finds Records of every type by title, fields, notes and Tags, ignoring case', () => {
  createRecord('process', 'Approval flow')
  const sap = createRecord('system', 'SAP', { summary: 'Sends invoices for APPROVAL' })
  const ana = createRecord('person', 'Ana')
  updateRecord('person', ana, { notes: 'Ask her about budget approvals.' })
  addTag('team', createRecord('team', 'Finance'), 'approval')
  createRecord('task', 'Unrelated')
  void sap

  expect(found('approval')).toEqual([
    'process: Approval flow',
    'person: Ana (Notes)',
    'team: Finance (Tag)',
    'system: SAP (Summary)',
  ])
})

test('an empty search finds nothing, and a Diagram canvas is not searched', () => {
  const id = createRecord('diagram', 'Landscape')
  updateRecord('diagram', id, { canvas: '{"nodes":["approval"]}' })

  expect(found('  ')).toEqual([])
  expect(found('approval')).toEqual([])
})

test('an Open question is found by its answer', () => {
  const id = createRecord('open_question', 'Who signs off?')
  updateRecord('open_question', id, { status: 'answered', answer: 'The approval board' })

  expect(found('board')).toEqual(['open_question: Who signs off? (Answer)'])
})
