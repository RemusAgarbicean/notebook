import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { list } from './navigation'
import { closeNotebook, saveNow, takeBackup } from './notebook'
import { createRecord, listRecords } from './records'
import type { NotebookFolder } from './storage'
import { downloadFolder } from './storage-download'
import { memoryFolder } from './storage-memory'

let app: VueWrapper
let folder: ReturnType<typeof memoryFolder>

async function start(picked: NotebookFolder) {
  app = mount(App, {
    props: { storage: { pick: async () => picked, lastName: async () => null, reopen: async () => null } },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
}

beforeEach(() => {
  closeNotebook()
  folder = memoryFolder()
})
afterEach(() => app.unmount())

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const rowTexts = () => app.findAll('[data-testid="backup-row"]').map((r) => r.text())
const titles = () => listRecords('team').map((t) => t.title)
async function openDialog() {
  await get('open-backups').trigger('click')
  await flushPromises()
}

// Procurement is in the Backup; Analytics came after it.
async function backedUp() {
  await start(folder)
  createRecord('team', 'Procurement')
  await takeBackup('import')
  createRecord('team', 'Analytics')
  await saveNow()
}

test('the Backups screen lists each Backup with its date, time, kind and size', async () => {
  await start(folder)
  folder.backups.set('notebook-2026-11-10.sqlite', new Uint8Array(40960))
  folder.backups.set('notebook-2026-11-11-093005-import.sqlite', new Uint8Array(2048))

  await openDialog()

  expect(rowTexts()).toEqual(['2026-11-1109:30:05Before import2 KB Restore', '2026-11-10Daily40 KB Restore'])
})

test('Restore asks first; Cancel changes nothing', async () => {
  await backedUp()
  await openDialog()

  await get('restore-backup').trigger('click')
  expect(get('confirm-restore').text()).toContain('Before import')
  await app.findAll('[data-testid="confirm-restore"] button').find((b) => b.text() === 'Cancel')!.trigger('click')

  expect(app.find('[data-testid="confirm-restore"]').exists()).toBe(false)
  expect(titles()).toEqual(['Analytics', 'Procurement'])
})

test('confirming Restore brings the Backup back, closes the screen and shows Home', async () => {
  await backedUp()
  list.value = 'team'
  await openDialog()

  await get('restore-backup').trigger('click')
  await get('confirm-restore-yes').trigger('click')
  await expect.poll(() => app.find('[data-testid="backups-dialog"]').exists()).toBe(false)

  expect(titles()).toEqual(['Procurement'])
  expect(list.value).toBe('home')
  expect([...folder.backups.keys()].some((n) => n.endsWith('-restore.sqlite'))).toBe(true)
})

test('a Restore that fails says why and keeps the screen open', async () => {
  await backedUp()
  await openDialog()
  folder.writeBackup = () => Promise.reject(new Error('disk full'))

  await get('restore-backup').trigger('click')
  await get('confirm-restore-yes').trigger('click')
  await expect.poll(() => app.find('[data-testid="backups-dialog"] [role="alert"]').exists()).toBe(true)

  expect(get('backups-dialog').get('[role="alert"]').text()).toContain('disk full')
  expect(titles()).toEqual(['Analytics', 'Procurement'])
})

test('Back up now adds a Manual Backup to the list', async () => {
  await start(folder)
  await openDialog()
  expect(rowTexts()).toEqual([])
  expect(get('backups-dialog').text()).toContain('No Backups yet')

  await get('backup-now').trigger('click')
  await expect.poll(rowTexts).toHaveLength(1)

  expect(rowTexts()[0]).toContain('Manual')
})

test('a Notebook saved by download explains that it has no Backups folder', async () => {
  await start(downloadFolder(null, () => {}))
  await openDialog()

  expect(get('backups-dialog').text()).toContain('no backups folder')
  expect(app.find('[data-testid="backup-now"]').exists()).toBe(false)
  expect(app.find('[data-testid="backup-row"]').exists()).toBe(false)
})
