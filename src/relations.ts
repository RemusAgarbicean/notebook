import { db } from './notebook'
import type { RecordType } from './record-types'
import { changed, getRecord, rows, sameRecord, type RecordRef, type Titled } from './records'
import { LABEL, slotsOf, type RelationSlot } from './relation-slots'

export type Label = {
  id: number
  forward: string
  reverse: string
  protected: number
  /** How many Relations use the label. */
  uses: number
  /** False while the label is in use, and always for a protected label. */
  deletable: boolean
}

/** One reading of a label; `forward` tells which way round a Relation picked with it is saved. */
export type Reading = { labelId: number; reading: string; forward: boolean }

/** A Relation as seen from one of its Records. */
export type RelationEntry = {
  from: RecordRef
  labelId: number
  to: RecordRef
  /** The label's reading that fits the Record it is seen from. */
  reading: string
  /** Whether the Record it is seen from is the `from` end. */
  forward: boolean
  other: Titled
}

const ends = (from: RecordRef, labelId: number, to: RecordRef) => [from.type, from.id, labelId, to.type, to.id]
const WHERE = 'from_type = ? and from_id = ? and label_id = ? and to_type = ? and to_id = ?'

// ---- Labels

export const listLabels = (): Label[] =>
  rows<Omit<Label, 'deletable'>>(
    `select l.id, l.forward, l.reverse, l.protected,
       (select count(*) from relation r where r.label_id = l.id) as uses
     from label l order by l.id`,
  ).map((l) => ({ ...l, deletable: !l.protected && !l.uses }))

const fold = (reading: string) => reading.trim().toLocaleLowerCase()

// Trims the readings and refuses one that another label already has, ignoring case: the "+ Relation" list
// would show it twice. A label's own two readings may be the same, like the seeded "related to".
// On a rename (`id` given) only a reading that changes is checked, so a label that already shares one stays editable.
function clean(forward: string, reverse: string, id?: number) {
  const pair = [forward.trim(), reverse.trim()]
  if (!pair[0] || !pair[1]) throw new Error('Both readings are required')
  const labels = listLabels()
  const own = labels.find((l) => l.id === id)
  for (const reading of pair) {
    if (own && [own.forward, own.reverse].some((r) => fold(r) === fold(reading))) continue
    const taken = labels.find((l) => l.id !== id && [l.forward, l.reverse].some((r) => fold(r) === fold(reading)))
    if (taken)
      throw new Error(
        `"${reading}" is already a reading of the label "${taken.forward === taken.reverse ? taken.forward : `${taken.forward} / ${taken.reverse}`}"`,
      )
  }
  return pair
}

/** Adds a label and returns its id. */
export function addLabel(forward: string, reverse: string): number {
  db.value!.run('insert into label (forward, reverse) values (?, ?)', clean(forward, reverse))
  const id = db.value!.exec('select last_insert_rowid()')[0].values[0][0] as number
  changed()
  return id
}

/** Renames a label; every Relation using it reads the new way at once. */
export function renameLabel(id: number, forward: string, reverse: string) {
  db.value!.run('update label set forward = ?, reverse = ? where id = ?', [...clean(forward, reverse, id), id])
  changed()
}

/** Deletes an unused, unprotected label. Throws with a message fit for the user otherwise. */
export function deleteLabel(id: number) {
  const label = listLabels().find((l) => l.id === id)
  if (!label) return
  if (label.protected)
    throw new Error(`"${label.forward}" is used by the app and can't be deleted, only renamed`)
  if (label.uses)
    throw new Error(`${label.uses} ${label.uses === 1 ? 'Relation uses' : 'Relations use'} this label`)
  db.value!.run('delete from label where id = ?', [id])
  changed()
}

/** Both readings of every label, for the "+ Relation" list. A label that reads the same both ways is listed once. */
export const readings = (): Reading[] =>
  listLabels().flatMap((l) => [
    { labelId: l.id, reading: l.forward, forward: true },
    ...(l.reverse === l.forward ? [] : [{ labelId: l.id, reading: l.reverse, forward: false }]),
  ])

// ---- Relations

/** Saves from → label → to. Refuses a self-relation and a duplicate. Opens no transaction of its own. */
export function addRelation(from: RecordRef, labelId: number, to: RecordRef) {
  if (sameRecord(from, to)) throw new Error("A Record can't relate to itself")
  if (!rows('select 1 from label where id = ?', [labelId]).length) throw new Error('That label no longer exists')
  if (hasRelation(from, labelId, to)) throw new Error('That Relation already exists')
  db.value!.run(
    'insert into relation (from_type, from_id, label_id, to_type, to_id) values (?, ?, ?, ?, ?)',
    ends(from, labelId, to),
  )
  changed()
}

