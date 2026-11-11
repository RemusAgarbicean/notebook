import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { current, openRecord } from './navigation'
import { closeNotebook, db } from './notebook'
import { createRecord, getRecord, listRecords, type RecordRef } from './records'
import { LABEL } from './relation-slots'
import { addRelation, hasRelation } from './relations'
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
const all = (id: string) => app.findAll(`[data-testid="${id}"]`)
const make = (type: RecordRef['type'], title: string, fields = {}): RecordRef => ({
  type,
  id: createRecord(type, title, fields),
})
const open = async (r: RecordRef) => {
  openRecord(r.type, r.id)
  await flushPromises()
}
const tasks = () => all('project-task').map((t) => t.text())
const addTask = async (title: string) => {
  await get('new-project-task').setValue(title)
  await get('project-tasks').get('form').trigger('submit')
}

test('adding a Task from the Project page creates it as part of the Project', async () => {
  const rollout = make('project', 'Coupa rollout')
  await open(rollout)

  await addTask('Book kickoff')

  const [task] = listRecords('task')
  expect(task.title).toBe('Book kickoff')
  expect(hasRelation({ type: 'task', id: task.id as number }, LABEL.partOf, rollout)).toBe(true)
  expect(tasks()).toEqual(['Book kickoff'])
  expect((get('new-project-task').element as HTMLInputElement).value).toBe('')
  // The Task is the checklist's, not the Relations section's.
  expect(all('relation')).toEqual([])

  // A blank box creates nothing.
  await addTask('   ')
  expect(listRecords('task')).toHaveLength(1)
})

test('ticking a Task sets its done_at and moves it below the open ones', async () => {
  const rollout = make('project', 'Coupa rollout')
  const first = make('task', 'Alpha')
  const second = make('task', 'Beta')
  addRelation(first, LABEL.partOf, rollout)
  addRelation(second, LABEL.partOf, rollout)
  await open(rollout)
  expect(tasks()).toEqual(['Alpha', 'Beta'])

  await all('project-task')[0].get('input[type="checkbox"]').setValue(true)

  expect(getRecord('task', first.id)!.done_at).toBeTruthy()
  expect(tasks()).toEqual(['Beta', 'Alpha'])

  await all('project-task')[1].get('input[type="checkbox"]').setValue(false)
  expect(getRecord('task', first.id)!.done_at).toBeNull()
  expect(tasks()).toEqual(['Alpha', 'Beta'])
})

test('the checklist shows due dates, only on a Project page, and leaves other Relations alone', async () => {
  const rollout = make('project', 'Coupa rollout')
  const other = make('project', 'Other project')
  const dated = make('task', 'Sign contract', { due: '2099-12-01' })
  addRelation(dated, LABEL.partOf, rollout)
  addRelation(make('task', 'Elsewhere'), LABEL.partOf, other)
  addRelation(make('system', 'Coupa'), LABEL.partOf, rollout)

  await open(rollout)
  expect(tasks()).toEqual(['Sign contract2099-12-01'])
  expect(all('relation').map((r) => r.text())).toEqual(['Coupa'])

  await all('project-task')[0].get('button').trigger('click')
  expect(current.value).toEqual(dated)
  // A Task's own page has no checklist.
  expect(app.find('[data-testid="project-tasks"]').exists()).toBe(false)
})

test('a Task that cannot be made part of the Project is not created', async () => {
  const rollout = make('project', 'Coupa rollout')
  await open(rollout)
  db.value!.run('delete from label where id = ?', [LABEL.partOf])
  const failed = vi.fn()
  app.vm.$.appContext.config.errorHandler = failed

  await addTask('Book kickoff')

  expect(failed).toHaveBeenCalled()
  expect(listRecords('task')).toEqual([])
})
