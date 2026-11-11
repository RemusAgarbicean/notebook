import { expect, test } from 'vitest'
import { migrate, schemaVersion } from './migrations'
import { loadSqlite } from './sqlite'

const emptyDb = async () => new (await loadSqlite()).Database()

test('migrating an empty database creates every table, seeds the 8 labels and sets user_version to 1', async () => {
  const db = await emptyDb()

  expect(migrate(db)).toBe(true)

  expect(db.exec('pragma user_version')[0].values).toEqual([[1]])
  expect(schemaVersion(db)).toBe(1)
  const tables = db.exec("select name from sqlite_master where type = 'table' order by name")
  expect(tables[0].values.flat()).toEqual([
    'acronym',
    'bookmark',
    'diagram',
    'journal_entry',
    'label',
    'open_question',
    'person',
    'process',
    'project',
    'record_tag',
    'relation',
    'setting',
    'system',
    'tag',
    'task',
    'team',
  ])
  expect(db.exec('select forward, reverse, protected from label order by id')[0].values).toEqual([
    ['owns', 'owned by', 1],
    ['member of', 'has member', 1],
    ['ask about', 'go-to for', 1],
    ['attended', 'attended by', 1],
    ['uses', 'used by', 0],
    ['part of', 'contains', 1],
    ['related to', 'related to', 0],
    ['answered by', 'answers', 1],
  ])
})

test('a Record gets its notes, timestamps and type defaults automatically', async () => {
  const db = await emptyDb()
  migrate(db)

  db.run("insert into project (title) values ('Onboarding')")

  const [row] = db.exec('select id, title, notes, status, created_at = updated_at from project')[0]
    .values
  expect(row).toEqual([1, 'Onboarding', '', 'active', 1])
  expect(db.exec('select created_at from project')[0].values[0][0]).toMatch(
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/,
  )
})

test('a Relation cannot be saved twice or point at its own Record', async () => {
  const db = await emptyDb()
  migrate(db)
  const relate = (to: number) =>
    db.run(
      "insert into relation (from_type, from_id, label_id, to_type, to_id) values ('person', 1, 1, 'person', ?)",
      [to],
    )

  relate(2)

  expect(() => relate(2)).toThrow()
  expect(() => relate(1)).toThrow()
})

test('migrating an up-to-date database changes nothing', async () => {
  const db = await emptyDb()
  migrate(db)

  expect(migrate(db)).toBe(false)
  expect(db.exec('select count(*) from label')[0].values).toEqual([[8]])
})

test('a Notebook written by a newer app is refused', async () => {
  const db = await emptyDb()
  db.run('pragma user_version = 999')

  expect(() => migrate(db)).toThrow(/newer/)
})
