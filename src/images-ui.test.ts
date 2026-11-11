import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { addImage, imageInfo, imageTotals } from './images'
import { openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { recordMarkdown } from './record-markdown'
import { createRecord, getRecord, updateRecord } from './records'
import { memoryFolder } from './storage-memory'

// Decoding and shrinking need a real browser's canvas: here every file comes out as a 40 × 30 WebP of 5 bytes.
vi.mock('./image-file', () => ({
  prepareImage: async (file: File) => {
    if (file.type === 'image/gif') throw new Error('Only PNG, JPEG and WebP images can be added.')
    return { mime: 'image/webp', width: 40, height: 30, data: new Uint8Array(5) }
  },
}))

let app: VueWrapper
let id: number

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
  id = createRecord('process', 'Buying')
  openRecord('process', id)
  await flushPromises()
})
afterEach(() => app.unmount())

const area = () => app.get('[data-testid="notes"] textarea')
const el = () => area().element as HTMLTextAreaElement
const notes = () => getRecord('process', id)!.notes
const notice = () => app.find('[data-testid="image-notice"]')
async function type(marked: string) {
  const [a, b] = marked.split('|')
  await area().setValue(a + b)
  el().setSelectionRange(a.length, a.length)
}
const file = (name: string, type: string) => new File(['x'], name, { type })
async function send(kind: 'paste' | 'drop', text: string, files: File[]) {
  const event = new Event(kind, { bubbles: true, cancelable: true })
  const data = { getData: (k: string) => (k === 'text/plain' ? text : ''), files, types: files.length ? ['Files'] : ['text/plain'] }
  Object.assign(event, kind === 'paste' ? { clipboardData: data } : { dataTransfer: data })
  el().dispatchEvent(event)
  await flushPromises()
  return event
}

test('pasting a screenshot stores it as an Image of the Record and puts its reference at the caret', async () => {
  await type('before | after')

  const event = await send('paste', '', [file('image.png', 'image/png')])

  expect(event.defaultPrevented).toBe(true)
  expect(notes()).toBe('before ![screenshot](image:1) after')
  expect(imageInfo(1)).toMatchObject({ owner_type: 'process', owner_id: id, mime: 'image/webp', bytes: 5 })
  expect(el().selectionStart).toBe('before ![screenshot](image:1)'.length)
  expect(notice().text()).toBe('Image added: 40 × 30, 1 KB in the Notebook.')
  expect(notice().attributes('role')).toBe('status')
})

test('a paste that has text stays a text paste, even with a picture next to it', async () => {
  await type('|')

  const event = await send('paste', 'System\tOwner\nCoupa\tAna', [file('image.png', 'image/png')])

  expect(notes()).toBe('| System | Owner |\n| --- | --- |\n| Coupa | Ana |\n')
  expect(event.defaultPrevented).toBe(true)
  expect(imageTotals().count).toBe(0)
})

test('dropped image files are added, named after the file', async () => {
  await type('|')

  const event = await send('drop', '', [file('PO screen.png', 'image/png'), file('flow.jpg', 'image/jpeg')])

  expect(event.defaultPrevented).toBe(true)
  expect(notes()).toBe('![PO screen](image:1)![flow](image:2)')
})

test('an image that can not be added says why and changes nothing', async () => {
  await type('text|')

  await send('paste', '', [file('funny.gif', 'image/gif')])

  expect(notes()).toBe('text')
  expect(notice().text()).toBe('Only PNG, JPEG and WebP images can be added.')
  expect(notice().attributes('role')).toBe('alert')
  expect(imageTotals().count).toBe(0)
})

test('the formatting bar has an image button that opens the file chooser', async () => {
  await type('|')
  const picker = app.get('[data-testid="image-picker"]').element as HTMLInputElement
  const clicked = vi.spyOn(picker, 'click').mockImplementation(() => {})

  await app.get('[data-testid="format-image"]').trigger('click')

  expect(clicked).toHaveBeenCalled()
  expect(picker.accept).toBe('image/png,image/jpeg,image/webp')
})

test('a click on an Image in the notes opens it in a viewer that Esc closes', async () => {
  const image = addImage({ type: 'process', id }, { mime: 'image/png', width: 40, height: 30, data: new Uint8Array(2048) })
  updateRecord('process', id, { notes: `![the PO screen](image:${image})` })
  // Empty notes opened ready to type: Done shows them rendered.
  await app.get('[data-testid="notes"] button[aria-label="Done editing Notes"]').trigger('click')
  const img = app.get('[data-testid="markdown-view"] img')
  expect(img.attributes('src')).toMatch(/^blob:/)
  expect(img.attributes('alt')).toBe('the PO screen')

  await img.trigger('click')

  const viewer = app.get('[data-testid="image-viewer"]')
  expect(viewer.attributes('aria-label')).toBe('the PO screen')
  expect(viewer.get('[data-testid="image-facts"]').text()).toBe('40 × 30 · PNG · 2 KB')
  expect(viewer.get('img').attributes('src')).toMatch(/^blob:/)

  await viewer.trigger('keydown', { key: 'Escape' })
  expect(app.find('[data-testid="image-viewer"]').exists()).toBe(false)
})

test('Copy as Markdown names an Image instead of carrying it', () => {
  const image = addImage({ type: 'process', id }, { mime: 'image/png', width: 40, height: 30, data: new Uint8Array(9) })
  updateRecord('process', id, { notes: `Step 1: ![the PO screen](image:${image})` })

  expect(recordMarkdown('process', id)).toBe('# Buying\n\n- **Type:** Process\n\nStep 1: [image: the PO screen]\n')
})

test('the Backups screen tells how much of the file is Images', async () => {
  await app.get('[data-testid="open-backups"]').trigger('click')
  await flushPromises()
  expect(app.get('[data-testid="image-totals"]').text()).toBe('The Notebook holds no Images.')

  addImage({ type: 'process', id }, { mime: 'image/png', width: 40, height: 30, data: new Uint8Array(3 * 1024 * 1024) })
  addImage({ type: 'process', id }, { mime: 'image/png', width: 40, height: 30, data: new Uint8Array(1024 * 1024) })
  await flushPromises()

  expect(app.get('[data-testid="image-totals"]').text()).toBe('The Notebook holds 2 Images, 4.0 MB of its file.')
})
