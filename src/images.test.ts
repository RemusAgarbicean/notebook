// @vitest-environment jsdom
// DOMPurify does not sanitize under happy-dom, so these run in jsdom.
import { beforeEach, expect, test } from 'vitest'
import {
  MAX_BYTES,
  addImage,
  altFor,
  collectImages,
  imageData,
  imageInfo,
  imageRefs,
  imageTotals,
  pastedImages,
  pickStored,
  portableImages,
  rewriteImageRefs,
  targetSize,
  tooBig,
} from './images'
import { renderMarkdown } from './markdown'
import { migrate } from './migrations'
import { db, openNotebook } from './notebook'
import { createRecord, deleteRecord, duplicateRecord, getRecord, updateRecord } from './records'
import { setSetting } from './settings'
import { loadSqlite } from './sqlite'
import { memoryFolder } from './storage-memory'
import { undoDelete } from './undo-delete'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const png = (fill = 7, length = 64) => ({ mime: 'image/png', width: 40, height: 30, data: new Uint8Array(length).fill(fill) })
const ids = () => (db.value!.exec('select id from image order by id')[0]?.values.flat() ?? []) as number[]
const owner = (id: number) => {
  const info = imageInfo(id)!
  return `${info.owner_type}:${info.owner_id}`
}

// References in text

test('the Image references of a text are found once each, in order', () => {
  expect(imageRefs('See ![a](image:3) and ![b](image:12), again ![a](image:3). Not ![x](https://e.com/image.png)')).toEqual([3, 12])
  expect(imageRefs('no images')).toEqual([])
})

test('references are rewritten to their copies and others stay', () => {
  const text = '![a](image:3) text image:3 ![b](image:4) ![alt [x]](image:31)'

  expect(rewriteImageRefs(text, new Map([[3, 9]]))).toBe('![a](image:9) text image:3 ![b](image:4) ![alt [x]](image:31)')
})

test('for a mail or a chat an Image reference becomes its alt text in brackets', () => {
  expect(portableImages('Before ![the PO screen](image:3) after ![](image:4)')).toBe('Before [image: the PO screen] after [image]')
  expect(portableImages('![remote](https://e.com/a.png)')).toBe('![remote](https://e.com/a.png)')
})

// The paste rule

test('a paste is an Image only when the clipboard has an image and no text', () => {
  const shot = { type: 'image/png' }
  const sheet = { type: 'text/csv' }

  expect(pastedImages('', [shot])).toEqual([shot])
  expect(pastedImages('  \n', [shot])).toEqual([shot])
  // Excel and Word put the cells as text next to a picture of them.
  expect(pastedImages('a\tb\n1\t2', [shot])).toEqual([])
  expect(pastedImages('', [sheet])).toEqual([])
  expect(pastedImages('', [])).toEqual([])
  // A GIF is still an image: it is refused with a message later, not pasted as nothing.
  expect(pastedImages('', [{ type: 'image/gif' }, sheet])).toEqual([{ type: 'image/gif' }])
})

// The size policy

test('an image is scaled down so that its longest side is 1600, and never up', () => {
  expect(targetSize(3200, 1800)).toEqual({ width: 1600, height: 900 })
  expect(targetSize(1000, 4000)).toEqual({ width: 400, height: 1600 })
  expect(targetSize(1600, 900)).toEqual({ width: 1600, height: 900 })
  expect(targetSize(40, 30)).toEqual({ width: 40, height: 30 })
  expect(targetSize(5000, 1)).toEqual({ width: 1600, height: 1 })
})

test('the re-encoded image is stored only when it is smaller than the original', () => {
  expect(pickStored(9000, 4000)).toBe('encoded')
  expect(pickStored(900, 4000)).toBe('original')
  expect(pickStored(900, 900)).toBe('original')
  // The browser could not encode it.
  expect(pickStored(9000, null)).toBe('original')
})

test('an image above the cap after processing is refused', () => {
  expect(tooBig(MAX_BYTES)).toBe(false)
  expect(tooBig(MAX_BYTES + 1)).toBe(true)
  expect(MAX_BYTES).toBe(2 * 1024 * 1024)
})

