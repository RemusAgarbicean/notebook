import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { list } from './navigation'
import { closeNotebook } from './notebook'
import type { RecordType } from './record-types'
import { createRecord, listRecords } from './records'
import { slotsOf } from './relation-slots'
import { slotRecords } from './relations'
import { memoryFolder } from './storage-memory'

let app: VueWrapper
let folder: ReturnType<typeof memoryFolder>

beforeEach(async () => {
  closeNotebook()
  folder = memoryFolder()
  app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => null, reopen: async () => null } },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
})
afterEach(() => app.unmount())

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const all = (id: string) => app.findAll(`[data-testid="${id}"]`)
const paste = async (type: RecordType, text: string) => {
  list.value = type
  await flushPromises()
  await get('import-open').trigger('click')
  await get('import-text').setValue(text)
}
const save = async () => {
  await get('import-save').trigger('click')
  await expect.poll(() => app.find('[data-testid="import-dialog"]').exists()).toBe(false)
}
test('Export downloads the whole type as a .csv file named after the list and the day', async () => {
  createRecord('system', 'Coupa', { summary: 'Procure-to-pay' })
  createRecord('system', 'SAP')
  list.value = 'system'
  await flushPromises()
  const saved: { name: string; blob: Blob }[] = []
  const createObjectURL = URL.createObjectURL
  URL.createObjectURL = (blob: Blob) => (saved.push({ name: '', blob }), 'blob:x')
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    saved.at(-1)!.name = this.download
  }
  try {
    await get('list-filter').setValue('sap')
    await get('export-csv').trigger('click')
  } finally {
    URL.createObjectURL = createObjectURL
    HTMLAnchorElement.prototype.click = click
  }

  expect(saved).toHaveLength(1)
  expect(saved[0].name).toMatch(/^systems-\d{4}-\d{2}-\d{2}\.csv$/)
  const bytes = new Uint8Array(await saved[0].blob.arrayBuffer())
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(new TextDecoder().decode(bytes)).toBe('Title,Summary,URL,Owner,Tags,Notes\r\nCoupa,Procure-to-pay,,,,\r\nSAP,,,,,\r\n')
})

test('there is no Export for Diagrams or for an empty list', async () => {
  createRecord('diagram', 'Map')
  list.value = 'diagram'
  await flushPromises()
  expect(app.find('[data-testid="export-csv"]').exists()).toBe(false)
  list.value = 'team'
  await flushPromises()
  expect(app.find('[data-testid="export-csv"]').exists()).toBe(false)
})

const cells = () => all('import-row').map((r) => r.findAll('td').map((c) => c.text()))

const PEOPLE = 'Name\tRole\tTeam\nAna\tDev\tPayments\nBogdan\tLead\tPayments, Platform'

test('every list has an Import button except Diagrams', async () => {
  list.value = 'acronym'
  await flushPromises()
  expect(app.find('[data-testid="import-open"]').exists()).toBe(true)
  list.value = 'diagram'
  await flushPromises()
  expect(app.find('[data-testid="import-open"]').exists()).toBe(false)
})

test('pasting a table from Excel imports People with their Teams after taking a Backup', async () => {
  await paste('person', PEOPLE)
  expect(all('import-column').map((c) => (c.element as HTMLSelectElement).value)).toEqual(['title', 'role', 'slot:Team'])
  expect(cells()).toEqual([
    ['New', 'Ana', 'Dev', 'Payments'],
    ['New', 'Bogdan', 'Lead', 'Payments, Platform'],
  ])
  await save()

  expect(all('list-row').map((r) => r.text())).toEqual(['AnaDev', 'BogdanLead'])
  expect(listRecords('team').map((t) => t.title)).toEqual(['Payments', 'Platform'])
  const bogdan = listRecords('person')[1].id
  expect(slotRecords(slotsOf('person')[0], bogdan).map((t) => t.title)).toEqual(['Payments', 'Platform'])
  expect([...folder.backups.keys()]).toEqual([expect.stringMatching(/^notebook-.*-import\.sqlite$/)])
})

test('a column can be pointed at another field or ignored', async () => {
  await paste('person', 'Name,Known for,Role\nAna,SAP,Dev')
  const columns = all('import-column')
  expect((columns[1].element as HTMLSelectElement).value).toBe('')
  await columns[1].setValue('go_to_for')
  await columns[2].setValue('')
  expect(cells()).toEqual([['New', 'Ana', 'SAP']])
  await save()
  expect(listRecords('person')[0]).toMatchObject({ title: 'Ana', go_to_for: 'SAP', role: null })
})

test('rows that cannot be read are marked and skipped', async () => {
  await paste('acronym', 'Abbreviation,Expansion\nPO,Purchase order\nGR,')
  const bad = all('import-row')[1]
  expect(bad.text()).toContain('Expansion is required')
  expect(bad.classes()).toContain('text-destructive')
  expect(get('import-save').text()).toBe('Import 1 Record')
  await save()
  expect(listRecords('acronym').map((a) => a.title)).toEqual(['PO'])
})

test('duplicates are skipped unless Fill empty fields is chosen', async () => {
  createRecord('person', 'Ana')
  await paste('person', PEOPLE)
  expect(all('import-row')[0].text()).toContain('Duplicate')
  expect(get('import-save').text()).toBe('Import 1 Record')
  await get('import-fill').setValue(true)
  expect(get('import-save').text()).toBe('Import 2 Records')
  await save()
  expect(listRecords('person').map((p) => [p.title, p.role])).toEqual([
    ['Ana', 'Dev'],
    ['Bogdan', 'Lead'],
  ])
})

test('a picked .csv file goes through the same importer', async () => {
  list.value = 'acronym'
  await flushPromises()
  await get('import-open').trigger('click')
  const input = get('import-file')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['Abbreviation,Expansion\nPO,"Purchase order, signed"'], 'acronyms.csv')],
  })
  await input.trigger('change')
  await expect.poll(() => all('import-row').length).toBe(1)
  await save()
  expect(listRecords('acronym')[0]).toMatchObject({ title: 'PO', expansion: 'Purchase order, signed' })
})

test('nothing is imported when the Backup cannot be taken', async () => {
  folder.writeBackup = async () => {
    throw new Error('disk full')
  }
  await paste('person', PEOPLE)
  await get('import-save').trigger('click')
  await expect.poll(() => app.find('[data-testid="import-dialog"] [role="alert"]').exists()).toBe(true)
  expect(get('import-dialog').get('[role="alert"]').text()).toContain('disk full')
  expect(listRecords('person')).toEqual([])
})
