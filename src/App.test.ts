import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { db, markDirty, saveNow } from './notebook'
import { shortcut } from './platform'
import type { NotebookFolder, NotebookStorage } from './storage'
import { memoryFolder, memoryStorage } from './storage-memory'

beforeEach(() => (db.value = null))

// A storage whose picker "picks" the given folder and which remembers `last`.
const fakeStorage = (picked: NotebookFolder | null, last: NotebookFolder | null = null) =>
  memoryStorage(picked, last ? [last] : [])

const start = async (storage: NotebookStorage) => {
  const app = mount(App, { props: { storage } })
  await flushPromises()
  return app
}

const click = async (app: Awaited<ReturnType<typeof start>>, name: string) => {
  await app
    .findAll('button')
    .find((b) => b.text() === name)!
    .trigger('click')
  // Opening loads SQLite, which takes more than one round of microtasks.
  await expect.poll(() => app.text().includes('Home') || app.find('[role="alert"]').exists()).toBe(true)
}

const buttons = (app: Awaited<ReturnType<typeof start>>) => app.findAll('button').map((b) => b.text())

async function openApp() {
  const folder = memoryFolder()
  const app = await start(fakeStorage(folder))
  await click(app, 'Create new Notebook')
  return { app, folder }
}

test('the start screen offers Pick folder and Create new Notebook', async () => {
  const app = await start(fakeStorage(null))

  expect(buttons(app)).toEqual(['Pick folder', 'Create new Notebook'])
  expect(app.find('[data-testid="sidebar"]').exists()).toBe(false)
})

test('Create new Notebook writes the file and opens the app, which reads Saved', async () => {
  const { app, folder } = await openApp()

  expect(folder.file).not.toBeNull()
  expect(app.get('[data-testid="save-status"]').text()).toBe('Saved')
})

test('after a reload the start screen names the last folder and Reopen loads its data', async () => {
  const { folder } = await openApp()
  db.value!.run("insert into team (title) values ('Procurement')")
  markDirty()
  await saveNow()
  db.value = null

  const app = await start(fakeStorage(null, memoryFolder(folder.file, 'Work notes')))
  expect(app.text()).toContain('Work notes')
  expect(buttons(app)).toEqual(['Reopen', 'Remove', 'Pick folder', 'Create new Notebook'])
  await click(app, 'Reopen')

  expect(app.find('[data-testid="sidebar"]').exists()).toBe(true)
  expect(db.value!.exec('select title from team')[0].values).toEqual([['Procurement']])
})

test('"Can\'t find it" shows, with Remove from list, when notebook.sqlite is gone', async () => {
  const app = await start(fakeStorage(null, memoryFolder(null, 'Work notes')))

  await click(app, 'Reopen')

  expect(app.get('[role="alert"]').text()).toContain("Can't find it")
  await app.get('[role="alert"] button').trigger('click')
  await flushPromises()

  expect(app.find('[role="alert"]').exists()).toBe(false)
  expect(app.text()).not.toContain('Work notes')
  expect(buttons(app)).toEqual(['Pick folder', 'Create new Notebook'])
})

test('picking a folder that holds a Notebook opens it', async () => {
  const { folder } = await openApp()
  db.value = null

  const app = await start(fakeStorage(memoryFolder(folder.file)))
  await click(app, 'Pick folder')

  expect(app.find('[data-testid="sidebar"]').exists()).toBe(true)
})

test('a file that is not a Notebook shows the error instead of opening', async () => {
  const app = await start(fakeStorage(memoryFolder(new TextEncoder().encode('not sqlite at all'))))

  await click(app, 'Pick folder')

  expect(app.get('[role="alert"]').text()).not.toBe('')
  expect(app.find('[data-testid="sidebar"]').exists()).toBe(false)
})

test('the sidebar footer follows the save status', async () => {
  const { app } = await openApp()
  const status = app.get('[data-testid="save-status"]')

  markDirty()
  await flushPromises()
  expect(status.text()).toBe('Not saved')

  await saveNow()
  await flushPromises()
  expect(status.text()).toBe('Saved')
})

