import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { openRecord } from './navigation'
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
  openRecord('acronym', createRecord('acronym', 'S2P', { expansion: 'Source to Pay', notes: 'The whole chain.' }))
  await flushPromises()
})
afterEach(() => {
  app.unmount()
  vi.restoreAllMocks()
})

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const TEXT = '# S2P\n\n- **Type:** Acronym\n- **Expansion:** Source to Pay\n\nThe whole chain.\n'

test('Copy as Markdown puts the open Record on the clipboard and says so', async () => {
  const written: string[] = []
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (t) => void written.push(t))

  await get('copy-markdown').trigger('click')
  await flushPromises()

  expect(written).toEqual([TEXT])
  expect(get('copy-markdown').text()).toBe('Copied')
  expect(app.find('[data-testid="copy-markdown-dialog"]').exists()).toBe(false)
})

test('when the clipboard refuses, the text is shown, selected, to copy by hand', async () => {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'))

  await get('copy-markdown').trigger('click')
  await flushPromises()

  const area = get('copy-markdown-dialog').get('textarea').element as HTMLTextAreaElement
  expect(area.value).toBe(TEXT)
  expect(document.activeElement).toBe(area)
  expect([area.selectionStart, area.selectionEnd]).toEqual([0, TEXT.length])

  await get('copy-markdown-dialog').trigger('keydown', { key: 'Escape' })
  expect(app.find('[data-testid="copy-markdown-dialog"]').exists()).toBe(false)
})
