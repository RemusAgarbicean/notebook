import { ref } from 'vue'
import { unlinkNodes } from './diagram/links'
import { keepMentions, renameMentions } from './mentions'
import { db, markDirty } from './notebook'
import { RECORD_FIELDS, type Field } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { captureDeleted, rememberDeleted } from './undo-delete'

export type Value = string | number | null
export type Rec = {
  id: number
  title: string
  notes: string
  created_at: string
  updated_at: string
} & Record<string, Value>
export type RecordRef = { type: RecordType; id: number }
/** A Record with its title: what searches, pickers and Mentions pass around. */
export type Titled = RecordRef & { title: string }
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

/** A title as it is compared: trimmed and lower-cased in JS, because SQLite's `nocase` only folds ASCII. */
export const foldTitle = (s: string) => s.trim().toLocaleLowerCase()
/** Whether two titles are the same ignoring case. */
export const sameTitle = (a: string, b: string) => foldTitle(a) === foldTitle(b)
/** Whether two refs point at the same Record. */
export const sameRecord = (a: RecordRef, b: RecordRef) => a.type === b.type && a.id === b.id
/** Orders Records by title ignoring case, then id. */
export const byTitle = (a: Titled, b: Titled) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.id - b.id

let depth = 0
/**
 * Runs `work` in one transaction: all of its writes or none. A call inside
 * another joins the outer transaction. `work` must not await.
 */
export function transaction<T>(work: () => T): T {
  if (depth) return work()
  const d = db.value!
  d.run('begin')
  depth++
  try {
    const result = work()
    d.run('commit')
    return result
  } catch (e) {
    d.run('rollback')
    // Writes inside `work` already bumped `revision`; readers must see them gone.
    changed()
    throw e
  } finally {
    depth--
  }
}