test('alt text comes from the file name, without what would break the reference', () => {
  expect(altFor('PO screen [v2].final.png')).toBe('PO screen v2.final')
  expect(altFor('image.png')).toBe('screenshot')
  expect(altFor('')).toBe('screenshot')
})

// The repository

test('an added Image can be read back with its facts and counts in the totals', () => {
  const coupa = createRecord('system', 'Coupa')

  const id = addImage({ type: 'system', id: coupa }, png(7, 64))

  expect(imageInfo(id)).toMatchObject({ id, mime: 'image/png', width: 40, height: 30, bytes: 64, owner_type: 'system', owner_id: coupa })
  expect(imageData(id)).toEqual(new Uint8Array(64).fill(7))
  expect(imageTotals()).toEqual({ count: 1, bytes: 64 })
  expect(imageInfo(99)).toBeNull()
  expect(imageData(99)).toBeNull()
})

// Lifecycle

test('deleting a Record deletes its Images, and Undo brings them back under the same ids', () => {
  const coupa = createRecord('system', 'Coupa')
  const other = createRecord('system', 'SAP')
  const kept = addImage({ type: 'system', id: other }, png(1))
  const id = addImage({ type: 'system', id: coupa }, png(7))
  updateRecord('system', coupa, { notes: `![screen](image:${id})` })
  updateRecord('system', other, { notes: `![screen](image:${kept})` })

  deleteRecord('system', coupa)
  expect(ids()).toEqual([kept])
  // A new Image never takes a deleted one's id.
  const later = addImage({ type: 'system', id: other }, png(2))
  expect(later).toBeGreaterThan(id)

  undoDelete()
  expect(ids()).toEqual([kept, id, later])
  expect(imageData(id)).toEqual(new Uint8Array(64).fill(7))
  expect(owner(id)).toBe(`system:${coupa}`)
})

test('an Image whose reference was moved to another Record survives the delete of the Record it was pasted into', () => {
  const coupa = createRecord('system', 'Coupa')
  const log = createRecord('journal_entry', 'Monday')
  const id = addImage({ type: 'system', id: coupa }, png())
  // Cut from Coupa's notes, pasted into the Journal entry.
  updateRecord('journal_entry', log, { notes: `![screen](image:${id})` })

  deleteRecord('system', coupa)

  expect(owner(id)).toBe(`journal_entry:${log}`)
  undoDelete()
  expect(owner(id)).toBe(`journal_entry:${log}`)
  deleteRecord('journal_entry', log)
  expect(ids()).toEqual([])
})

test("an Open question's answer counts as its text too", () => {
  const q = createRecord('open_question', 'What is a PO?')
  const coupa = createRecord('system', 'Coupa')
  const id = addImage({ type: 'system', id: coupa }, png())
  updateRecord('open_question', q, { answer: `![screen](image:${id})` })

  deleteRecord('system', coupa)

  expect(owner(id)).toBe(`open_question:${q}`)
})

test('a duplicate gets its own copies of the Images in its notes', () => {
  const coupa = createRecord('system', 'Coupa')
  const id = addImage({ type: 'system', id: coupa }, png(7))
  updateRecord('system', coupa, { notes: `Look: ![screen](image:${id}) and ![gone](image:999)` })

  const copy = duplicateRecord('system', coupa)

  const [copied] = ids().filter((i) => i !== id)
  expect(getRecord('system', copy)!.notes).toBe(`Look: ![screen](image:${copied}) and ![gone](image:999)`)
  expect(owner(copied)).toBe(`system:${copy}`)
  expect(imageData(copied)).toEqual(new Uint8Array(64).fill(7))
  // The copy is as fresh as any new Record.
  expect(getRecord('system', copy)!.created_at).toBe(getRecord('system', copy)!.updated_at)

  deleteRecord('system', coupa)
  expect(ids()).toEqual([copied])
})

