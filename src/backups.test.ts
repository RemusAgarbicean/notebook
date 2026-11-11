import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { backupsToDelete, describeBackup, writeBackup } from './backups'
import { db, markDirty, openNotebook, saveNow, takeBackup } from './notebook'
import { loadSqlite } from './sqlite'
import { memoryFolder } from './storage-memory'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 11, 9, 30, 5))
})
afterEach(() => vi.useRealTimers())

const onDisk = async (bytes: Uint8Array | null | undefined, sql: string) =>
  new (await loadSqlite()).Database(bytes!).exec(sql)[0].values

const addTeam = (title: string) => {
  db.value!.run('insert into team (title) values (?)', [title])
  markDirty()
}

test('rotation keeps the newest 14 Backups and ignores other files', () => {
  const names = Array.from(
    { length: 16 },
    (_, i) => `notebook-2026-11-${String(i + 1).padStart(2, '0')}.sqlite`,
  )

  expect(backupsToDelete([...names].reverse().concat('readme.txt'))).toEqual([
    'notebook-2026-11-02.sqlite',
    'notebook-2026-11-01.sqlite',
  ])
  expect(backupsToDelete(names.slice(0, 14))).toEqual([])
})

test('the first save of a day copies the file as it was to a dated Backup, later saves do not', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)

  addTeam('Procurement')
  await saveNow()
  addTeam('Analytics')
  await saveNow()

  expect([...folder.backups.keys()]).toEqual(['notebook-2026-11-11.sqlite'])
  expect(
    await onDisk(folder.backups.get('notebook-2026-11-11.sqlite'), 'select count(*) from team'),
  ).toEqual([[0]])

  vi.setSystemTime(new Date(2026, 10, 12, 8, 0, 0))
  addTeam('Finance')
  await saveNow()

  expect([...folder.backups.keys()]).toEqual([
    'notebook-2026-11-11.sqlite',
    'notebook-2026-11-12.sqlite',
  ])
  expect(
    await onDisk(folder.backups.get('notebook-2026-11-12.sqlite'), 'select count(*) from team'),
  ).toEqual([[2]])
})

test('a 15th Backup deletes the oldest', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  for (let day = 1; day <= 14; day++)
    folder.backups.set(`notebook-2026-10-${String(day).padStart(2, '0')}.sqlite`, new Uint8Array())

  addTeam('Procurement')
  await saveNow()

  expect(folder.backups.size).toBe(14)
  expect(folder.backups.has('notebook-2026-10-01.sqlite')).toBe(false)
  expect(folder.backups.has('notebook-2026-10-02.sqlite')).toBe(true)
  expect(folder.backups.has('notebook-2026-11-11.sqlite')).toBe(true)
})

test('opening a file that needs a migration writes a pre-upgrade Backup of the old file first', async () => {
  const old = new (await loadSqlite()).Database()
  old.run('create table keepsake (x)')
  const folder = memoryFolder(old.export())

  await openNotebook(folder)

  const name = 'notebook-2026-11-11-093005-pre-upgrade.sqlite'
  expect([...folder.backups.keys()]).toEqual([name])
  expect(await onDisk(folder.backups.get(name), 'pragma user_version')).toEqual([[0]])
  expect(await onDisk(folder.file, 'pragma user_version')).toEqual([[1]])
})

test('opening an up-to-date file takes no Backup', async () => {
  const first = memoryFolder()
  await openNotebook(first, true)
  const folder = memoryFolder(first.file)

  await openNotebook(folder)

  expect(folder.backups.size).toBe(0)
})

test('takeBackup saves pending edits and copies the file under the given reason', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  addTeam('Procurement')

  await takeBackup('import')

  const backup = folder.backups.get('notebook-2026-11-11-093005-import.sqlite')
  expect(await onDisk(backup, 'select title from team')).toEqual([['Procurement']])
})

test('daily Backups and reason Backups rotate separately, 14 of each', () => {
  const dailies = Array.from({ length: 14 }, (_, i) => `notebook-2026-10-${String(i + 1).padStart(2, '0')}.sqlite`)
  const imports = Array.from({ length: 15 }, (_, i) => `notebook-2026-11-11-0930${String(i).padStart(2, '0')}-import.sqlite`)
  const upgrade = 'notebook-2026-11-01-080000-pre-upgrade.sqlite'

  // A day of imports evicts no daily Backup, only the oldest reason Backups.
  expect(backupsToDelete([...dailies, ...imports])).toEqual(['notebook-2026-11-11-093000-import.sqlite'])
  // And a 15th daily Backup evicts no reason Backup.
  expect(backupsToDelete([...dailies, 'notebook-2026-10-15.sqlite', upgrade, ...imports.slice(0, 13)])).toEqual([
    'notebook-2026-10-01.sqlite',
  ])
})

test('takeBackup rejects, and copies nothing, when the save before it fails', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  folder.write = () => Promise.reject(new Error('permission revoked'))
  addTeam('Procurement')

  await expect(takeBackup('import')).rejects.toThrow('could not be saved')

  expect([...folder.backups.keys()].filter((n) => n.includes('import'))).toEqual([])
})

test('takeBackup rejects when the file was changed outside the app', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  folder.modified++
  addTeam('Procurement')

  await expect(takeBackup('import')).rejects.toThrow('could not be saved')

  expect(folder.backups.size).toBe(0)
})

test('two Backups for the same reason in the same second are both kept', async () => {
  const folder = memoryFolder(new Uint8Array([1]))

  await writeBackup(folder, 'import')
  folder.file = new Uint8Array([2])
  await writeBackup(folder, 'import')

  const names = [...folder.backups.keys()]
  expect(names).toHaveLength(2)
  expect(folder.backups.get(names[0])).toEqual(new Uint8Array([1]))
  expect(names.map((n) => describeBackup(n))).toEqual([
    { date: '2026-11-11', time: '09:30:05', kind: 'Before import' },
    { date: '2026-11-11', time: '09:30:05', kind: 'Before import' },
  ])
})
