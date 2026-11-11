import { expect, test } from 'vitest'
import { MIGRATIONS, migrate, schemaVersion } from './migrations'
import { openNotebook } from './notebook'
import { memoryFolder } from './storage-memory'
import { loadSqlite } from './sqlite'

const emptyDb = async () => new (await loadSqlite()).Database()

test('migrating an empty database creates every table, seeds the 8 labels and sets user_version to the latest', async () => {
  const db = await emptyDb()

  expect(migrate(db)).toBe(true)

  expect(db.exec('pragma user_version')[0].values).toEqual([[2]])
  expect(schemaVersion(db)).toBe(2)
  const tables = db.exec("select name from sqlite_master where type = 'table' order by name")
  expect(tables[0].values.flat()).toEqual([
    'acronym',
    'bookmark',
    'diagram',
    'image',
    'journal_entry',
    'label',
    'open_question',
    'person',
    'process',
    'project',
    'record_tag',
    'relation',
    'setting',
    'sqlite_sequence',
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

// A Notebook as the first version of the app left it.
async function version1() {
  const db = await emptyDb()
  db.exec(MIGRATIONS[0])
  db.run('pragma user_version = 1')
  db.run("insert into system (title, notes) values ('Coupa', 'Where POs live')")
  db.run("insert into tag (name) values ('finance')")
  db.run("insert into record_tag (tag_id, type, id) values (1, 'system', 1)")
  return db
}

test('a version-1 Notebook upgrades to hold Images, with its data intact', async () => {
  const db = await version1()

  expect(migrate(db)).toBe(true)

  expect(schemaVersion(db)).toBe(2)
  expect(db.exec('select title, notes from system')[0].values).toEqual([['Coupa', 'Where POs live']])
  expect(db.exec('select count(*) from record_tag')[0].values).toEqual([[1]])
  expect(db.exec('select count(*) from label')[0].values).toEqual([[8]])
  expect(db.exec('select count(*) from image')[0].values).toEqual([[0]])
})

test('opening a version-1 file keeps it as a pre-upgrade Backup before upgrading it', async () => {
  const old = (await version1()).export()
  const folder = memoryFolder(old)

  await openNotebook(folder)

  const [[name, bytes]] = [...folder.backups]
  expect(name).toMatch(/pre-upgrade\.sqlite$/)
  expect(bytes).toEqual(old)
  const onDisk = new (await loadSqlite()).Database(folder.file)
  expect(schemaVersion(onDisk)).toBe(2)
  expect(onDisk.exec('select title from system')[0].values).toEqual([['Coupa']])
})

test('an Image keeps its bytes through an export and a reopen', async () => {
  const db = await emptyDb()
  migrate(db)
  const data = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 31) % 256)

  db.run("insert into image (owner_type, owner_id, mime, width, height, bytes, data) values ('system', 1, 'image/png', 4, 3, ?, ?)", [
    data.length,
    data,
  ])
  const reopened = new (await loadSqlite()).Database(db.export())

  const [[id, stored]] = reopened.exec('select id, data from image')[0].values
  expect(id).toBe(1)
  expect(stored).toBeInstanceOf(Uint8Array)
  expect(stored).toEqual(data)
})
