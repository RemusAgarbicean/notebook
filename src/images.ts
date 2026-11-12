import type { Database } from 'sql.js'
import { markdown } from './markdown'
import { db } from './notebook'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { changed, revision, type RecordRef } from './records'

// Images: pictures pasted into notes. The text holds `![alt](image:<id>)`; the bytes live in the
// `image` table, owned by the Record they were pasted into. An id is unique in the whole Notebook,
// so a reference keeps working when it is moved to another Record's text.

/** The longest side an Image is stored with; a larger one is scaled down. */
export const MAX_SIDE = 1600
/** The most one Image may take in the file, after scaling and re-encoding. */
export const MAX_BYTES = 2 * 1024 * 1024
/** What can be added: still raster images. No GIF (animation) and no SVG (it can hold scripts and fetch). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// ---- References in text

// Anything that looks like a reference counts when deciding what to keep: better an Image too many than one lost.
const MENTIONED = /image:(\d+)/g
// The reference as markdown writes it. Alt text holding `]` is not rewritten.
const WRITTEN = /\]\(image:(\d+)\)/g
const WHOLE = /!\[([^\]\n]*)\]\(image:(\d+)\)/g

/** The ids of the Images a text refers to, each once, in order. */
export const imageRefs = (text: string): number[] => [...new Set([...text.matchAll(MENTIONED)].map((m) => Number(m[1])))]

/** The markdown that shows an Image. */
export const imageMarkdown = (id: number, alt: string) => `![${alt}](image:${id})`

/** The text with each reference to an id in `map` pointing at the id it maps to. */
export const rewriteImageRefs = (text: string, map: Map<number, number>): string =>
  text.replace(WRITTEN, (whole, id) => (map.has(Number(id)) ? `](image:${map.get(Number(id))})` : whole))

/** The text for outside the Notebook, where an Image reference means nothing: `[image: alt]` in its place. */
export const portableImages = (text: string): string =>
  text.replace(WHOLE, (_, alt: string) => (alt.trim() ? `[image: ${alt.trim()}]` : '[image]'))

/** Alt text for an added file: its name without the extension, or "screenshot" for the clipboard's nameless image. */
export function altFor(fileName: string): string {
  const name = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[[\]()\n]/g, '').trim()
  return !name || name === 'image' ? 'screenshot' : name
}

// ---- The paste rule and the size policy

/**
 * The files of a paste that are images, when the paste is an image at all:
 * only when the clipboard has no text. Excel and Word copy a picture of the
 * cells next to their text, and that paste must stay a text paste.
 */
export const pastedImages = <F extends { type: string }>(text: string, files: F[]): F[] =>
  text.trim() ? [] : files.filter((f) => f.type.startsWith('image/'))

/** The size an image is stored at: the longest side at most `max`, never larger than it is. */
export function targetSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Which bytes to store: the re-encoded (and maybe scaled down) image only when that is smaller than the file as it came. */
export const pickStored = (originalBytes: number, encodedBytes: number | null): 'original' | 'encoded' =>
  encodedBytes !== null && encodedBytes < originalBytes ? 'encoded' : 'original'

export const tooBig = (bytes: number) => bytes > MAX_BYTES

// ---- The repository

export type NewImage = { mime: string; width: number; height: number; data: Uint8Array }
export type ImageInfo = {
  id: number
  owner_type: RecordType
  owner_id: number
  mime: string
  width: number
  height: number
  bytes: number
  created_at: string
}
/** An Image as it is stored, bytes included: what Undo delete keeps. */
export type ImageRow = ImageInfo & { data: Uint8Array }

const FACTS = 'id, owner_type, owner_id, mime, width, height, bytes, created_at'

function read<T>(d: Database, sql: string, params: (string | number)[] = []): T[] {
  const [result] = d.exec(sql, params)
  return result ? result.values.map((v) => Object.fromEntries(result.columns.map((c, i) => [c, v[i]])) as T) : []
}

function insert(d: Database, image: Omit<ImageRow, 'id' | 'created_at'> & { id?: number; created_at?: string }): number {
  const columns = Object.keys(image).filter((c) => image[c as keyof typeof image] !== undefined)
  d.run(
    `insert into image (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`,
    columns.map((c) => image[c as keyof typeof image]!),
  )
  return d.exec('select last_insert_rowid()')[0].values[0][0] as number
}

/** Stores an Image for the Record it was added to and returns its id. */
export function addImage(owner: RecordRef, image: NewImage): number {
  const id = insert(db.value!, { owner_type: owner.type, owner_id: owner.id, ...image, bytes: image.data.length })
  changed()
  return id
}

/** An Image's facts without its bytes, or null when there is no such Image. Reactive. */
export function imageInfo(id: number): ImageInfo | null {
  void revision.value
  return read<ImageInfo>(db.value!, `select ${FACTS} from image where id = ?`, [id])[0] ?? null
}

/** An Image's bytes, or null when there is no such Image. */
export const imageData = (id: number): Uint8Array | null =>
  read<{ data: Uint8Array }>(db.value!, 'select data from image where id = ?', [id])[0]?.data ?? null

/** How many Images the Notebook holds and what they take in its file. Reactive. */
export function imageTotals(): { count: number; bytes: number } {
  void revision.value
  return read<{ count: number; bytes: number }>(db.value!, 'select count(*) as count, coalesce(sum(bytes), 0) as bytes from image')[0]
}