test('the sidebar shows search, Home, all 12 Record types with icons and Tags', async () => {
  const sidebar = (await openApp()).app.get('[data-testid="sidebar"]')

  expect(sidebar.text()).toContain('Notebook')
  expect(sidebar.get('[data-testid="search"]').text()).toContain(shortcut('K'))
  expect(sidebar.text()).toContain('Home')
  expect(sidebar.text()).toContain('Tags')

  const types = sidebar.findAll('[data-testid="record-type"]')
  expect(types.map((t) => t.text())).toEqual([
    'Systems',
    'Acronyms',
    'People',
    'Teams',
    'Processes',
    'Projects',
    'Questionnaires',
    'Diagrams',
    'Bookmarks',
    'Open questions',
    'Tasks',
    'Journal',
  ])
  for (const t of types) expect(t.find('svg').exists()).toBe(true)
})

test('the list and page columns sit next to the sidebar', async () => {
  const { app } = await openApp()
  // Home spans both columns, so a type is chosen first.
  await app.get('[data-testid="record-type"]').trigger('click')
  expect(app.find('[data-testid="list-column"]').exists()).toBe(true)
  expect(app.find('[data-testid="page-column"]').exists()).toBe(true)
})

test('Reopen says so when the browser refuses permission', async () => {
  const app = await start({ ...fakeStorage(null, memoryFolder(null, 'Work notes')), reopen: async () => null })

  await click(app, 'Reopen')

  expect(app.get('[role="alert"]').text()).toContain('permission')
  expect(buttons(app)).toEqual(['Reopen', 'Remove', 'Pick folder', 'Create new Notebook'])
})

test('cancelling the folder picker shows no message', async () => {
  const app = await start(fakeStorage(null))

  await app.findAll('button').find((b) => b.text() === 'Pick folder')!.trigger('click')
  await flushPromises()

  expect(app.find('[role="alert"]').exists()).toBe(false)
})

test('the start screen stays usable while a file chooser that never answers is open', async () => {
  const app = await start({ ...fakeStorage(null), pick: () => new Promise(() => {}) })

  await app.findAll('button').find((b) => b.text() === 'Pick folder')!.trigger('click')
  await flushPromises()

  expect(app.findAll('button').map((b) => b.attributes('disabled'))).toEqual([undefined, undefined])
})

const recentRows = (app: Awaited<ReturnType<typeof start>>) =>
  app.findAll('[data-testid="recent"]').map((r) => r.text().replace(/\s+/g, ' '))

test('the start screen lists the Recent Notebooks, the most recent first and primary, each with Reopen and Remove', async () => {
  const app = await start(memoryStorage(null, [memoryFolder(null, 'Work notes'), memoryFolder(null, 'Home notes')]))

  expect(recentRows(app)).toEqual(['Work notes Reopen Remove', 'Home notes Reopen Remove'])
  const reopens = app.findAll('[data-testid="recent"]').map((r) => r.get('button'))
  expect(reopens[0].classes()).toContain('bg-primary')
  expect(reopens[1].classes()).not.toContain('bg-primary')
  expect(reopens[1].attributes('aria-label')).toBe('Reopen Home notes')
  // With a list, picking is the second choice.
  expect(app.findAll('button').find((b) => b.text() === 'Pick folder')!.classes()).not.toContain('bg-primary')
})

test("Remove takes a Notebook off the start screen's list, and the next one becomes primary", async () => {
  const app = await start(memoryStorage(null, [memoryFolder(null, 'Work notes'), memoryFolder(null, 'Home notes')]))

  await app.get('button[aria-label="Remove Work notes from the list"]').trigger('click')
  await flushPromises()

  expect(recentRows(app)).toEqual(['Home notes Reopen Remove'])
  expect(app.get('[data-testid="recent"] button').classes()).toContain('bg-primary')
})

test('Reopen opens the Notebook of its own row', async () => {
  const { folder } = await openApp()
  db.value!.run("insert into team (title) values ('Procurement')")
  markDirty()
  await saveNow()
  db.value = null

  const app = await start(memoryStorage(null, [memoryFolder(null, 'Empty'), memoryFolder(folder.file, 'Work notes')]))
  await app.get('button[aria-label="Reopen Work notes"]').trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)

  expect(db.value!.exec('select title from team')[0].values).toEqual([['Procurement']])
})

test('a Notebook opened from the start screen is at the top of the list next time', async () => {
  const { folder } = await openApp()
  db.value = null
  const storage = memoryStorage(memoryFolder(folder.file, 'Picked'), [memoryFolder(null, 'Older')])
  let app = await start(storage)
  await click(app, 'Pick folder')
  app.unmount()
  db.value = null

  app = await start(storage)
  expect(recentRows(app)).toEqual(['Picked Reopen Remove', 'Older Reopen Remove'])
})
