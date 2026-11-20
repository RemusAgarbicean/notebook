import { expect, test } from 'vitest'
import { MIGRATIONS, migrate, schemaVersion } from './migrations'
import { openNotebook } from './notebook'
import { memoryFolder } from './storage-memory'
import { loadSqlite } from './sqlite'

const emptyDb = async () => new (await loadSqlite()).Database()

test('migrating an empty database creates every table, seeds the 9 labels and sets user_version to the latest', async () => {
  const db = await emptyDb()

  expect(migrate(db)).toBe(true)

  expect(db.exec('pragma user_version')[0].values).toEqual([[4]])
  expect(schemaVersion(db)).toBe(4)
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
    'question',
    'question_set',
    'question_set_item',
    'questionnaire',
    'questionnaire_item',
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
    ['responds to', 'has respondent', 1],
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
  expect(db.exec('select count(*) from label')[0].values).toEqual([[9]])
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

  expect(schemaVersion(db)).toBe(4)
  expect(db.exec('select title, notes from system')[0].values).toEqual([['Coupa', 'Where POs live']])
  expect(db.exec('select count(*) from record_tag')[0].values).toEqual([[1]])
  expect(db.exec('select count(*) from label')[0].values).toEqual([[9]])
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
  expect(schemaVersion(onDisk)).toBe(4)
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

// A Notebook as the second version of the app left it, with a label of the user's own.
async function version2() {
  const db = await emptyDb()
  db.exec(MIGRATIONS[0])
  db.exec(MIGRATIONS[1])
  db.run('pragma user_version = 2')
  db.run("insert into label (forward, reverse) values ('reports to', 'manages')")
  db.run("insert into person (title) values ('Maria'), ('Stefan')")
  db.run("insert into relation (from_type, from_id, label_id, to_type, to_id) values ('person', 1, 9, 'person', 2)")
  return db
}

test('a version-2 Notebook upgrades to hold Questionnaires, and its own label that had id 9 keeps its Relations', async () => {
  const db = await version2()

  expect(migrate(db)).toBe(true)

  expect(schemaVersion(db)).toBe(4)
  expect(db.exec('select forward, reverse, protected from label where id = 9')[0].values).toEqual([
    ['responds to', 'has respondent', 1],
  ])
  expect(
    db.exec('select l.forward from relation r join label l on l.id = r.label_id where r.from_id = 1 and r.to_id = 2')[0].values,
  ).toEqual([['reports to']])
  expect(db.exec('select count(*) from label')[0].values).toEqual([[10]])
})

test("a version-3 Notebook's Items upgrade with their follow-up answer not yet taken", async () => {
  const db = await emptyDb()
  for (const sql of MIGRATIONS.slice(0, 3)) db.exec(sql)
  db.run('pragma user_version = 3')
  db.run("insert into questionnaire_item (questionnaire_id, text, follow_up_id) values (1, 'What does success look like?', 7)")

  expect(migrate(db)).toBe(true)

  expect(db.exec('select follow_up_id, follow_up_taken from questionnaire_item')[0].values).toEqual([[7, 0]])
})

test('the starter Question bank has about 40 Questions in 9 categories, and 3 starter sets of them', async () => {
  const db = await emptyDb()
  migrate(db)
  const all = (sql: string) => db.exec(sql)[0]?.values ?? []

  const [[questions, categories]] = all('select count(*), count(distinct category) from question') as number[][]
  expect(questions).toBeGreaterThanOrEqual(38)
  expect(questions).toBeLessThanOrEqual(45)
  expect(categories).toBe(9)
  expect(all('select category from question group by category order by min(position)').flat()).toEqual([
    'Goals and scope',
    'Stakeholders',
    'Requirements',
    'Access',
    'Dependencies',
    'Data',
    'Timeline and budget',
    'Risks',
    'Non-functional',
  ])
  expect(all('select name from question_set order by position').flat()).toEqual([
    'New project intake',
    'Access request',
    'Integration / dependency check',
  ])
  // Every set has Questions, every member exists, and no set lists a Question twice.
  expect(all('select count(*) from question_set s where not exists (select 1 from question_set_item i where i.set_id = s.id)')).toEqual([[0]])
  expect(all('select count(*) from question_set_item i where not exists (select 1 from question q where q.id = i.question_id)')).toEqual([[0]])
  expect(all('select count(*) from (select 1 from question_set_item group by set_id, question_id having count(*) > 1)')).toEqual([[0]])
  // A choice Question has options; a number can have a unit; a scale has its two ends.
  expect(all("select count(*) from question where answer_type in ('single_choice', 'multi_choice') and json_array_length(options) = 0")).toEqual([[0]])
  expect(all("select options from question where text = 'Which environments are involved?'")).toEqual([['["Dev","Test","Acceptance","Production"]']])
  expect(all("select answer_type, unit from question where text = 'How many users?'")).toEqual([['number', 'users']])
  expect(all("select id from question where answer_type = 'scale' and (scale_low is null or scale_high is null)")).toEqual([])
})

test('a Questionnaire starts as a draft and takes only its three statuses', async () => {
  const db = await emptyDb()
  migrate(db)

  db.run("insert into questionnaire (title) values ('Intake')")

  expect(db.exec('select status from questionnaire')[0].values).toEqual([['draft']])
  expect(() => db.run("update questionnaire set status = 'closed'")).toThrow()
})
