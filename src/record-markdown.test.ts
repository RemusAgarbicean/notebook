import { beforeEach, expect, test } from 'vitest'
import { migrate } from './migrations'
import { db } from './notebook'
import { recordMarkdown } from './record-markdown'
import { addTag, createRecord } from './records'
import { LABEL, slotsOf } from './relation-slots'
import { addLabel, addRelation, addToSlot } from './relations'
import { loadSqlite } from './sqlite'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

test('a Record becomes its title, a list of its fields, Tags and Relations by title, then its notes', () => {
  const sap = createRecord('system', 'SAP S/4HANA', {
    summary: 'ERP: finance and purchasing',
    url: 'https://sap.example.com',
    notes: '## What it does\n\nSystem of record for **purchase orders**. Fed by [[Coupa]].\n',
  })
  addTag('system', sap, 'finance')
  addTag('system', sap, 'erp')
  const owner = slotsOf('system')[0]
  addToSlot(owner, sap, { type: 'team', id: createRecord('team', 'Finance Systems') })
  addToSlot(owner, sap, { type: 'person', id: createRecord('person', 'Dan Ionescu') })
  const feeds = addLabel('feeds', 'is fed by')
  addRelation({ type: 'system', id: createRecord('system', 'Coupa') }, feeds, { type: 'system', id: sap })
  addRelation({ type: 'system', id: createRecord('system', 'Ariba') }, feeds, { type: 'system', id: sap })

  expect(recordMarkdown('system', sap)).toBe(
    [
      '# SAP S/4HANA',
      '',
      '- **Type:** System',
      '- **Summary:** ERP: finance and purchasing',
      '- **URL:** https://sap.example.com',
      '- **Tags:** erp, finance',
      '- **Owner:** Dan Ionescu, Finance Systems',
      '- **Is fed by:** Ariba, Coupa',
      '',
      '## What it does',
      '',
      'System of record for **purchase orders**. Fed by [[Coupa]].',
      '',
    ].join('\n'),
  )
})

test('empty fields are left out, a checkbox reads Yes or No, and empty notes add nothing', () => {
  const task = createRecord('task', 'Map invoice fields', { due: '2026-11-20' })
  const person = createRecord('person', 'Mara Stan')

  expect(recordMarkdown('task', task)).toBe('# Map invoice fields\n\n- **Type:** Task\n- **Done:** No\n- **Due:** 2026-11-20\n')
  expect(recordMarkdown('person', person)).toBe('# Mara Stan\n\n- **Type:** Person\n')
})

test("an Open question's answer and its notes each get a heading", () => {
  const q = createRecord('open_question', 'Who approves POs?', {
    status: 'answered',
    answer: 'The **cost centre owner**.',
    notes: 'Came up in the kick-off.',
  })

  expect(recordMarkdown('open_question', q)).toBe(
    '# Who approves POs?\n\n- **Type:** Open question\n- **Status:** answered\n\n## Answer\n\nThe **cost centre owner**.\n\n## Notes\n\nCame up in the kick-off.\n',
  )
})

test("a Project's Tasks are a checklist", () => {
  const project = { type: 'project' as const, id: createRecord('project', 'Invoice migration', { status: 'active' }) }
  addRelation({ type: 'task', id: createRecord('task', 'Map fields', { done: true }) }, LABEL.partOf, project)
  addRelation({ type: 'task', id: createRecord('task', 'Book workshop') }, LABEL.partOf, project)

  expect(recordMarkdown('project', project.id)).toBe(
    '# Invoice migration\n\n- **Type:** Project\n- **Status:** active\n\n## Tasks\n\n- [ ] Book workshop\n- [x] Map fields\n',
  )
})

test('a Diagram leaves its canvas out, and a Record that is gone gives nothing', () => {
  const d = createRecord('diagram', 'Landscape', { canvas: '{"nodes":[]}', notes: 'Drawn after the kick-off.' })

  expect(recordMarkdown('diagram', d)).toBe('# Landscape\n\n- **Type:** Diagram\n\nDrawn after the kick-off.\n')
  expect(recordMarkdown('diagram', 99)).toBe('')
})
