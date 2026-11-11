import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { createRecord, getRecord } from './records'
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
afterEach(() => {
  app.unmount()
  vi.restoreAllMocks()
})

const boxes = () => app.findAll('[data-testid="notes"] input[type="checkbox"]')

test('ticking a task in the rendered notes saves its line and stays out of edit mode', async () => {
  const notes = '```\n- [ ] sample\n```\n\n- [ ] Book the workshop\n- [x] Request access'
  const id = createRecord('journal_entry', 'Kick-off', { notes })
  openRecord('journal_entry', id)
  await flushPromises()

  await boxes()[0].setValue(true)

  expect(getRecord('journal_entry', id)!.notes).toBe('```\n- [ ] sample\n```\n\n- [x] Book the workshop\n- [x] Request access')
  expect(app.find('[data-testid="notes"] textarea').exists()).toBe(false)
  expect(boxes().map((b) => (b.element as HTMLInputElement).checked)).toEqual([true, true])
  // The keyboard can go on from the box it just ticked.
  expect(document.activeElement).toBe(boxes()[0].element)

  await boxes()[1].setValue(false)
  expect(getRecord('journal_entry', id)!.notes).toContain('- [ ] Request access')
})

test("ticking a task in an Open question's answer saves the answer", async () => {
  const id = createRecord('open_question', 'Who approves?', { answer: '- [ ] ask Ana' })
  openRecord('open_question', id)
  await flushPromises()

  await app.get('[data-testid="field-answer"] input[type="checkbox"]').setValue(true)

  expect(getRecord('open_question', id)!.answer).toBe('- [x] ask Ana')
})

test('the Copy button of a code block puts its code on the clipboard', async () => {
  const written: string[] = []
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (t) => void written.push(t))
  openRecord('system', createRecord('system', 'SAP', { notes: 'Find orders:\n\n```sql\nselect ebeln\nfrom ekko\n```' }))
  await flushPromises()

  await app.get('[data-testid="notes"] [data-copy]').trigger('click')
  await flushPromises()

  expect(written).toEqual(['select ebeln\nfrom ekko'])
  expect(app.get('[data-testid="notes"] [data-copy]').text()).toBe('Copied')
})

test('when the clipboard refuses, the code is selected and the button says which key copies it', async () => {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'))
  openRecord('system', createRecord('system', 'SAP', { notes: 'Query:\n\n```\nselect 1\n```' }))
  await flushPromises()

  await app.get('[data-testid="notes"] [data-copy]').trigger('click')
  await flushPromises()

  expect(app.get('[data-testid="notes"] [data-copy]').text()).toBe('Press Ctrl C')
  expect(getSelection()!.toString()).toContain('select 1')
})
