import { beforeEach, expect, test } from 'vitest'
import { migrate } from './migrations'
import { db } from './notebook'
import { isPinned, pinnedRecords, setPinned } from './pins'
import { createRecord, deleteRecord } from './records'
import { loadSqlite } from './sqlite'
import { undoDelete } from './undo-delete'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

test('pinned Records are listed by title, across types, and can be unpinned', () => {
  const sap = { type: 'system', id: createRecord('system', 'SAP') } as const
  const maria = { type: 'person', id: createRecord('person', 'Maria') } as const
  createRecord('system', 'Coupa')

  setPinned(sap, true)
  setPinned(maria, true)
  setPinned(maria, true)
  expect(pinnedRecords()).toEqual([
    { ...maria, title: 'Maria' },
    { ...sap, title: 'SAP' },
  ])

  setPinned(sap, false)
  expect(isPinned(sap)).toBe(false)
  expect(isPinned(maria)).toBe(true)
})

test('pins are saved in the Notebook file', async () => {
  const sap = { type: 'system', id: createRecord('system', 'SAP') } as const
  setPinned(sap, true)

  db.value = new (await loadSqlite()).Database(db.value!.export())

  expect(isPinned(sap)).toBe(true)
})

test('deleting a pinned Record drops its pin, so a later Record with its id is not pinned; Undo pins it again', () => {
  const sap = { type: 'system', id: createRecord('system', 'SAP') } as const
  setPinned(sap, true)

  deleteRecord('system', sap.id)
  expect(db.value!.exec("select value from setting where key = 'pinned'")[0].values[0][0]).toBe('[]')

  undoDelete()
  expect(isPinned(sap)).toBe(true)
})
