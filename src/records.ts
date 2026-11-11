import { ref } from 'vue'
import { renameMentions } from './mentions'
import { db, markDirty } from './notebook'
import { RECORD_FIELDS, type Field } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'

export type Value = string | number | null
export type Rec = {
  id: number
  title: string
  notes: string
  created_at: string
  updated_at: string
} & Record<string, Value>
export type RecordRef = { type: RecordType; id: number }
export type Tag = { id: number; name: string }
/** What callers may pass for a field; booleans are stored as 0/1. */
export type Patch = Record<string, Value | boolean | undefined>

/**
 * The refresh signal: SQL writes are invisible to Vue, so every read here
 * depends on it and every write bumps it through `changed()`.
 */
export const revision = ref(0)

/** Call after any write to the database: refreshes the UI and schedules a save. */
export function changed() {
  revision.value++
  markDirty()
}

/** Runs a query and returns its rows as objects. Reactive: re-runs in a computed after `changed()`. */
export function rows<T = Record<string, Value>>(sql: string, params: Value[] = []): T[] {
  void revision.value
  const [result] = db.value!.exec(sql, params)
  if (!result) return []
  return result.values.map(
    (v) => Object.fromEntries(result.columns.map((c, i) => [c, v[i]])) as T,
  )
}

// Types reach SQL as table names, and can come from stored rows, so they are checked.
function table(type: RecordType): RecordType {
  if (!RECORD_TYPES.some((t) => t.type === type)) throw new Error(`Unknown Record type: ${type}`)
  return type
}

const now = () => new Date().toISOString()
/** Today in the user's time zone, as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString('sv')

const TITLE: Field = { name: 'title', label: 'Title', kind: 'text', required: true }
const NOTES: Field = { name: 'notes', label: 'Notes', kind: 'markdown', required: true }

// The automatic timestamps: [field, value that counts as closed, timestamp column].
const CLOSED: Partial<Record<RecordType, [field: string, value: Value, stamp: string]>> = {
  task: ['done', 1, 'done_at'],
  project: ['status', 'done', 'done_at'],
  open_question: ['status', 'answered', 'answered_at'],
}

/** Whether a Task is done, a Project is done or an Open question is answered. */
export function isClosed(type: RecordType, record: Record<string, Value>): boolean {
  const rule = CLOSED[type]
  return !!rule && record[rule[0]] === rule[1]
}

// Validates a patch and turns it into column values. Throws with a message fit for the user.
function normalize(type: RecordType, patch: Patch): Record<string, Value> {
  const fields = [TITLE, NOTES, ...RECORD_FIELDS[type].fields]
  const out: Record<string, Value> = {}
  for (const [name, raw] of Object.entries(patch)) {
    if (raw === undefined) continue
    const field = fields.find((f) => f.name === name)
    if (!field) throw new Error(`A ${RECORD_FIELDS[type].singular} has no field "${name}"`)
    if (field.kind === 'checkbox') {
      out[name] = raw ? 1 : 0
      continue
    }
    // Notes keep their whitespace; everything else is trimmed.
    const value = raw === null ? '' : name === 'notes' ? String(raw) : String(raw).trim()
    if (field.options && !field.options.includes(value))
      throw new Error(`${field.label} must be one of: ${field.options.join(', ')}`)
    if (field.required && name !== 'notes' && !value) throw new Error(`${field.label} is required`)
    out[name] = value || (field.required ? '' : null)
  }
  return out
}

/**
 * Creates a Record and returns its id. Only the title is needed: a required
 * field left out of `fields` starts empty for the user to fill in on the page.
 * A Journal entry's date defaults to today and its title to "<date> <kind>".
 */
export function createRecord(type: RecordType, title: string, fields: Patch = {}): number {
  const patch: Patch = { ...fields }
  if (type === 'journal_entry') {
    patch.date ||= today()
    title = title.trim() || `${patch.date} ${patch.kind ?? 'log'}`
  }
  const values = normalize(type, { ...patch, title })
  for (const f of RECORD_FIELDS[type].fields) if (f.required) values[f.name] ??= ''
  const rule = CLOSED[type]
  if (rule && values[rule[0]] === rule[1]) values[rule[2]] = now()

  const columns = Object.keys(values)
  db.value!.run(
    `insert into ${table(type)} (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`,
    Object.values(values),
  )
  const id = db.value!.exec('select last_insert_rowid()')[0].values[0][0] as number
  changed()
  return id
}

