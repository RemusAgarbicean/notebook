import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { current, list, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { createRecord, getRecord, listRecords, today, updateRecord } from './records'
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
afterEach(() => {
  app.unmount()
  vi.useRealTimers()
})

const get = (id: string) => app.get(`[data-testid="${id}"]`)

async function goHome() {
  list.value = 'home'
  current.value = null
  await flushPromises()
}

test('the Today strip sits on Home between the search box and the cards, and holds the log button', async () => {
  const home = get('home').element
  const strip = get('today-strip').element
  expect(home.querySelector('[data-testid="home-search"]')!.compareDocumentPosition(strip)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  )
  expect(strip.compareDocumentPosition(home.querySelector('section[aria-labelledby^="home-card-"]')!)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  )
  expect(strip.contains(get('todays-log').element)).toBe(true)
  expect(app.findAll('[data-testid="todays-log"]')).toHaveLength(1)
})

test("the Journal column starts today's log when there is none and opens the same one after", async () => {
  expect(get('todays-log').text()).toBe("Start today's log")

  await get('todays-log').trigger('click')
  await flushPromises()
  const [entry] = listRecords('journal_entry')
  expect(entry).toMatchObject({ kind: 'log', date: today() })
  expect(current.value).toEqual({ type: 'journal_entry', id: entry.id })

  await goHome()
  expect(get('todays-log').text()).toBe("Open today's log")
  await get('todays-log').trigger('click')
  expect(listRecords('journal_entry')).toHaveLength(1)
  expect(current.value).toEqual({ type: 'journal_entry', id: entry.id })
})

test('New meeting starts a new meeting Journal entry dated today on every click and opens it', async () => {
  await get('today-new-meeting').trigger('click')
  await flushPromises()
  const [first] = listRecords('journal_entry')
  expect(first).toMatchObject({ kind: 'meeting', date: today(), title: `${today()} meeting` })
  expect(current.value).toEqual({ type: 'journal_entry', id: first.id })

  await goHome()
  await get('today-new-meeting').trigger('click')
  await flushPromises()
  const entries = listRecords('journal_entry')
  expect(entries.map((e) => [e.kind, e.date])).toEqual([
    ['meeting', today()],
    ['meeting', today()],
  ])
  const second = entries.find((e) => e.id !== first.id)!
  expect(current.value).toEqual({ type: 'journal_entry', id: second.id })
})

// Each question is created on its own day of November 2026; "today" is the 21st.
function seedQuestions() {
  vi.useFakeTimers({ toFake: ['Date'] })
  const on = (day: number) => vi.setSystemTime(new Date(2026, 10, day, 9, 0))
  const alice = createRecord('person', 'alice')
  const bob = createRecord('person', 'Bob')
  createRecord('person', 'Carol')
  const ask = (person: number, question: number) =>
    addRelation({ type: 'person', id: person }, LABEL.askAbout, { type: 'open_question', id: question })

  on(18)
  const costCentre = createRecord('open_question', 'Which cost centre?')
  ask(alice, costCentre)
  on(11)
  const approves = createRecord('open_question', 'Who approves POs?')
  ask(alice, approves)
  ask(bob, approves)
  on(1)
  const answered = createRecord('open_question', 'Already answered')
  ask(bob, answered)
  updateRecord('open_question', answered, { status: 'answered' })
  on(20)
  createRecord('open_question', 'Where do I find the spend cube?')
  on(21)
  createRecord('open_question', 'Is there a style guide?')
  return { alice, bob, costCentre, approves }
}

const askGroups = () =>
  app.findAll('[data-testid="today-ask-group"]').map((g) => [
    g.get('h4').text(),
    g.findAll('[data-testid="today-ask"]').map((q) => q.text()),
  ])

test('the Ask column groups open questions by the Person to ask, longest waiting first, with no one to ask last', async () => {
  seedQuestions()
  await flushPromises()

  expect(askGroups()).toEqual([
    ['alice', ['Who approves POs?10 days', 'Which cost centre?3 days']],
    ['Bob', ['Who approves POs?10 days']],
    ['No one to ask', ['Where do I find the spend cube?1 day', 'Is there a style guide?today']],
  ])
  expect(app.findAll('[data-testid="today-ask-waited"]').map((w) => w.text())).toEqual([
    '10 days',
    '3 days',
    '10 days',
    '1 day',
    'today',
  ])
})

test('clicking a question in the Ask column opens it, and clicking a group heading opens the Person', async () => {
  const { bob, costCentre } = seedQuestions()
  await flushPromises()

  await app.findAll('[data-testid="today-ask"]').find((q) => q.text().startsWith('Which cost centre?'))!.trigger('click')
  expect(current.value).toEqual({ type: 'open_question', id: costCentre })

  await goHome()
  await app.findAll('[data-testid="today-ask-group"]')[1].get('h4 button').trigger('click')
  expect(current.value).toEqual({ type: 'person', id: bob })
})

test('an empty Ask column says nothing is waiting for an answer', async () => {
  const id = createRecord('open_question', 'Answered already')
  updateRecord('open_question', id, { status: 'answered' })
  await flushPromises()

  expect(app.findAll('[data-testid="today-ask-group"]')).toHaveLength(0)
  expect(get('today-ask-empty').text()).toBe('Nothing waiting for an answer.')
})

const dueNow = () => app.findAll('[data-testid="today-due"]').map((r) => r.text())

test('Due now lists open overdue Tasks oldest first, then those due today, with their Project in grey', async () => {
  const project = createRecord('project', 'ERP rollout')
  const now = createRecord('task', 'Now', { due: today() })
  createRecord('task', 'Late', { due: '2020-01-31' })
  createRecord('task', 'Later still', { due: '2020-02-03' })
  createRecord('task', 'Also now', { due: today() })
  createRecord('task', 'Later', { due: '2099-01-01' })
  createRecord('task', 'Undated')
  createRecord('task', 'Late but done', { due: '2020-01-01', done: true })
  addRelation({ type: 'task', id: now }, LABEL.partOf, { type: 'project', id: project })
  await flushPromises()

  expect(dueNow()).toEqual([
    'LateOverdue 2020-01-31',
    'Later stillOverdue 2020-02-03',
    'Also nowDue today',
    'NowERP rolloutDue today',
  ])
})

test('an empty Due now says nothing is due today', async () => {
  createRecord('task', 'Later', { due: '2099-01-01' })
  await flushPromises()

  expect(app.findAll('[data-testid="today-due"]')).toHaveLength(0)
  expect(get('today-due-empty').text()).toBe('Nothing due today.')
})

const inStrip = (label: string) => get('today-strip').get(`[aria-label="${label}"]`)
const homeTasks = () => app.findAll('[data-testid="home-task"]').map((r) => r.text())

test('ticking a done box in Due now marks the Task done, and it leaves Due now and the Open Tasks card', async () => {
  const id = createRecord('task', 'Book room', { due: today() })
  createRecord('task', 'Call Anna', { due: today() })
  await flushPromises()

  await inStrip('Done: Book room').setValue(true)
  await flushPromises()

  expect(getRecord('task', id)?.done).toBeTruthy()
  expect(dueNow()).toEqual(['Call AnnaDue today'])
  expect(homeTasks()).toEqual(['Call AnnaDue today'])
})

test("clicking a Due now row's title opens the Task", async () => {
  const id = createRecord('task', 'Book room', { due: today() })
  await flushPromises()

  await get('today-due').findAll('button').find((b) => b.text().startsWith('Book room'))!.trigger('click')
  expect(current.value).toEqual({ type: 'task', id })
})

async function push(title: string, choice: string) {
  await inStrip(`Push: ${title}`).trigger('click')
  await app.findAll('[role="menuitem"]').find((b) => b.text() === choice)!.trigger('click')
  await flushPromises()
}

test('Push Tomorrow and Next week move a Task in Due now from today, and it leaves Due now', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 21, 9, 0))
  const late = createRecord('task', 'Late', { due: '2020-01-31' })
  const now = createRecord('task', 'Now', { due: '2026-11-21' })
  createRecord('task', 'Stay', { due: '2026-11-21' })
  await flushPromises()
  expect(app.findAll('[data-testid="today-push"]')).toHaveLength(3)

  await push('Late', 'Tomorrow')
  expect(getRecord('task', late)?.due).toBe('2026-11-22')
  await push('Now', 'Next week')
  expect(getRecord('task', now)?.due).toBe('2026-11-28')

  expect(dueNow()).toEqual(['StayDue today'])
  expect(homeTasks()).toEqual(['StayDue today', 'Late2026-11-22', 'Now2026-11-28'])
})

test('Push Pick a date in Due now saves the picked date', async () => {
  const id = createRecord('task', 'Late', { due: '2020-01-31' })
  await flushPromises()

  await inStrip('Push: Late').trigger('click')
  await app.findAll('[role="menuitem"]').find((b) => b.text() === 'Pick a date')!.trigger('click')
  await inStrip('Push date: Late').setValue('2099-05-06')
  await flushPromises()

  expect(getRecord('task', id)?.due).toBe('2099-05-06')
  expect(app.findAll('[data-testid="today-due"]')).toHaveLength(0)
})

test('a Task changed elsewhere shows in Due now on the way back to Home', async () => {
  const id = createRecord('task', 'Book room', { due: '2099-01-01' })
  openRecord('task', id)
  await flushPromises()
  updateRecord('task', id, { due: today() })

  await goHome()
  expect(dueNow()).toEqual(['Book roomDue today'])
})
