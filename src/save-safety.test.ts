import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  db,
  markDirty,
  openNotebook,
  overwriteDisk,
  reloadFromDisk,
  saveNow,
  saveProblem,
} from './notebook'
import { saveStatus } from './save-status'
import { loadSqlite } from './sqlite'
import { memoryFolder } from './storage-memory'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const onDisk = async (bytes: Uint8Array | null, sql: string) =>
  new (await loadSqlite()).Database(bytes!).exec(sql)[0].values

const addTeam = (title: string) => {
  db.value!.run('insert into team (title) values (?)', [title])
  markDirty()
}

// Plays DB Browser: adds a Team straight to the file on disk.
async function editOutsideTheApp(folder: ReturnType<typeof memoryFolder>, title: string) {
  const other = new (await loadSqlite()).Database(folder.file!)
  other.run('insert into team (title) values (?)', [title])
  folder.file = other.export()
  folder.modified++
}

async function conflict() {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  await editOutsideTheApp(folder, 'From DB Browser')
  addTeam('From the app')
  await vi.advanceTimersByTimeAsync(1000)
  return folder
}

const leaving = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

test('a file changed outside the app is not overwritten and autosave stops', async () => {
  const folder = await conflict()

  expect(saveProblem.value).toBe('changed')
  expect(saveStatus.value).toBe('unsaved')
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['From DB Browser']])

  addTeam('Another')
  await vi.advanceTimersByTimeAsync(1000)
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['From DB Browser']])
  expect(leaving()).toBe(true)
})

test('Reload from disk drops the unsaved edits and loads the outside change', async () => {
  await conflict()

  await reloadFromDisk()

  expect(db.value!.exec('select title from team')[0].values).toEqual([['From DB Browser']])
  expect(saveProblem.value).toBeNull()
  expect(saveStatus.value).toBe('saved')
})

test('Overwrite writes the app version and autosave resumes', async () => {
  const folder = await conflict()

  await overwriteDisk()

  expect(await onDisk(folder.file, 'select title from team')).toEqual([['From the app']])
  expect(saveProblem.value).toBeNull()

  addTeam('Later')
  await vi.advanceTimersByTimeAsync(1000)
  expect(await onDisk(folder.file, 'select count(*) from team')).toEqual([[2]])
  expect(saveProblem.value).toBeNull()
})

test('a failed write keeps the edit, flags the failure, and the next edit retries', async () => {
  const folder = memoryFolder()
  await openNotebook(folder, true)
  const write = folder.write
  folder.write = () => Promise.reject(new Error('permission revoked'))

  addTeam('Procurement')
  await vi.advanceTimersByTimeAsync(1000)

  expect(saveProblem.value).toBe('failed')
  expect(db.value!.exec('select title from team')[0].values).toEqual([['Procurement']])
  expect(leaving()).toBe(true)

  folder.write = write
  addTeam('Analytics')
  await vi.advanceTimersByTimeAsync(1000)

  expect(saveProblem.value).toBeNull()
  expect(await onDisk(folder.file, 'select count(*) from team')).toEqual([[2]])
  expect(leaving()).toBe(false)
})