export const getRecord = (type: RecordType, id: number): Rec | null =>
  rows<Rec>(`select * from ${table(type)} where id = ?`, [id])[0] ?? null

const ORDER: Partial<Record<RecordType, string>> = {
  task: 'done, due is null, due,',
  open_question: "status = 'answered',",
  journal_entry: 'date desc, id desc,',
}

/** A type's Records in list order: open Tasks and Open questions first, the Journal latest first. */
export const listRecords = (type: RecordType): Rec[] =>
  rows<Rec>(`select * from ${table(type)} order by ${ORDER[type] ?? ''} title collate nocase, id`)

/** Saves the given fields, bumps `updated_at` and keeps `done_at`/`answered_at` in step. */
export function updateRecord(type: RecordType, id: number, patch: Patch) {
  const values = normalize(type, patch)
  const rule = CLOSED[type]
  if (rule && rule[0] in values) {
    const closes = values[rule[0]] === rule[1]
    // The timestamp only changes when the Record actually closes or reopens.
    if (closes !== isClosed(type, getRecord(type, id) ?? {})) values[rule[2]] = closes ? now() : null
  }
  values.updated_at = now()
  const d = db.value!
  // A rename also rewrites every Mention of the Record, in the same transaction.
  const renamed = 'title' in values && values.title !== getRecord(type, id)?.title
  if (renamed) d.run('begin')
  try {
    if (renamed) renameMentions({ type, id }, String(values.title))
    d.run(
      `update ${table(type)} set ${Object.keys(values)
        .map((c) => `${c} = ?`)
        .join(', ')} where id = ?`,
      [...Object.values(values), id],
    )
    if (renamed) d.run('commit')
  } catch (e) {
    if (renamed) d.run('rollback')
    throw e
  }
  changed()
}

const DROP_UNUSED_TAGS = 'delete from tag where id not in (select tag_id from record_tag)'

/** Deletes a Record with its Relations and Tag links, which SQLite can't cascade (ADR 0001). */
export function deleteRecord(type: RecordType, id: number) {
  const d = db.value!
  d.run('begin')
  try {
    d.run(
      'delete from relation where (from_type = ? and from_id = ?) or (to_type = ? and to_id = ?)',
      [type, id, type, id],
    )
    d.run('delete from record_tag where type = ? and id = ?', [type, id])
    d.run(DROP_UNUSED_TAGS)
    d.run(`delete from ${table(type)} where id = ?`, [id])
    d.run('commit')
  } catch (e) {
    d.run('rollback')
    throw e
  }
  changed()
}

/** Every Tag, by name. A Tag exists only while some Record has it. */
export const listTags = (): Tag[] => rows<Tag>('select id, name from tag order by name collate nocase')

export const recordTags = (type: RecordType, id: number): Tag[] =>
  rows<Tag>(
    `select t.id, t.name from tag t join record_tag rt on rt.tag_id = t.id
     where rt.type = ? and rt.id = ? order by t.name collate nocase`,
    [type, id],
  )

/** Adds a Tag to a Record, reusing an existing Tag whose name matches ignoring case. */
export function addTag(type: RecordType, id: number, name: string) {
  name = name.trim()
  if (!name) return
  const d = db.value!
  d.run('insert into tag (name) select ? where not exists (select 1 from tag where name = ? collate nocase)', [name, name])
  d.run(
    'insert or ignore into record_tag (tag_id, type, id) select id, ?, ? from tag where name = ? collate nocase',
    [table(type), id, name],
  )
  changed()
}

export function removeTag(type: RecordType, id: number, tagId: number) {
  db.value!.run('delete from record_tag where tag_id = ? and type = ? and id = ?', [tagId, type, id])
  db.value!.run(DROP_UNUSED_TAGS)
  changed()
}

/** Every Record with the Tag, across all types, by title. */
export const recordsWithTag = (tagId: number): (RecordRef & { title: string })[] =>
  rows(
    `select * from (${RECORD_TYPES.map(
      ({ type }) =>
        `select '${type}' as type, r.id, r.title from ${type} r
         join record_tag rt on rt.type = '${type}' and rt.id = r.id and rt.tag_id = ?1`,
    ).join(' union all ')}) order by title collate nocase`,
    [tagId],
  )