let titles: { db: unknown; revision: number; all: Titled[] } | undefined
/** Every Record's title, in sidebar order then by id. Reactive like `rows`; treat the array as read-only. */
export function recordTitles(): Titled[] {
  if (titles?.db !== db.value || titles.revision !== revision.value)
    titles = {
      db: db.value,
      revision: revision.value,
      all: rows<Titled & { ord?: number }>(
        RECORD_TYPES.map(({ type }, i) => `select ${i} as ord, '${type}' as type, id, title from ${type}`).join(
          ' union all ',
        ) + ' order by ord, id',
      ).map(({ type, id, title }) => ({ type, id, title })),
    }
  return titles.all
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

// The automatic timestamps: `stamp` is set while `field` holds `value`, which counts as closed.
const CLOSED: Partial<Record<RecordType, { field: string; value: Value; stamp: string }>> = {
  task: { field: 'done', value: 1, stamp: 'done_at' },
  project: { field: 'status', value: 'done', stamp: 'done_at' },
  open_question: { field: 'status', value: 'answered', stamp: 'answered_at' },
}

/** Whether a Task is done, a Project is done or an Open question is answered. */
export function isClosed(type: RecordType, record: Record<string, Value>): boolean {
  const rule = CLOSED[type]
  return !!rule && record[rule.field] === rule.value
}

// Validates a patch and turns it into column values. Throws with a message fit for the user.
function normalize(type: RecordType, patch: Patch): Record<string, Value> {
  const fields = [TITLE, NOTES, ...RECORD_FIELDS[type].fields]
  const out: Record<string, Value> = {}
  for (const [name, raw] of Object.entries(patch)) {
    if (raw === undefined) continue
    const field = fields.find((f) => f.name === name)
    if (!field) throw new Error(`${RECORD_FIELDS[type].singular} has no field "${name}"`)
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
  if (rule && values[rule.field] === rule.value) values[rule.stamp] = now()

  return transaction(() => {
    const top = retired?.db === db.value && retired.top[type]
    if (top) values.id = Math.max(top, rows<{ id: number }>(`select max(id) as id from ${table(type)}`)[0].id ?? 0) + 1
    const columns = Object.keys(values)
    // Mentions of a Record that already has this title keep pointing at it.
    keepMentions(String(values.title))
    db.value!.run(
      `insert into ${table(type)} (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`,
      Object.values(values),
    )
    const id = db.value!.exec('select last_insert_rowid()')[0].values[0][0] as number
    changed()
    return id
  })
}

/** The id of today's Journal entry of kind log (the earliest, if there are several), started now if there is none. */
export const todaysLog = (): number =>
  rows<{ id: number }>("select id from journal_entry where date = ? and kind = 'log' order by id limit 1", [today()])[0]
    ?.id ?? createRecord('journal_entry', '', { kind: 'log' })

/** Every Record with an empty required field, by title, with the label of the first such field. No column says so: it follows from `RECORD_FIELDS`. */
export function incompleteRecords(): (Titled & { missing: string })[] {
  const selects = RECORD_TYPES.flatMap(({ type }) => {
    const required = RECORD_FIELDS[type].fields.filter((f) => f.required)
    if (!required.length) return []
    const empty = (f: Field) => `coalesce(${f.name}, '') = ''`
    const missing = `case ${required.map((f) => `when ${empty(f)} then '${f.label}'`).join(' ')} end`
    return `select '${type}' as type, id, title, ${missing} as missing from ${type} where ${required.map(empty).join(' or ')}`
  })
  return rows<Titled & { missing: string }>(selects.join(' union all ')).sort(byTitle)
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
  if (rule && rule.field in values) {
    const closes = values[rule.field] === rule.value
    // The timestamp only changes when the Record actually closes or reopens.
    if (closes !== isClosed(type, getRecord(type, id) ?? {})) values[rule.stamp] = closes ? now() : null
  }
  values.updated_at = now()
  transaction(() => {
    // A rename also rewrites every Mention of the Record, in the same transaction.
    if ('title' in values && values.title !== getRecord(type, id)?.title)
      renameMentions({ type, id }, String(values.title))
    db.value!.run(
      `update ${table(type)} set ${Object.keys(values)
        .map((c) => `${c} = ?`)
        .join(', ')} where id = ?`,
      [...Object.values(values), id],
    )
  })
  changed()
}

const DROP_UNUSED_TAGS = 'delete from tag where id not in (select tag_id from record_tag)'

// SQLite hands the highest id out again once its row is gone. Undo delete puts a Record back under its id,
// so while the Notebook stays open a new Record's id starts above every deleted one of its type.
let retired: { db: unknown; top: Partial<Record<RecordType, number>> } | undefined

/**
 * Deletes a Record with its Relations and Tag links, which SQLite can't cascade (ADR 0001), and unlinks its Nodes.
 * `undoDelete` can take the last few deletes back.
 */
export function deleteRecord(type: RecordType, id: number) {
  const d = db.value!
  if (retired?.db !== d) retired = { db: d, top: {} }
  retired.top[type] = Math.max(retired.top[type] ?? 0, id)
  const deleted = transaction(() => {
    const deleted = captureDeleted({ type, id })
    unlinkNodes({ type, id })
    d.run(
      'delete from relation where (from_type = ? and from_id = ?) or (to_type = ? and to_id = ?)',
      [type, id, type, id],
    )
    d.run('delete from record_tag where type = ? and id = ?', [type, id])
    d.run(DROP_UNUSED_TAGS)
    d.run(`delete from ${table(type)} where id = ?`, [id])
    return deleted
  })
  rememberDeleted(deleted)
  changed()
}

/** Every Tag, by name, with how many Records have it. A Tag exists only while some Record has it. */
export const listTags = (): (Tag & { count: number })[] =>
  rows(
    `select id, name, (select count(*) from record_tag rt where rt.tag_id = tag.id) as count
     from tag order by name collate nocase`,
  )

const OPEN: Partial<Record<RecordType, string>> = { task: 'where done = 0', open_question: "where status = 'open'" }

/** The sidebar's number per type: every Record, but only the open Tasks and Open questions. */
export const recordCounts = (): Record<RecordType, number> =>
  Object.fromEntries(
    rows<{ type: RecordType; n: number }>(
      RECORD_TYPES.map(({ type }) => `select '${type}' as type, count(*) as n from ${type} ${OPEN[type] ?? ''}`).join(
        ' union all ',
      ),
    ).map((r) => [r.type, r.n]),
  ) as Record<RecordType, number>

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
export function recordsWithTag(tagId: number): Titled[] {
  const tagged = new Set(
    rows<RecordRef>('select type, id from record_tag where tag_id = ?', [tagId]).map((r) => `${r.type}:${r.id}`),
  )
  return recordTitles()
    .filter((r) => tagged.has(`${r.type}:${r.id}`))
    .sort(byTitle)
}
