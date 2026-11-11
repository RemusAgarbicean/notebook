import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { closeNotebook, db, markDirty, saveNow } from './notebook'
import { loadSqlite } from './sqlite'
import type { NotebookStorage } from './storage'
import { memoryFolder } from './storage-memory'

beforeEach(closeNotebook)
afterEach(() => vi.restoreAllMocks())

const onDisk = async (bytes: Uint8Array | null, sql: string) =>
  new (await loadSqlite()).Database(bytes!).exec(sql)[0].values

async function openApp() {
  const folder = memoryFolder()
  const storage: NotebookStorage = {
    pick: async () => folder,
    lastName: async () => null,
    reopen: async () => null,
  }
  const app = mount(App, { props: { storage }, attachTo: document.body })
  await flushPromises()
  await click(app, 'Create new Notebook')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
  return { app, folder }
}

const click = (app: ReturnType<typeof mount>, name: string) =>
  app
    .findAll('button')
    .find((b) => b.text() === name)!
    .trigger('click')

const addTeam = (title: string) => {
  db.value!.run('insert into team (title) values (?)', [title])
  markDirty()
}

test('a failed save shows the Not saved banner, Retry saves and Download a copy holds the edits', async () => {
  const { app, folder } = await openApp()
  const write = folder.write
  folder.write = () => Promise.reject(new Error('permission revoked'))
  addTeam('Procurement')
  await saveNow()
  await flushPromises()

  const banner = app.get('[data-testid="not-saved-banner"]')
  expect(banner.text()).toContain('Not saved')

  let downloaded: Blob | undefined
  let fileName = ''
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => ((downloaded = blob as Blob), 'blob:x'))
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    fileName = this.download
  })
  await click(app, 'Download a copy')
  expect(fileName).toBe('notebook.sqlite')
  expect(
    await onDisk(new Uint8Array(await downloaded!.arrayBuffer()), 'select title from team'),
  ).toEqual([['Procurement']])

  folder.write = write
  await click(app, 'Retry')
  await expect.poll(() => app.find('[data-testid="not-saved-banner"]').exists()).toBe(false)
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['Procurement']])
  app.unmount()
})

test('a file changed outside the app asks Reload from disk (the default) or Overwrite', async () => {
  const { app, folder } = await openApp()
  const other = new (await loadSqlite()).Database(folder.file!)
  other.run("insert into team (title) values ('From DB Browser')")
  folder.file = other.export()
  folder.modified++
  addTeam('From the app')
  await saveNow()
  await flushPromises()

  const dialog = app.get('[role="alertdialog"]')
  expect(dialog.findAll('button').map((b) => b.text())).toEqual(['Overwrite', 'Reload from disk'])
  expect(document.activeElement?.textContent?.trim()).toBe('Reload from disk')

  await click(app, 'Reload from disk')
  await expect.poll(() => app.find('[role="alertdialog"]').exists()).toBe(false)
  expect(db.value!.exec('select title from team')[0].values).toEqual([['From DB Browser']])
  app.unmount()
})

test('another tab taking over saves the edits here and shows the other-tab screen; Use it here takes it back', async () => {
  const { app, folder } = await openApp()
  const otherTab = new BroadcastChannel('notebook')
  const heard: string[] = []
  otherTab.onmessage = (e) => heard.push(e.data)
  addTeam('Procurement')

  otherTab.postMessage('take-over')
  await expect.poll(() => app.text()).toContain('Notebook is open in another tab')
  expect(await onDisk(folder.file, 'select title from team')).toEqual([['Procurement']])
  expect(app.find('[data-testid="sidebar"]').exists()).toBe(false)
  await expect.poll(() => heard).toEqual(['i-edit', 'released'])

  otherTab.onmessage = (e) => {
    if (e.data === 'take-over') otherTab.postMessage('released')
  }
  await click(app, 'Use it here')
  await expect.poll(() => app.text()).toContain('Create new Notebook')
  otherTab.close()
  app.unmount()
})
