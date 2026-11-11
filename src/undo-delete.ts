import { shallowRef } from 'vue'
import { linkedNodes, relinkNodes, type NodesInDiagram } from './diagram/links'
import { keepMentions } from './mentions'
import { db } from './notebook'
import type { RecordType } from './record-types'
import { addTag, changed, getRecord, recordTags, rows, transaction, type RecordRef, type Titled, type Value } from './records'
import { addLabel, listLabels } from './relations'

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
  }
}

export function rememberDeleted(deleted: Deleted | null) {
  if (deleted) kept.value = { db: db.value, stack: [...stack(), deleted].slice(-KEEP) }
}

// The label a Relation had: by id, unless that label was deleted since (its id may now be another label's).
function labelFor(r: RelationRow): number {
  const labels = listLabels()
  const same = (l: { forward: string; reverse: string }) => l.forward === r.forward || l.reverse === r.reverse
  const byId = labels.find((l) => l.id === r.label_id)
  if (byId && (byId.protected || same(byId))) return byId.id
  return labels.find((l) => l.forward === r.forward && l.reverse === r.reverse)?.id ?? addLabel(r.forward, r.reverse)
}

/**
 * Puts the last deleted Record back under its id, with its Relations, its Tags
 * and the Nodes that were linked to it, all or nothing. Returns the Record, or
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
      d.run(
        'insert or ignore into relation (from_type, from_id, label_id, to_type, to_id, created_at) values (?, ?, ?, ?, ?, ?)',
        [r.from_type, r.from_id, labelFor(r), r.to_type, r.to_id, r.created_at],
      )
    }
    for (const tag of last.tags) addTag(type, id, tag)
    relinkNodes(last, last.title, last.nodes)
  })
  kept.value = { db: d, stack: stack().slice(0, -1) }
  changed()
  return { type, id }
}