// ---- Lifecycle

// Every markdown text that may hold an Image reference: all notes, and an Open question's answer.
const referencingTexts = (d: Database) =>
  RECORD_TYPES.flatMap(({ type }) =>
    ['notes', ...RECORD_FIELDS[type].fields.filter((f) => f.kind === 'markdown').map((f) => f.name)].flatMap((column) =>
      read<{ id: number; text: string }>(d, `select id, ${column} as text from ${type} where ${column} like '%image:%' order by id`).map(
        (row) => ({ type: type as RecordType, id: row.id, text: row.text }),
      ),
    ),
  )

// For each referenced Image, the Records whose text refers to it.
function referrers(d: Database): Map<number, RecordRef[]> {
  const found = new Map<number, RecordRef[]>()
  for (const { type, id, text } of referencingTexts(d))
    for (const image of imageRefs(text)) found.set(image, [...(found.get(image) ?? []), { type, id }])
  return found
}

const isOwner = (r: RecordRef, owner: RecordRef) => r.type === owner.type && r.id === owner.id
const giveTo = (d: Database, image: number, to: RecordRef) =>
  d.run('update image set owner_type = ?, owner_id = ? where id = ?', [to.type, to.id, image])

// The Images a template refers to: a template is text too, and what it holds lands in notes.
const inTemplates = (d: Database) =>
  new Set(read<{ value: string | null }>(d, "select value from setting where value like '%image:%'").flatMap((s) => imageRefs(s.value ?? '')))

// A Record's Images, split by what its delete does to them: `moved` are referenced by another
// Record's text and go to that Record; one a template refers to stays as it is; the rest are `doomed`.
function ownedBy(d: Database, owner: RecordRef) {
  const owned = read<ImageRow>(d, `select ${FACTS}, data from image where owner_type = ? and owner_id = ?`, [owner.type, owner.id])
  const refs = owned.length ? referrers(d) : new Map<number, RecordRef[]>()
  const kept = owned.length ? inTemplates(d) : new Set<number>()
  const heir = (image: ImageRow) => refs.get(image.id)?.find((r) => !isOwner(r, owner))
  return {
    doomed: owned.filter((i) => !heir(i) && !kept.has(i.id)),
    moved: owned.flatMap((i) => (heir(i) ? [{ id: i.id, to: heir(i)! }] : [])),
  }
}

/** The Images that deleting the Record will delete, bytes included, for Undo delete to keep. */
export const doomedImages = (owner: RecordRef): ImageRow[] => ownedBy(db.value!, owner).doomed

/**
 * The Images part of deleting a Record (ADR 0001: the app cascades). Its Images go with it,
 * except one that another Record's text refers to: that Record becomes its owner.
 * Call inside the delete's transaction, before the Record's row is gone.
 */
export function releaseImages(owner: RecordRef) {
  const d = db.value!
  const { doomed, moved } = ownedBy(d, owner)
  for (const { id, to } of moved) giveTo(d, id, to)
  for (const { id } of doomed) d.run('delete from image where id = ?', [id])
}

/** Puts deleted Images back under their ids. */
export function restoreImages(images: ImageRow[]) {
  for (const image of images) insert(db.value!, image)
}

/** Copies every Image the text refers to for `owner`, and returns the text referring to the copies. */
export function copyImages(text: string, owner: RecordRef): string {
  const d = db.value!
  const copies = new Map<number, number>()
  for (const id of new Set([...text.matchAll(WRITTEN)].map((m) => Number(m[1])))) {
    const [source] = read<ImageRow>(d, 'select mime, width, height, bytes, data from image where id = ?', [id])
    if (source) copies.set(id, insert(d, { ...source, owner_type: owner.type, owner_id: owner.id }))
  }
  return rewriteImageRefs(text, copies)
}

/**
 * Removes the Images no text refers to any more, and returns how many. An Image whose
 * reference now sits only in another Record's text is given to that Record.
 * Run when a Notebook is opened: by then no undo, of an edit or of a delete, can bring a reference back.
 */
export function collectImages(d: Database): number {
  const images = read<{ id: number; owner_type: RecordType; owner_id: number }>(d, 'select id, owner_type, owner_id from image')
  if (!images.length) return 0
  const refs = referrers(d)
  const elsewhere = inTemplates(d)
  let removed = 0
  for (const image of images) {
    const by = refs.get(image.id)
    const owner = { type: image.owner_type, id: image.owner_id }
    if (by) {
      if (!by.some((r) => isOwner(r, owner))) giveTo(d, image.id, by[0])
    } else if (!elsewhere.has(image.id)) {
      d.run('delete from image where id = ?', [image.id])
      removed++
    }
  }
  return removed
}

// ---- Rendering

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// `![alt](image:<id>)` renders as an <img> that names its Image, with no address a browser could fetch;
// a reference to an Image that is gone renders as a quiet placeholder.
markdown.use({
  renderer: {
    image({ href, text }) {
      const id = /^image:(\d+)$/.exec(href)?.[1]
      if (!id) return false
      const info = db.value && imageInfo(Number(id))
      return info
        ? `<img data-image="${id}" alt="${escape(text)}" width="${info.width}" height="${info.height}">`
        : `<span class="image-missing" title="This Image is no longer in the Notebook">Missing image${text ? `: ${escape(text)}` : ''}</span>`
    },
  },
})
