import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { pushDate } from './due'
import { openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { createRecord, getRecord } from './records'
import { LABEL } from './relation-slots'
import { addRelation } from './relations'
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

const texts = (id: string) => app.findAll(`[data-testid="${id}"]`).map((r) => r.text())
const byLabel = (label: string) => app.get(`[aria-label="${label}"]`)
const menuItem = (text: string) => app.findAll('[role="menuitem"]').find((b) => b.text() === text)!
const due = (id: number) => getRecord('task', id)?.due

async function push(title: string, choice: string) {
  await byLabel(`Push: ${title}`).trigger('click')
  await menuItem(choice).trigger('click')
  await flushPromises()
}

test('Push on an undated Task in the Open Tasks card gives it a due date', async () => {
  const id = createRecord('task', 'Book room')
  await flushPromises()

  await push('Book room', 'Tomorrow')

  expect(due(id)).toBe(pushDate('tomorrow'))
  expect(texts('home-task')).toEqual([`Book room${pushDate('tomorrow')}`])
})

test('Next week and Pick a date on the Open Tasks card move an overdue Task from today, or to the picked date', async () => {
  const late = createRecord('task', 'Late', { due: '2020-01-31' })
  const other = createRecord('task', 'Other', { due: '2020-02-01' })
  await flushPromises()

  await push('Late', 'Next week')
  expect(due(late)).toBe(pushDate('next-week'))

  await byLabel('Push: Other').trigger('click')
  await menuItem('Pick a date').trigger('click')
  await byLabel('Push date: Other').setValue('2099-05-06')
  await flushPromises()
  expect(due(other)).toBe('2099-05-06')
  expect(app.find('[role="menu"]').exists()).toBe(false)
})

test('the done box on an Open Tasks card row marks the Task done and the row leaves the card', async () => {
  const id = createRecord('task', 'Book room')
  createRecord('task', 'Call Anna')
  await flushPromises()

  await byLabel('Done: Book room').setValue(true)
  await flushPromises()

  expect(getRecord('task', id)?.done).toBeTruthy()
  expect(texts('home-task')).toEqual(['Call Anna'])
})

test('Escape closes the Push menu without changing the due date', async () => {
  const id = createRecord('task', 'Book room')
  await flushPromises()

  await byLabel('Push: Book room').trigger('click')
  await menuItem('Tomorrow').trigger('keydown', { key: 'Escape' })

  expect(app.find('[role="menu"]').exists()).toBe(false)
  expect(due(id)).toBeNull()
})

test("Push in a Project's Tasks checklist moves an open Task and is not offered on a done one", async () => {
  const project = createRecord('project', 'ERP rollout')
  const open = createRecord('task', 'Open one')
  const done = createRecord('task', 'Done one', { done: true })
  for (const id of [open, done]) addRelation({ type: 'task', id }, LABEL.partOf, { type: 'project', id: project })
  openRecord('project', project)
  await flushPromises()

  expect(app.find('[aria-label="Push: Done one"]').exists()).toBe(false)
  await push('Open one', 'Tomorrow')

  expect(due(open)).toBe(pushDate('tomorrow'))
  expect(texts('project-task')).toEqual([`Open one${pushDate('tomorrow')}`, 'Done one'])
})
