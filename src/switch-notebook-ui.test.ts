import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { list } from './navigation'
import { closeNotebook, db, markDirty, notebookName, openNotebook, saveNow } from './notebook'
import { paletteOpen } from './palette'
import { createRecord, deleteRecord, listRecords } from './records'
import { loadSqlite } from './sqlite'
import type { NotebookStorage } from './storage'
import { downloadFolder, downloadStorage } from './storage-download'
import { memoryFolder, memoryStorage } from './storage-memory'
import { lastDeleted } from './undo-delete'

let app: VueWrapper
let a: ReturnType<typeof memoryFolder>
let b: ReturnType<typeof memoryFolder>

// A Notebook on "disk" holding one System.
async function notebookWith(name: string, system: string) {
  const folder = memoryFolder(null, name)
  await openNotebook(folder, true)
  createRecord('system', system)
  markDirty()
  await saveNow()
  closeNotebook()
  return folder
}

const titles = () => listRecords('system').map((r) => r.title)
const get = (id: string) => app.get(`[data-testid="${id}"]`)
const items = () => app.findAll('[role="menuitem"]')
const item = (text: string) => items().find((i) => i.text().includes(text))!
const alert = () => app.find('[data-testid="sidebar"] [role="alert"]')

async function mountWith(storage: NotebookStorage, create = 'Create new Notebook') {
  app = mount(App, { props: { storage }, attachTo: document.body })
  await flushPromises()
  await app.findAll('button').find((x) => x.text() === create)!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
}

// Opens A by creating it from the start screen, with B among the Recent Notebooks.
async function start(storage?: NotebookStorage) {
  closeNotebook()
  b = await notebookWith('B notes', 'Tableau')
  a = memoryFolder(null, 'A notes')
  await mountWith(storage ?? memoryStorage(async () => a, [b]))
  createRecord('system', 'Coupa')
  markDirty()
  await flushPromises()
}

async function openMenu() {
  await get('notebook-menu').trigger('click')
  await flushPromises()
}

async function choose(text: string) {
  await openMenu()
  await item(text).trigger('click')
  await flushPromises()
}

const switchedTo = (name: string) => expect.poll(() => notebookName()).toBe(name)

beforeEach(() => {
  location.hash = ''
})
afterEach(() => app.unmount())

test('the sidebar header names the open Notebook and lists the Recent Notebooks, the open one marked', async () => {
  await start()

  expect(get('notebook-menu').text()).toBe('A notes')
  expect(get('notebook-menu').attributes('aria-expanded')).toBe('false')
  await openMenu()

  expect(get('notebook-menu').attributes('aria-expanded')).toBe('true')
  expect(items().map((i) => i.text())).toEqual([
    '✓ A notes',
    'B notes',
    'Open another folder…',
    'Create new Notebook…',
    'Close Notebook',
  ])
  expect(item('A notes').attributes('aria-disabled')).toBe('true')
})

test("switching to a Recent Notebook saves the open one, shows the other's Records and lands on Home", async () => {
  await start()
  list.value = 'system'
  await flushPromises()

  await choose('B notes')
  await switchedTo('B notes')
  await flushPromises()

  expect(titles()).toEqual(['Tableau'])
  expect(list.value).toBe('home')
  expect(app.find('[data-testid="home"]').exists()).toBe(true)
  expect(get('notebook-menu').text()).toBe('B notes')
  expect(get('save-status').text()).toBe('Saved')
  // A's edit reached its file before it was left.
  const onDisk = new (await loadSqlite()).Database(a.file!)
  expect(onDisk.exec('select title from system')[0].values).toEqual([['Coupa']])
  // And A can be switched back to, now marked as B was.
  await openMenu()
  expect(items().map((i) => i.text()).slice(0, 2)).toEqual(['✓ B notes', 'A notes'])
})

test('a switch drops the Undo delete and closes the palette of the Notebook that was open', async () => {
  await start()
  deleteRecord('system', listRecords('system')[0].id)
  await flushPromises()
  expect(lastDeleted()).not.toBeNull()
  await openMenu()
  // Say the palette is open over the menu: a switch closes it.
  paletteOpen.value = true
  await flushPromises()

  await item('B notes').trigger('click')
  await switchedTo('B notes')
  await flushPromises()

  expect(paletteOpen.value).toBe(false)
  expect(lastDeleted()).toBeNull()
  expect(app.find('[data-testid="undo-notice"]').exists()).toBe(false)
})

test('choosing the open Notebook does nothing', async () => {
  await start()
  list.value = 'system'
  await flushPromises()

  await choose('A notes')

  expect(notebookName()).toBe('A notes')
  expect(list.value).toBe('system')
  // The menu stays open: the item is inert.
  expect(app.find('[role="menu"]').exists()).toBe(true)
})

test('a save that fails keeps the open Notebook and says why', async () => {
  await start()
  a.write = async () => {
    throw new Error('disk full')
  }

  await choose('B notes')

  await expect.poll(() => alert().exists()).toBe(true)
  expect(alert().text()).toContain('could not be saved')
  expect(notebookName()).toBe('A notes')
  expect(titles()).toEqual(['Coupa'])
})

test('a refused permission keeps the open Notebook and says why', async () => {
  const storage = memoryStorage(async () => a, [])
  await start({ ...storage, reopen: async () => null })
  // B is remembered once A's list has it.
  await storage.remember(b)

  await choose('B notes')

  await expect.poll(() => alert().exists()).toBe(true)
  expect(alert().text()).toContain('permission')
  expect(notebookName()).toBe('A notes')
})

