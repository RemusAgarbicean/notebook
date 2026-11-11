import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { describeBackup, formatSize } from './backups'
import { db, listBackups, markDirty, openNotebook, restoreBackup, saveNow, takeBackup } from './notebook'
import { saveStatus } from './save-status'
import { loadSqlite } from './sqlite'
import { memoryFolder } from './storage-memory'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 11, 9, 30, 5))
})
afterEach(() => vi.useRealTimers())

const onDisk = async (bytes: Uint8Array | null | undefined, sql: string) =>
  new (await loadSqlite()).Database(bytes!).exec(sql)[0].values
const teams = () => (db.value!.exec('select title from team order by id')[0]?.values ?? []).flat()

const addTeam = (title: string) => {
  db.value!.run('insert into team (title) values (?)', [title])
  markDirty()
}

// A Notebook with Procurement saved and backed up, then Analytics added on top.
async function backedUp() {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  addTeam('Procurement')
  await takeBackup('import')
  addTeam('Analytics')
  return { folder, backup: 'notebook-2026-11-11-093005-import.sqlite' }
}

test('a Backup file name says its date, time and kind', () => {
  expect(describeBackup('notebook-2026-11-11.sqlite')).toEqual({ date: '2026-11-11', time: null, kind: 'Daily' })
  expect(describeBackup('notebook-2026-11-11-093005-import.sqlite')).toEqual({
    date: '2026-11-11',
    time: '09:30:05',
    kind: 'Before import',
  })
  expect(describeBackup('notebook-2026-11-10-180000-pre-upgrade.sqlite')?.kind).toBe('Before upgrade')
  expect(describeBackup('notebook-2026-11-10-180000-restore.sqlite')?.kind).toBe('Before restore')
  expect(describeBackup('notebook-2026-11-10-180000-manual.sqlite')?.kind).toBe('Manual')
  expect(describeBackup('readme.txt')).toBeNull()
})

test('listBackups lists the Backups newest first, the daily one last within its day, with sizes', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  for (const name of [
    'notebook-2026-11-10.sqlite',
    'notebook-2026-11-11.sqlite',
    'notebook-2026-11-11-080000-import.sqlite',
    'notebook-2026-11-11-093005-pre-upgrade.sqlite',
    'readme.txt',
  ])
    folder.backups.set(name, new Uint8Array(2048))

  const list = await listBackups()

  expect(list.map((b) => b.name)).toEqual([
    'notebook-2026-11-11-093005-pre-upgrade.sqlite',
    'notebook-2026-11-11-080000-import.sqlite',
    'notebook-2026-11-11.sqlite',
    'notebook-2026-11-10.sqlite',
  ])
  expect(list[0]).toMatchObject({ date: '2026-11-11', time: '09:30:05', kind: 'Before upgrade', size: 2048 })
})

test('restoring a Backup backs up the current state, then puts the Backup in the app and on disk', async () => {
  const { folder, backup } = await backedUp()
  const before = db.value

  await restoreBackup(backup)

  expect(teams()).toEqual(['Procurement'])
  expect(db.value).not.toBe(before)
  expect(saveStatus.value).toBe('saved')
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['Procurement']])
  // The unsaved Analytics edit is in the Backup taken before restoring.
  expect(
    await onDisk(folder.backups.get('notebook-2026-11-11-093005-restore.sqlite'), 'select title from team order by id'),
  ).toEqual([['Procurement'], ['Analytics']])
  // Edits after a restore save as usual.
  addTeam('Finance')
  await saveNow()
  expect(await onDisk(folder.file, 'select count(*) from team')).toEqual([[2]])
})

test('restoring changes nothing when the Backup of the current state cannot be taken', async () => {
  const { folder, backup } = await backedUp()
  await saveNow()
  const file = folder.file
  folder.writeBackup = () => Promise.reject(new Error('disk full'))

  await expect(restoreBackup(backup)).rejects.toThrow('disk full')

  expect(teams()).toEqual(['Procurement', 'Analytics'])
  expect(folder.file).toBe(file)
})

test('an older Backup is upgraded when it is restored', async () => {
  const { folder } = await backedUp()
  const old = new (await loadSqlite()).Database()
  old.run('create table keepsake (x)')
  folder.backups.set('notebook-2026-11-01.sqlite', old.export())

  await restoreBackup('notebook-2026-11-01.sqlite')

  expect(teams()).toEqual([])
  expect(db.value!.exec('select count(*) from keepsake')[0].values).toEqual([[0]])
  expect(await onDisk(folder.file, 'pragma user_version')).toEqual([[2]])
})

test('a Backup from a newer app version, a broken one or a missing one is refused and nothing changes', async () => {
  const { folder } = await backedUp()
  const newer = new (await loadSqlite()).Database()
  newer.run('pragma user_version = 99')
  folder.backups.set('notebook-2026-11-02.sqlite', newer.export())
  folder.backups.set('notebook-2026-11-03.sqlite', new TextEncoder().encode('not a database, just some text'))

  await expect(restoreBackup('notebook-2026-11-02.sqlite')).rejects.toThrow('newer version of the app')
  await expect(restoreBackup('notebook-2026-11-03.sqlite')).rejects.toThrow('not a SQLite database')
  await expect(restoreBackup('notebook-2026-11-04.sqlite')).rejects.toThrow('no longer in the folder')

  expect(teams()).toEqual(['Procurement', 'Analytics'])
  expect([...folder.backups.keys()].filter((n) => n.includes('restore'))).toEqual([])
})

test('sizes read as KB or MB', () => {
  expect(formatSize(0)).toBe('0 KB')
  expect(formatSize(40960)).toBe('40 KB')
  expect(formatSize(3 * 1024 * 1024 + 512 * 1024)).toBe('3.5 MB')
})

test('restoring backs up what is in the app even when notebook.sqlite is gone from the folder', async () => {
  const { folder, backup } = await backedUp()
  await saveNow()
  folder.file = null // deleted or moved outside the app

  await restoreBackup(backup)

  expect(
    await onDisk(folder.backups.get('notebook-2026-11-11-093005-restore.sqlite'), 'select title from team order by id'),
  ).toEqual([['Procurement'], ['Analytics']])
  expect(teams()).toEqual(['Procurement'])
})

// E
test('a save asked for while a restore is writing waits for it instead of writing over the restored file', async () => {
  const { folder, backup } = await backedUp()
  await saveNow()
  const write = folder.write.bind(folder)
  const listBackups = folder.listBackups.bind(folder)
  let release = () => {}
  let reached = () => {}
  let racing = false
  folder.listBackups = async () => {
    if (racing) {
      racing = false
      reached()
      await new Promise<void>((r) => (release = r))
    }
    return listBackups()
  }
  folder.write = async (bytes) => {
    // The restore's write: an edit sneaks in and its save gets as far as it can before the file lands.
    addTeam('Late')
    racing = true
    void saveNow()
    await Promise.race([new Promise<void>((r) => (reached = r)), vi.advanceTimersByTimeAsync(50)])
    racing = false
    await write(bytes)
    release()
  }

  await restoreBackup(backup)
  await saveNow()

  expect(teams()).toEqual(['Procurement'])
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['Procurement']])
})
