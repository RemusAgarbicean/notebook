import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, list, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { createRecord } from './records'
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

test('a Record pinned on its page comes first in its list, with a marker, and shows on Home', async () => {
  createRecord('system', 'Ariba')
  createRecord('system', 'Coupa')
  openRecord('system', createRecord('system', 'SAP'))
  await flushPromises()
  expect(get('pin-record').attributes('aria-pressed')).toBe('false')

  await get('pin-record').trigger('click')

  expect(get('pin-record').attributes('aria-pressed')).toBe('true')
  expect(all('list-row').map((r) => r.text())).toEqual(['SAP', 'Ariba', 'Coupa'])
  expect(all('list-row')[0].find('[data-testid="pinned"]').exists()).toBe(true)
  expect(all('pinned')).toHaveLength(1)

  list.value = 'home'
  current.value = null
  await flushPromises()
  expect(all('home-pinned').map((r) => r.text())).toEqual(['SAPSystem'])

  await all('home-pinned')[0].trigger('click')
  await get('pin-record').trigger('click')
  list.value = 'home'
  await flushPromises()
  expect(app.text()).not.toContain('Pinned')
})
