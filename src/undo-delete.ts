import { shallowRef } from 'vue'
import { doomedImages, restoreImages, type ImageRow } from './images'
import { linkedNodes, relinkNodes, type NodesInDiagram } from './diagram/links'
import { keepMentions } from './mentions'
import { db } from './notebook'
import { isPinned, setPinned } from './pins'
import type { RecordType } from './record-types'
import { addTag, changed, getRecord, recordTags, rows, transaction, type RecordRef, type Titled, type Value } from './records'
import { addLabel, deletedLabels, fold, listLabels } from './relations'

// Undo delete: what a delete removed is kept in memory, for this session and
// this Notebook only, and put back latest first. Mentions are text and need nothing.

type RelationRow = {
  from_type: RecordType
  from_id: number
  label_id: number
  to_type: RecordType
  to_id: number
  created_at: string
  /** The label's readings, should the label be deleted before the Undo. */
  forward: string
  reverse: string
}

type Deleted = Titled & {
  row: Record<string, Value>
  relations: RelationRow[]
  tags: string[]
  nodes: NodesInDiagram[]
  pinned: boolean
  images: ImageRow[]
  /** How long `deletedLabels` was at the delete: a label deleted after that may have lost its id to another. */
  labelMark: number
}

/** How many deletes can be undone. */
const KEEP = 5

// The deletes of one database, oldest first: a restore, a reload or another Notebook starts over.
const kept = shallowRef<{ db: unknown; stack: Deleted[] }>({ db: null, stack: [] })
const stack = () => (kept.value.db === db.value ? kept.value.stack : [])

/** The delete that Undo would take back, or null. Reactive. */
export const lastDeleted = (): Titled | null => stack().at(-1) ?? null

/**
 * Everything `deleteRecord` is about to remove. Call it first, inside the
 * delete's transaction, and pass the result to `rememberDeleted` once it is through.
 */
export function captureDeleted(target: RecordRef): Deleted | null {
  const row = getRecord(target.type, target.id)
  if (!row) return null
  return {
    ...target,
    title: row.title,
    row,
    relations: rows<RelationRow>(
      `select r.*, l.forward, l.reverse from relation r join label l on l.id = r.label_id
       where (r.from_type = ?1 and r.from_id = ?2) or (r.to_type = ?1 and r.to_id = ?2)`,
      [target.type, target.id],
    ),
    tags: recordTags(target.type, target.id).map((t) => t.name),
    nodes: linkedNodes(target),
    pinned: isPinned(target),
    images: doomedImages(target),
    labelMark: deletedLabels.length,
  }
}

export function rememberDeleted(deleted: Deleted | null) {
  if (deleted) kept.value = { db: db.value, stack: [...stack(), deleted].slice(-KEEP) }
}

// The label a Relation gets back, and whether it must be saved the other way round to read as it did.
// By id while that label lives, whatever it reads now: a rename is the user's wish. A label deleted since
// comes back, unless its readings were taken meanwhile: then the label that has them is used. Never throws.
function labelFor(r: RelationRow, labelMark: number): { id: number; flipped: boolean } {
  const labels = listLabels()
  if (!deletedLabels.includes(r.label_id, labelMark) && labels.some((l) => l.id === r.label_id))
    return { id: r.label_id, flipped: false }
  const [forward, reverse] = [fold(r.forward), fold(r.reverse)]
  const find = (test: (f: string, r: string) => boolean) => labels.find((l) => test(fold(l.forward), fold(l.reverse)))?.id
  const same = find((f, v) => f === forward && v === reverse) ?? find((f, v) => f === forward || v === reverse)
  if (same) return { id: same, flipped: false }
  const turned = find((f, v) => f === reverse || v === forward)
  return turned ? { id: turned, flipped: true } : { id: addLabel(r.forward, r.reverse), flipped: false }
}

/**
 * Puts the last deleted Record back under its id, with its Relations, its Tags, its Images,
 * its pin and the Nodes that were linked to it, all or nothing. Returns the Record, or
 * null when there is nothing to undo. Throws, with the delete still undoable, if it can't.
 */
export function undoDelete(): RecordRef | null {
  const last = stack().at(-1)
  if (!last) return null
  const d = db.value!
  const { type, id } = last
  transaction(() => {
    keepMentions(last.title)
    const columns = Object.keys(last.row)
    // `deleteRecord` retired the id, so no other Record can have taken it.
    d.run(
      `insert into ${type} (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`,
      Object.values(last.row),
    )
    for (const r of last.relations) {
      const other: RecordRef =
        r.from_type === type && r.from_id === id ? { type: r.to_type, id: r.to_id } : { type: r.from_type, id: r.from_id }
      if (!getRecord(other.type, other.id)) continue
      const label = labelFor(r, last.labelMark)
      const from = [r.from_type, r.from_id]
      const to = [r.to_type, r.to_id]
      d.run(
        'insert or ignore into relation (from_type, from_id, label_id, to_type, to_id, created_at) values (?, ?, ?, ?, ?, ?)',
        [...(label.flipped ? to : from), label.id, ...(label.flipped ? from : to), r.created_at],
      )
    }
    for (const tag of last.tags) addTag(type, id, tag)
    relinkNodes(last, last.title, last.nodes)
    if (last.pinned) setPinned(last, true)
    restoreImages(last.images)
  })
  kept.value = { db: d, stack: stack().slice(0, -1) }
  changed()
  return { type, id }
}
