import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { current, openRecord } from './navigation'
import { closeNotebook, db } from './notebook'
import { addTag, createRecord, getRecord, recordTags } from './records'
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
const has = (id: string) => app.find(`[data-testid="${id}"]`).exists()

async function deleteOpen(title: string) {
  const id = createRecord('system', title)
  addTag('system', id, 'finance')
  openRecord('system', id)
  await flushPromises()
  await get('delete-record').trigger('click')
  await get('dialog-confirm').trigger('submit')
  await flushPromises()
  return id
}
const ctrlZ = (target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}

test('deleting a Record shows a notice whose Undo puts the Record back and opens it', async () => {
  const id = await deleteOpen('Coupa')
  expect(getRecord('system', id)).toBeNull()
  expect(get('undo-notice').text()).toContain('Deleted Coupa.')

  await get('undo-delete').trigger('click')
  await flushPromises()

  expect(getRecord('system', id)!.title).toBe('Coupa')
  expect(recordTags('system', id).map((t) => t.name)).toEqual(['finance'])
  expect(current.value).toEqual({ type: 'system', id })
  expect(has('undo-notice')).toBe(false)
})

test('Ctrl+Z undoes the delete while the notice shows', async () => {
  const id = await deleteOpen('Coupa')

  expect(ctrlZ().defaultPrevented).toBe(true)
  await flushPromises()
  expect(getRecord('system', id)!.title).toBe('Coupa')
})

test('the notice goes away by itself, and then Ctrl+Z no longer brings the Record back', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const id = await deleteOpen('Coupa')

  vi.advanceTimersByTime(20_000)
  await flushPromises()
  expect(has('undo-notice')).toBe(false)

  expect(ctrlZ().defaultPrevented).toBe(false)
  await flushPromises()
  expect(getRecord('system', id)).toBeNull()
})

test('the notice stays while the pointer or the focus is on it', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await deleteOpen('Coupa')

  await get('undo-notice').trigger('pointerenter')
  vi.advanceTimersByTime(60_000)
  await flushPromises()
  expect(has('undo-notice')).toBe(true)

  await get('undo-notice').trigger('pointerleave')
  ;(get('undo-delete').element as HTMLButtonElement).focus()
  vi.advanceTimersByTime(60_000)
  await flushPromises()
  expect(has('undo-notice')).toBe(true)

  ;(get('undo-delete').element as HTMLButtonElement).blur()
  await flushPromises()
  vi.advanceTimersByTime(20_000)
  await flushPromises()
  expect(has('undo-notice')).toBe(false)
})

test('Ctrl+Z while typing is left to the field', async () => {
  const id = await deleteOpen('Coupa')
  openRecord('system', createRecord('system', 'SAP'))
  await flushPromises()

  expect(ctrlZ(get('record-title').element).defaultPrevented).toBe(false)
  await flushPromises()
  expect(getRecord('system', id)).toBeNull()
})

test('Ctrl+Z with nothing deleted does nothing', async () => {
  expect(ctrlZ().defaultPrevented).toBe(false)
})

test('Ctrl+Z anywhere in a Diagram, its toolbar included, is the Diagram\'s undo and brings no deleted Record back', async () => {
  const id = await deleteOpen('Coupa')
  openRecord('diagram', createRecord('diagram', 'Overview'))
  await expect.poll(() => app.find('[data-testid="diagram-canvas"]').attributes('data-ready')).toBe('true')

  ctrlZ(app.get('button[aria-label="Tidy left to right"]').element)
  ctrlZ(app.get('.vue-flow').element)
  await flushPromises()

  expect(getRecord('system', id)).toBeNull()
  expect(current.value?.type).toBe('diagram')
})

test('an Undo that fails says why and leaves the user on the page they were on', async () => {
  await deleteOpen('Coupa')
  const sap = createRecord('system', 'SAP')
  openRecord('system', sap)
  await flushPromises()
  db.value!.run("create trigger refuse before insert on system begin select raise(abort, 'the disk said no'); end")

  await get('undo-delete').trigger('click')
  await flushPromises()

  expect(get('undo-notice').text()).toContain("Can't undo: the disk said no")
  expect(current.value).toEqual({ type: 'system', id: sap })
  expect((get('record-title').element as HTMLInputElement).value).toBe('SAP')
})
