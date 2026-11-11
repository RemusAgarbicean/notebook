import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { closeNotebook } from './notebook'
import { createRecord, listRecords } from './records'
import { memoryFolder } from './storage-memory'

let app: VueWrapper

beforeEach(async () => {
  closeNotebook()
  const folder = memoryFolder()
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
const MEETING = '## Agenda\n\n## Notes\n\n## Decisions\n\n## Actions\n\n- [ ] '
async function addNew(label: string) {
  await app.findAll('[data-testid="record-type"]').find((b) => b.text().startsWith(label))!.trigger('click')
  await get('new-record').trigger('click')
  await flushPromises()
}
const area = () => get('notes').get('textarea')

test('a new Process starts with a numbered list stub, ready to type', async () => {
  await addNew('Processes')

  expect(listRecords('process')[0].notes).toBe('1. ')
  expect((area().element as HTMLTextAreaElement).value).toBe('1. ')
})

test('a new Person starts with empty notes', async () => {
  await addNew('People')

  expect(listRecords('person')[0].notes).toBe('')
})

test('a Record made anywhere but with New starts blank', () => {
  expect(listRecords('process')).toEqual([])
  createRecord('process', 'Buying')
  createRecord('journal_entry', 'Kick-off', { kind: 'meeting' })

  expect(listRecords('process')[0].notes).toBe('')
  expect(listRecords('journal_entry')[0].notes).toBe('')
})

test('a new Journal entry takes the meeting template once its kind becomes meeting', async () => {
  await addNew('Journal')
  expect(listRecords('journal_entry')[0].notes).toBe('')

  await get('field-kind').setValue('meeting')

  expect(listRecords('journal_entry')[0].notes).toBe(MEETING)
  expect((area().element as HTMLTextAreaElement).value).toBe(MEETING)

  // Back to a log while the template is untouched: the skeleton goes again.
  await get('field-kind').setValue('log')
  expect(listRecords('journal_entry')[0].notes).toBe('')
})

test('notes the user wrote are never replaced by a template', async () => {
  await addNew('Journal')
  await area().setValue('Got sandbox access.')

  await get('field-kind').setValue('meeting')

  expect(listRecords('journal_entry')[0]).toMatchObject({ kind: 'meeting', notes: 'Got sandbox access.' })
})

test('a template edited in the Templates dialog is what the next new Record starts with', async () => {
  await get('open-templates').trigger('click')
  await get('template-key').setValue('person')
  expect((get('template-text').element as HTMLTextAreaElement).value).toBe('')
  await get('template-text').setValue('## Works on\n\n## Good to know')
  await get('close-templates').trigger('click')

  await addNew('People')

  expect(listRecords('person')[0].notes).toBe('## Works on\n\n## Good to know')
})

test('a template can be emptied, and reset to the original', async () => {
  await get('open-templates').trigger('click')
  await get('template-key').setValue('process')
  expect((get('template-text').element as HTMLTextAreaElement).value).toBe('1. ')
  expect(get('reset-template').attributes('disabled')).toBeDefined()

  await get('template-text').setValue('')
  await addNew('Processes')
  expect(listRecords('process')[0].notes).toBe('')

  await get('reset-template').trigger('click')
  expect((get('template-text').element as HTMLTextAreaElement).value).toBe('1. ')
  await get('new-record').trigger('click')
  expect(listRecords('process').map((p) => p.notes).sort()).toEqual(['', '1. '])
})
