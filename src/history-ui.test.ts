import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, list, openRecord } from './navigation'
import { closeNotebook, markDirty, openNotebook, saveNow } from './notebook'
import { paletteOpen } from './palette'
import { addTag, createRecord, deleteRecord, listTags, updateRecord } from './records'
import { memoryFolder } from './storage-memory'

let app: VueWrapper
let folder: ReturnType<typeof memoryFolder>

const start = (last: ReturnType<typeof memoryFolder> | null = null) => {
  app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => last?.name ?? null, reopen: async () => last } },
    attachTo: document.body,
  })
  return flushPromises()
}
const press = async (name: string) => {
  await app.findAll('button').find((b) => b.text() === name)!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
}

beforeEach(async () => {
  closeNotebook()
  folder = memoryFolder()
  await start()
  await press('Create new Notebook')
})
afterEach(() => app.unmount())

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const showType = (label: string) =>
  app.findAll('[data-testid="record-type"]').find((b) => b.text().startsWith(label))!.trigger('click')
// What Back, Forward or a typed address do: the hash changes and the browser says so.
async function visit(hash: string) {
  location.hash = hash
  window.dispatchEvent(new Event('hashchange'))
  await flushPromises()
}
const title = () => (get('record-title').element as HTMLInputElement).value

test('each place has its own hash: Home, a list, a Record, a Tag list', async () => {
  const coupa = createRecord('system', 'Coupa')
  addTag('system', coupa, 'p2p')
  const tag = listTags()[0].id
  expect(location.hash).toBe('#/')

  await showType('Systems')
  expect(location.hash).toBe('#/system')

  await get('list-row').trigger('click')
  expect(location.hash).toBe(`#/system/${coupa}`)

  await get('tag').trigger('click')
  expect(location.hash).toBe(`#/tag/${tag}`)

  await get('list-row').trigger('click')
  expect(location.hash).toBe(`#/tag/${tag}/system/${coupa}`)

  await app.findAll('button').find((b) => b.text() === 'Home')!.trigger('click')
  expect(location.hash).toBe('#/')
})

test('going back to an earlier hash shows that place again', async () => {
  const coupa = createRecord('system', 'Coupa')
  const maria = createRecord('person', 'Maria')
  openRecord('system', coupa)
  await flushPromises()
  openRecord('person', maria)
  await flushPromises()

  await visit(`#/system/${coupa}`)
  expect(title()).toBe('Coupa')
  expect(get('list-column').text()).toContain('Systems')

  await visit('#/')
  expect(app.find('[data-testid="home"]').exists()).toBe(true)
})

test('a hash that points at a deleted Record falls back to its list', async () => {
  const coupa = createRecord('system', 'Coupa')
  openRecord('system', coupa)
  await flushPromises()
  await showType('People')
  deleteRecord('system', coupa)

  await visit(`#/system/${coupa}`)

  expect(list.value).toBe('system')
  expect(current.value).toBeNull()
  expect(location.hash).toBe('#/system')
})

test('a hash that points at a deleted Tag falls back to the Record, or to Home', async () => {
  const coupa = createRecord('system', 'Coupa')

  await visit(`#/tag/99/system/${coupa}`)
  expect(title()).toBe('Coupa')
  expect(location.hash).toBe(`#/system/${coupa}`)

  await visit('#/tag/99')
  expect(app.find('[data-testid="home"]').exists()).toBe(true)
  expect(location.hash).toBe('#/')
})

test('after a reload, Reopen returns to the place in the hash', async () => {
  const coupa = createRecord('system', 'Coupa')
  openRecord('system', coupa)
  markDirty()
  await saveNow()
  const hash = location.hash
  // A reload: the page starts over with the same address.
  app.unmount()
  closeNotebook()

  await start(memoryFolder(folder.file))
  expect(location.hash).toBe(hash)
  await press('Reopen')

  expect(title()).toBe('Coupa')
  expect(location.hash).toBe(hash)
})

test('the hash change of the app\'s own navigation leaves the focus where it is', async () => {
  openRecord('system', createRecord('system', 'Coupa'))
  await flushPromises()
  const field = get('record-title').element as HTMLInputElement
  field.focus()

  window.dispatchEvent(new Event('hashchange'))

  expect(document.activeElement).toBe(field)
})

test('the tab is named after the open Record, the list, or just Notebook', async () => {
  const coupa = createRecord('system', 'Coupa')
  expect(document.title).toBe('Notebook')

  await showType('Systems')
  expect(document.title).toBe('Systems - Notebook')

  openRecord('system', coupa)
  await flushPromises()
  expect(document.title).toBe('Coupa - Notebook')

  updateRecord('system', coupa, { title: 'Coupa P2P' })
  await flushPromises()
  expect(document.title).toBe('Coupa P2P - Notebook')
})

test('opening the palette does not change the hash', async () => {
  await showType('Systems')

  paletteOpen.value = true
  await flushPromises()

  expect(location.hash).toBe('#/system')
})

test('another Notebook starts at Home, whatever was open', async () => {
  openRecord('system', createRecord('system', 'Coupa'))
  await flushPromises()

  // What Restore and reload-from-disk do: a new database takes the place of the open one.
  await openNotebook(folder)
  await flushPromises()

  expect(list.value).toBe('home')
  expect(location.hash).toBe('#/')
})
