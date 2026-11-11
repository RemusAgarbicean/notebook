// The fallback for browsers without the File System Access API: the Notebook
// lives in memory and reaches the disk only as a download the user asks for.
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { closeNotebook, db, markDirty, openNotebook, saveNow, takeBackup } from './notebook'
import { saveStatus } from './save-status'
import { loadSqlite } from './sqlite'
import type { NotebookStorage } from './storage'
import { downloadFolder } from './storage-download'
import { memoryFolder } from './storage-memory'

beforeEach(() => {
  closeNotebook()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const query = async (bytes: Uint8Array, sql: string) =>
  new (await loadSqlite()).Database(bytes).exec(sql)[0]?.values ?? []

const addTeam = (title: string) => {
  db.value!.run('insert into team (title) values (?)', [title])
  markDirty()
}

const leaving = () => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

// Every file the browser would have put in the Downloads folder.
function downloads() {
  const files: { name: string; bytes: Uint8Array }[] = []
  return { files, save: (bytes: Uint8Array, name: string) => void files.push({ name, bytes }) }
}

const fileOf = (bytes: Uint8Array, name = 'notebook.sqlite') =>
  ({ name, arrayBuffer: async () => bytes.slice().buffer }) as File

test('a new Notebook opens without downloading anything', async () => {
  const { files, save } = downloads()

  expect(await openNotebook(downloadFolder(null, save), true)).toBe(true)

  expect(files).toEqual([])
  expect(saveStatus.value).toBe('saved')
  expect(leaving()).toBe(false)
})

test('an edit is never downloaded on its own, and leaving asks first', async () => {
  const { files, save } = downloads()
  await openNotebook(downloadFolder(null, save), true)

  addTeam('Payments')
  await vi.advanceTimersByTimeAsync(5000)
  window.dispatchEvent(new Event('pagehide'))
  await saveNow()

  expect(files).toEqual([])
  expect(saveStatus.value).toBe('unsaved')
  expect(leaving()).toBe(true)
})

test('asking for a save downloads notebook.sqlite once, with the edits and no Backup', async () => {
  const { files, save } = downloads()
  await openNotebook(downloadFolder(null, save), true)
  addTeam('Payments')

  await saveNow(true)

  expect(files.map((f) => f.name)).toEqual(['notebook.sqlite'])
  expect(await query(files[0].bytes, 'select title from team')).toEqual([['Payments']])
  expect(saveStatus.value).toBe('saved')
  expect(leaving()).toBe(false)
})

test('Cmd/Ctrl+S downloads', async () => {
  const { files, save } = downloads()
  await openNotebook(downloadFolder(null, save), true)
  addTeam('Payments')

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
  await saveNow()

  expect(files.map((f) => f.name)).toEqual(['notebook.sqlite'])
})

test('the Notebook can be downloaded again without new edits', async () => {
  const { files, save } = downloads()
  await openNotebook(downloadFolder(null, save), true)

  await saveNow(true)

  expect(files).toHaveLength(1)
})

test('an opened file shows its Records, and upgrading an old one downloads nothing', async () => {
  const SQL = await loadSqlite()
  const source = memoryFolder()
  await openNotebook(source, true)
  addTeam('Payments')
  await saveNow()
  const { files, save } = downloads()

  await openNotebook(downloadFolder(fileOf(source.file!), save))
  expect(db.value!.exec('select title from team')[0].values).toEqual([['Payments']])

  await openNotebook(downloadFolder(fileOf(new SQL.Database().export()), save))
  expect(db.value!.exec('select count(*) from label')[0].values).toEqual([[8]])
  expect(files).toEqual([])
})

test('a Backup before an import is one download of the Notebook as it was', async () => {
  const { files, save } = downloads()
  await openNotebook(downloadFolder(null, save), true)
  addTeam('Before the import')

  await takeBackup('import')
  addTeam('Imported')

  expect(files).toHaveLength(1)
  expect(files[0].name).toMatch(/^notebook-\d{4}-\d\d-\d\d-\d{6}-import\.sqlite$/)
  expect(await query(files[0].bytes, 'select title from team')).toEqual([['Before the import']])
  // The Backup is not the Notebook: the edits still wait for a download.
  expect(saveStatus.value).toBe('unsaved')
})

test('with a folder, leaving asks first while an edit still waits for autosave', async () => {
  await openNotebook(memoryFolder(), true)
  expect(leaving()).toBe(false)

  addTeam('Payments')
  expect(leaving()).toBe(true)

  await saveNow()
  expect(leaving()).toBe(false)
})

// ---- the screens

const fallbackStorage = (save: (bytes: Uint8Array, name: string) => void, picked: File | null = null) =>
  ({
    pick: async () => picked && downloadFolder(picked, save),
    lastName: async () => null,
    reopen: async () => null,
    blank: () => downloadFolder(null, save),
  }) satisfies NotebookStorage

async function start(storage: NotebookStorage) {
  vi.useRealTimers()
  const app = mount(App, { props: { storage } })
  await flushPromises()
  const click = async (name: string) => {
    await app.findAll('button').find((b) => b.text() === name)!.trigger('click')
    await flushPromises()
  }
  return { app, click }
}

test('without the File System Access API the start screen says what is lost and how to get it back', async () => {
  const { app } = await start(fallbackStorage(() => {}))

  expect(app.findAll('button').map((b) => b.text())).toEqual(['Open notebook.sqlite', 'Create new Notebook'])
  expect(app.text()).toContain('cannot open folders')
  expect(app.text()).toContain('Chrome or Edge')
  expect(app.text()).toContain('brave://flags/#file-system-access-api')
})

test('the sidebar shows what is not downloaded yet and Download Notebook downloads it', async () => {
  const { files, save } = downloads()
  const { app, click } = await start(fallbackStorage(save))
  await click('Create new Notebook')
  await expect.poll(() => app.find('[data-testid="save-status"]').exists()).toBe(true)
  const status = () => app.find('[data-testid="save-status"]').text()
  expect(status()).toBe('Nothing new to download')

  addTeam('Payments')
  await flushPromises()
  expect(status()).toBe('Changes not downloaded')

  await click('Download Notebook')
  await saveNow()
  await flushPromises()

  expect(files.map((f) => f.name)).toEqual(['notebook.sqlite'])
  expect(status()).toBe('Nothing new to download')
})

test('with a folder there is no Download Notebook button', async () => {
  const folder = memoryFolder()
  const { app, click } = await start({ pick: async () => folder, lastName: async () => null, reopen: async () => null })
  await click('Create new Notebook')
  await expect.poll(() => app.find('[data-testid="save-status"]').exists()).toBe(true)

  expect(app.find('[data-testid="save-status"]').text()).toBe('Saved')
  expect(app.text()).not.toContain('Download Notebook')
})
