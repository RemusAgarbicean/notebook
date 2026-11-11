import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db, markDirty, openNotebook, saveNow } from './notebook'
import { saveStatus } from './save-status'
import { loadSqlite } from './sqlite'
import { memoryFolder } from './storage-memory'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

// What a second program (DB Browser) would see in the file on disk.
const onDisk = async (bytes: Uint8Array | null, sql: string) =>
  new (await loadSqlite()).Database(bytes!).exec(sql)[0].values

const addTeam = (title: string) => {
  db.value!.run('insert into team (title) values (?)', [title])
  markDirty()
}

test('creating a Notebook in an empty folder writes a migrated notebook.sqlite', async () => {
  const folder = memoryFolder()

  expect(await openNotebook(folder, true)).toBe(true)

  expect(await onDisk(folder.file, 'pragma user_version')).toEqual([[1]])
  expect(await onDisk(folder.file, 'select count(*) from label')).toEqual([[8]])
  expect(saveStatus.value).toBe('saved')
})

test('opening a folder without notebook.sqlite reports it is missing and writes nothing', async () => {
  const folder = memoryFolder()

  expect(await openNotebook(folder)).toBe(false)

  expect(folder.file).toBeNull()
})

test('an edit is on disk 1 s after the last edit', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)

  addTeam('Procurement')
  expect(saveStatus.value).toBe('unsaved')
  await vi.advanceTimersByTimeAsync(900)
  addTeam('Analytics')
  await vi.advanceTimersByTimeAsync(900)
  expect(await onDisk(folder.file, 'select count(*) from team')).toEqual([[0]])

  await vi.advanceTimersByTimeAsync(100)

  expect(await onDisk(folder.file, 'select title from team')).toEqual([
    ['Procurement'],
    ['Analytics'],
  ])
  expect(saveStatus.value).toBe('saved')
})

test('reopening the folder loads the same data', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  addTeam('Procurement')
  await saveNow()

  await openNotebook(memoryFolder(folder.file))

  expect(db.value!.exec('select title from team')[0].values).toEqual([['Procurement']])
})

test('Cmd/Ctrl+S saves immediately', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  addTeam('Procurement')

  const key = new KeyboardEvent('keydown', { key: 's', metaKey: true, cancelable: true })
  window.dispatchEvent(key)
  await vi.advanceTimersByTimeAsync(0)

  expect(key.defaultPrevented).toBe(true)
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['Procurement']])
})

test('hiding or leaving the page saves immediately', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)

  addTeam('Procurement')
  window.dispatchEvent(new Event('pagehide'))
  await vi.advanceTimersByTimeAsync(0)
  expect(await onDisk(folder.file, 'select count(*) from team')).toEqual([[1]])

  addTeam('Analytics')
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(0)
  expect(await onDisk(folder.file, 'select count(*) from team')).toEqual([[2]])
})

test('the status reads saving while the file is being written', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  let finish = () => {}
  folder.write = () => new Promise<void>((resolve) => (finish = resolve))

  addTeam('Procurement')
  const saving = saveNow()
  await vi.advanceTimersByTimeAsync(0)
  expect(saveStatus.value).toBe('saving')

  finish()
  await saving
  expect(saveStatus.value).toBe('saved')
})

test('an edit made during a save is not reported as saved', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  const write = folder.write
  let finish = () => {}
  folder.write = () => new Promise<void>((resolve) => (finish = resolve))

  addTeam('Procurement')
  const saving = saveNow()
  await vi.advanceTimersByTimeAsync(0)
  addTeam('Analytics')
  finish()
  await saving
  expect(saveStatus.value).toBe('unsaved')

  folder.write = write
  await vi.advanceTimersByTimeAsync(1000)
  expect(await onDisk(folder.file, 'select count(*) from team')).toEqual([[2]])
  expect(saveStatus.value).toBe('saved')
})

test('a failed save keeps the edit, reads Not saved, and the next save retries', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  const write = folder.write
  folder.write = () => Promise.reject(new Error('disk full'))

  addTeam('Procurement')
  await saveNow()
  expect(saveStatus.value).toBe('unsaved')

  folder.write = write
  await saveNow()
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['Procurement']])
  expect(saveStatus.value).toBe('saved')
})