test('collecting removes only the Images that no text references, and gives a moved Image to the Record that has it', () => {
  const coupa = createRecord('system', 'Coupa')
  const log = createRecord('journal_entry', 'Monday')
  const at = { type: 'system' as const, id: coupa }
  const [shown, removed, moved, both, inTemplate] = [png(1), png(2), png(3), png(4), png(5)].map((p) => addImage(at, p))
  updateRecord('system', coupa, { notes: `![a](image:${shown}) ![d](image:${both})` })
  updateRecord('journal_entry', log, { notes: `![c](image:${moved}) ![d](image:${both})` })
  setSetting('template:person', `![e](image:${inTemplate})`)

  expect(collectImages(db.value!)).toBe(1)

  expect(ids()).toEqual([shown, moved, both, inTemplate])
  expect(removed).toBe(2)
  expect(owner(shown)).toBe(`system:${coupa}`)
  expect(owner(moved)).toBe(`journal_entry:${log}`)
  expect(owner(both)).toBe(`system:${coupa}`)
  expect(collectImages(db.value!)).toBe(0)
})

test('opening a Notebook collects the Images nothing refers to, and leaves the file alone until the next save', async () => {
  const coupa = createRecord('system', 'Coupa')
  const shown = addImage({ type: 'system', id: coupa }, png(1))
  addImage({ type: 'system', id: coupa }, png(2))
  updateRecord('system', coupa, { notes: `![a](image:${shown})` })
  const file = db.value!.export()
  const folder = memoryFolder(file)

  await openNotebook(folder)

  expect(ids()).toEqual([shown])
  expect(imageData(shown)).toEqual(new Uint8Array(64).fill(1))
  expect(folder.file).toBe(file)
})

// Rendering

test('an Image reference renders as a picture that names its Image, with its alt text and size, and no address to fetch', () => {
  const coupa = createRecord('system', 'Coupa')
  const id = addImage({ type: 'system', id: coupa }, png())

  const html = renderMarkdown(`Look: ![the "PO" screen](image:${id})`)

  expect(html).toContain(`<img data-image="${id}" alt="the &quot;PO&quot; screen" width="40" height="30">`)
  expect(html).not.toContain('src')
})

test('a reference to an Image that is gone renders as a placeholder, never as something to fetch', () => {
  const html = renderMarkdown('![the PO screen](image:404) ![](image:405)')

  expect(html).toContain('<span class="image-missing" title="This Image is no longer in the Notebook">Missing image: the PO screen</span>')
  expect(html).toContain('>Missing image</span>')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('image:404')
})

test('typed HTML can name an Image but can not give it an address', () => {
  const html = renderMarkdown('a <img data-image="1" src="https://example.com/track.png" srcset="https://example.com/x.png 2x"> b')

  expect(html.trim()).toBe('<p>a <img data-image="1"> b</p>')
})

test('an Image a template refers to survives the delete of the Record it was pasted into', () => {
  const coupa = createRecord('system', 'Coupa')
  const id = addImage({ type: 'system', id: coupa }, png())
  updateRecord('system', coupa, { notes: `![screen](image:${id})` })
  setSetting('template:system', `Start from ![screen](image:${id})`)

  deleteRecord('system', coupa)

  expect(ids()).toEqual([id])
  expect(collectImages(db.value!)).toBe(0)
})

test('a file dragged over the page is kept from opening in place of the app, except over a file input', async () => {
  await import('./image-view')
  const over = (target: Element) => {
    const event = Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), {
      dataTransfer: { types: ['Files'], dropEffect: 'copy' },
    })
    target.dispatchEvent(event)
    return event
  }
  const div = document.body.appendChild(document.createElement('div'))
  const input = document.body.appendChild(Object.assign(document.createElement('input'), { type: 'file' }))

  expect(over(div).defaultPrevented).toBe(true)
  expect(over(div).dataTransfer.dropEffect).toBe('none')
  expect(over(input).defaultPrevented).toBe(false)
  expect(over(input).dataTransfer.dropEffect).toBe('copy')
})