export const hasRelation = (from: RecordRef, labelId: number, to: RecordRef): boolean =>
  rows(`select 1 from relation where ${WHERE}`, ends(from, labelId, to)).length > 0

export function removeRelation(from: RecordRef, labelId: number, to: RecordRef) {
  db.value!.run(`delete from relation where ${WHERE}`, ends(from, labelId, to))
  changed()
}

/** Adds the Relation "record <reading> other": a reverse reading saves it the other way round. */
export function relate(record: RecordRef, reading: Pick<Reading, 'labelId' | 'forward'>, other: RecordRef) {
  if (reading.forward) addRelation(record, reading.labelId, other)
  else addRelation(other, reading.labelId, record)
}

/** Every Relation of a Record, from either end, ordered by label, then direction, then the other title. */
export function recordRelations(record: RecordRef): RelationEntry[] {
  return rows<{
    from_type: RecordType
    from_id: number
    label_id: number
    to_type: RecordType
    to_id: number
    forward: string
    reverse: string
  }>(
    `select r.from_type, r.from_id, r.label_id, r.to_type, r.to_id, l.forward, l.reverse
     from relation r join label l on l.id = r.label_id
     where (r.from_type = ?1 and r.from_id = ?2) or (r.to_type = ?1 and r.to_id = ?2)`,
    [record.type, record.id],
  )
    .flatMap((r) => {
      const from = { type: r.from_type, id: r.from_id }
      const to = { type: r.to_type, id: r.to_id }
      const forward = sameRecord(from, record)
      const other = forward ? to : from
      const title = getRecord(other.type, other.id)?.title
      // A Relation whose other Record is gone (edited outside the app) is not shown.
      if (title === undefined) return []
      return [{ from, labelId: r.label_id, to, forward, reading: forward ? r.forward : r.reverse, other: { ...other, title } }]
    })
    .sort((a, b) => a.labelId - b.labelId || Number(b.forward) - Number(a.forward) || byTitle(a, b))
}

const byTitle = (a: RelationEntry, b: RelationEntry) =>
  a.other.title.localeCompare(b.other.title, undefined, { sensitivity: 'base' })

const inSlot = (slot: RelationSlot, e: RelationEntry) =>
  e.labelId === slot.labelId && e.forward === (slot.end === 'from') && slot.offers.includes(e.other.type)

/** Seen from a Project: a Task that is part of it. These show in the Project's Tasks checklist. */
export const isProjectTask = (e: RelationEntry) =>
  e.labelId === LABEL.partOf && !e.forward && e.other.type === 'task'

/** The Relations section: every Relation not shown in one of the Record's slots or the Tasks checklist, grouped by reading. */
export function groupRelations(record: RecordRef): { reading: string; entries: RelationEntry[] }[] {
  const slots = slotsOf(record.type)
  // Keyed by label and reading, so a label that reads the same both ways makes one group.
  const groups = new Map<string, { reading: string; entries: RelationEntry[] }>()
  for (const e of recordRelations(record)) {
    if (slots.some((s) => inSlot(s, e))) continue
    if (record.type === 'project' && isProjectTask(e)) continue
    const key = `${e.labelId}:${e.reading}`
    if (!groups.has(key)) groups.set(key, { reading: e.reading, entries: [] })
    groups.get(key)!.entries.push(e)
  }
  return [...groups.values()].map((g) => ({ ...g, entries: g.entries.sort(byTitle) }))
}

// ---- Relation slots

/** The Records in a slot of the Record with this id, by title. */
export const slotRecords = (slot: RelationSlot, id: number): Titled[] =>
  recordRelations({ type: slot.type, id })
    .filter((e) => inSlot(slot, e))
    .map((e) => e.other)

/** Puts a Record in a slot, which saves an ordinary Relation with the slot's label. */
export const addToSlot = (slot: RelationSlot, id: number, other: RecordRef) =>
  relate({ type: slot.type, id }, { labelId: slot.labelId, forward: slot.end === 'from' }, other)

export function removeFromSlot(slot: RelationSlot, id: number, other: RecordRef) {
  const own = { type: slot.type, id }
  if (slot.end === 'from') removeRelation(own, slot.labelId, other)
  else removeRelation(other, slot.labelId, own)
}