test('a Recent Notebook whose notebook.sqlite is gone keeps the open one, and can be removed from the list', async () => {
  const gone = memoryFolder(null, 'Gone notes')
  b = memoryFolder(null, 'unused')
  closeNotebook()
  a = memoryFolder(null, 'A notes')
  await mountWith(memoryStorage(async () => a, [gone]))

  await choose('Gone notes')

  await expect.poll(() => alert().exists()).toBe(true)
  expect(alert().text()).toContain("Can't find it")
  expect(notebookName()).toBe('A notes')
  await alert().findAll('button').find((x) => x.text() === 'Remove from list')!.trigger('click')
  await flushPromises()

  expect(alert().exists()).toBe(false)
  await openMenu()
  expect(items().map((i) => i.text())).not.toContain('Gone notes')
})

test('a file that is not a Notebook keeps the open one and says why', async () => {
  let picked = memoryFolder(new TextEncoder().encode('not sqlite'), 'Junk')
  closeNotebook()
  b = memoryFolder(null, 'unused')
  a = memoryFolder(null, 'A notes')
  await mountWith(
    memoryStorage(async () => (notebookName() ? picked : a)),
  )

  await choose('Open another folder…')

  await expect.poll(() => alert().exists()).toBe(true)
  expect(alert().text()).toContain('not a Notebook')
  expect(notebookName()).toBe('A notes')
  picked = a
})

test('Open another folder… and Create new Notebook… open the picked folder', async () => {
  let picked = memoryFolder(null, 'unused')
  await start(memoryStorage(async () => picked, []))
  picked = b

  await choose('Open another folder…')
  await switchedTo('B notes')
  expect(titles()).toEqual(['Tableau'])

  picked = memoryFolder(null, 'C notes')
  await choose('Create new Notebook…')
  await switchedTo('C notes')
  expect(titles()).toEqual([])
  expect(picked.file).not.toBeNull()
})

test('Close Notebook saves it and goes back to the start screen, which lists it first', async () => {
  await start()

  await choose('Close Notebook')

  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(false)
  expect(db.value).toBeNull()
  expect(a.file).not.toBeNull()
  expect(app.findAll('[data-testid="recent"]').map((r) => r.find('span').text())).toEqual(['A notes', 'B notes'])
})

test('Close Notebook does not leave a Notebook whose save fails', async () => {
  await start()
  a.write = async () => {
    throw new Error('disk full')
  }

  await choose('Close Notebook')

  await expect.poll(() => alert().exists()).toBe(true)
  expect(db.value).not.toBeNull()
})

test('the menu works from the keyboard', async () => {
  await start()
  const button = get('notebook-menu')
  ;(button.element as HTMLElement).focus()

  await button.trigger('keydown', { key: 'Enter' })
  await flushPromises()
  expect(app.find('[role="menu"]').exists()).toBe(true)
  expect(document.activeElement).toBe(items()[0].element)

  const menu = app.get('[role="menu"]')
  await menu.trigger('keydown', { key: 'ArrowDown' })
  expect(document.activeElement).toBe(items()[1].element)
  await menu.trigger('keydown', { key: 'ArrowUp' })
  await menu.trigger('keydown', { key: 'ArrowUp' })
  expect(document.activeElement).toBe(items().at(-1)!.element)
  await menu.trigger('keydown', { key: 'Home' })
  expect(document.activeElement).toBe(items()[0].element)

  await menu.trigger('keydown', { key: 'Escape' })
  expect(app.find('[role="menu"]').exists()).toBe(false)
  expect(document.activeElement).toBe(button.element)

  await button.trigger('keydown', { key: ' ' })
  await flushPromises()
  expect(app.find('[role="menu"]').exists()).toBe(true)
  await menu.trigger('keydown', { key: 'Escape' })
})

test('Enter on a menu item chooses it', async () => {
  await start()
  await get('notebook-menu').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  const menu = app.get('[role="menu"]')
  await menu.trigger('keydown', { key: 'ArrowDown' })

  await item('B notes').trigger('click')
  await switchedTo('B notes')
})

// ---- the download fallback

const fallback = (picked: () => File | null, saves: string[]): NotebookStorage => ({
  ...downloadStorage,
  pick: async () => {
    const file = picked()
    return file && downloadFolder(file, (_, name) => saves.push(name))
  },
  blank: () => downloadFolder(null, (_, name) => saves.push(name)),
})

async function startFallback(saves: string[], picked: () => File | null = () => null) {
  closeNotebook()
  await mountWith(fallback(picked, saves))
  createRecord('system', 'Coupa')
  markDirty()
  await flushPromises()
}

test('on the download fallback the menu opens a file, creates a new Notebook or closes', async () => {
  await startFallback([])
  await saveNow(true)
  await openMenu()

  expect(items().map((i) => i.text())).toEqual(['Open notebook.sqlite…', 'Create new Notebook', 'Close Notebook'])
})

test('on the download fallback, leaving with edits not downloaded asks first', async () => {
  const saves: string[] = []
  await startFallback(saves)

  await choose('Create new Notebook')
  expect(app.text()).toContain('Download first')
  expect(app.text()).toContain('Switch anyway')
  await get('dialog-cancel').trigger('click')
  await flushPromises()
  expect(titles()).toEqual(['Coupa'])

  await choose('Create new Notebook')
  await app.findAll('button').find((x) => x.text() === 'Download first')!.trigger('click')
  await expect.poll(() => titles()).toEqual([])
  expect(saves).toEqual(['notebook.sqlite'])
})

test('on the download fallback, Switch anyway leaves without downloading', async () => {
  const saves: string[] = []
  await startFallback(saves)

  await choose('Close Notebook')
  await app.findAll('button').find((x) => x.text() === 'Switch anyway')!.trigger('click')

  await expect.poll(() => db.value).toBeNull()
  expect(saves).toEqual([])
})
