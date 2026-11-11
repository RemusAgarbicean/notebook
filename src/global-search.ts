import { RECORD_FIELDS } from './record-fields'
import type { Found } from './record-search'
import { RECORD_TYPES } from './record-types'
import { rows, type Rec, type RecordRef } from './records'

/** A search result. `where` names what matched when it was not the title. */
export type Hit = Found & { where?: string }

const fold = (s: unknown) => String(s ?? '').toLocaleLowerCase()

/**
 * The Records whose title, fields, notes or Tags contain the text, ignoring
 * case: title matches first, then the rest, each by title. Empty text finds nothing.
 */
export function globalSearch(text: string): Hit[] {
  const needle = fold(text.trim())
  if (!needle) return []
  const has = (v: unknown) => fold(v).includes(needle)

  const tagged = new Set(
    rows<RecordRef & { name: string }>('select rt.type, rt.id, t.name from record_tag rt join tag t on t.id = rt.tag_id')
      .filter((t) => has(t.name))
      .map((t) => `${t.type}:${t.id}`),
  )
  // shortcut: reads every Record and matches in JS (LIKE only folds ASCII case); move to SQLite FTS if search gets slow.
  const hits = RECORD_TYPES.flatMap(({ type }) => {
    const fields = RECORD_FIELDS[type].fields.filter((f) => !['hidden', 'checkbox'].includes(f.kind))
    return rows<Rec>(`select * from ${type}`).flatMap((r): Hit[] => {
      const where = has(r.title)
        ? undefined
        : (fields.find((f) => has(r[f.name]))?.label ??
          (has(r.notes) ? 'Notes' : tagged.has(`${type}:${r.id}`) ? 'Tag' : null))
      return where === null ? [] : [{ type, id: r.id, title: r.title, where }]
    })
  })
  return hits.sort(
    (a, b) =>
      Number(!!a.where) - Number(!!b.where) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) ||
      a.id - b.id,
  )
}
