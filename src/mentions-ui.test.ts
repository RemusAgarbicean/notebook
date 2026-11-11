import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, openRecord } from './navigation'
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
afterEach(() => app.unmount())

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const options = () => app.findAll('[data-testid="mention-option"]').map((o) => o.text())
// What the browser does when the user types: the text grows and the caret sits at its end.
const type = (text: string) => get('notes').get('textarea').setValue(text)

test('clicking a rendered Mention opens its Record', async () => {
  const coupa = createRecord('system', 'Coupa')
  openRecord('process', createRecord('process', 'Buying', { notes: 'Use [[coupa]] or [[Ariba]]' }))
  await flushPromises()

  expect(get('notes').find('.mention-broken').text()).toBe('Ariba')
  await get('notes').get('[data-mention]').trigger('click')

  expect(current.value).toEqual({ type: 'system', id: coupa })
  expect((get('record-title').element as HTMLInputElement).value).toBe('Coupa')
})

test('typing [[ suggests Records and picking one inserts the Mention', async () => {
  createRecord('system', 'Coupa')
  createRecord('person', 'Maria')
  const id = createRecord('process', 'Buying')
  openRecord('process', id)
  await flushPromises()

  await type('Ask [[mar')
  expect(options()).toEqual(['MariaPerson'])

  await get('notes').get('textarea').trigger('keydown', { key: 'Enter' })

  expect(getRecord('process', id)!.notes).toBe('Ask [[Maria]]')
  expect(options()).toEqual([])
})

test('picking a Record with an ambiguous title inserts its type too', async () => {
  createRecord('system', 'Coupa')
  createRecord('team', 'Coupa')
  const id = createRecord('process', 'Buying')
  openRecord('process', id)
  await flushPromises()

  await type('[[coup')
  expect(options()).toEqual(['CoupaSystem', 'CoupaTeam'])
  await get('notes').get('textarea').trigger('keydown', { key: 'ArrowDown' })
  await get('notes').get('textarea').trigger('keydown', { key: 'Enter' })

  expect(getRecord('process', id)!.notes).toBe('[[Team: Coupa]]')
})

test('the suggestions close once the Mention is closed or Escape is pressed', async () => {
  createRecord('system', 'Coupa')
  openRecord('process', createRecord('process', 'Buying'))
  await flushPromises()

  await type('[[Coupa]] and')
  expect(options()).toEqual([])

  await type('[[')
  expect(options()).toHaveLength(2)
  await get('notes').get('textarea').trigger('keydown', { key: 'Escape' })
  expect(options()).toEqual([])
})

test('renaming a Record on its page updates the Mentions of it, and Mentioned in links back', async () => {
  const coupa = createRecord('system', 'Coupa')
  const buying = createRecord('process', 'Buying', { notes: 'Use [[Coupa]]' })
  openRecord('system', coupa)
  await flushPromises()

  ;(get('record-title').element as HTMLInputElement).value = 'Coupa P2P'
  await get('record-title').trigger('change')
  expect(getRecord('process', buying)!.notes).toBe('Use [[Coupa P2P]]')

  expect(app.findAll('[data-testid="mentioned-in"]').map((m) => m.text())).toEqual(['Buying'])
  await get('mentioned-in').trigger('click')
  expect(current.value).toEqual({ type: 'process', id: buying })
})
