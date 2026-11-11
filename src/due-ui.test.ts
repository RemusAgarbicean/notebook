import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { list, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { createRecord, listRecords, today } from './records'
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

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const texts = (id: string) => app.findAll(`[data-testid="${id}"]`).map((r) => r.text())

function seed() {
  const project = createRecord('project', 'ERP rollout')
  const ids = [
    createRecord('task', 'Late', { due: '2020-01-31' }),
    createRecord('task', 'Now', { due: today() }),
    createRecord('task', 'Later', { due: '2099-01-01' }),
    createRecord('task', 'Late but done', { due: '2020-01-01', done: true }),
  ]
  for (const id of ids) addRelation({ type: 'task', id }, LABEL.partOf, { type: 'project', id: project })
  return project
}

test('Home, the Task list and a Project checklist say which open Tasks are overdue or due today', async () => {
  const project = seed()
  await flushPromises()
  expect(texts('home-task')).toEqual([
    'LateERP rolloutOverdue 2020-01-31',
    'NowERP rolloutDue today',
    'LaterERP rollout2099-01-01',
  ])

  const rows = ['LateOverdue 2020-01-31', 'NowDue today', 'Later2099-01-01', 'Late but done2020-01-01']
  list.value = 'task'
  await flushPromises()
  expect(texts('list-row')).toEqual(rows)

  openRecord('project', project)
  await flushPromises()
  expect(texts('project-task')).toEqual(rows)
})

test('the quick-add box on Home creates a Task, with a due date when the line ends in one, and stays on Home', async () => {
  await get('quick-task').setValue('File expenses 31.01.2099')
  await get('quick-task').trigger('submit')
  await get('quick-task').setValue('Book room')
  await get('quick-task').trigger('submit')

  expect(listRecords('task').map((t) => [t.title, t.due])).toEqual([
    ['File expenses', '2099-01-31'],
    ['Book room', null],
  ])
  expect(texts('home-task')).toEqual(['File expenses2099-01-31', 'Book room'])
  expect((get('quick-task').element as HTMLInputElement).value).toBe('')
  expect(list.value).toBe('home')
})
