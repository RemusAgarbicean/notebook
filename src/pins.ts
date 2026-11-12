import { db } from './notebook'
import { byTitle, changed, recordTitles, rows, sameRecord, type RecordRef, type Titled } from './records'

// Pinned Records: kept as a JSON list of "type:id" in the `setting` table, so they travel with the Notebook.
const KEY = 'pinned'
const key = (r: RecordRef) => `${r.type}:${r.id}`

function stored(): string[] {
  try {
    const list: unknown = JSON.parse(rows<{ value: string }>('select value from setting where key = ?', [KEY])[0]?.value ?? '[]')
    return Array.isArray(list) ? list.map(String) : []
  } catch {
    return []
  }
}

/** The pinned Records that still exist, by title. Reactive. */
export function pinnedRecords(): Titled[] {
  const pins = new Set(stored())
  return pins.size ? recordTitles().filter((r) => pins.has(key(r))).sort(byTitle) : []
}

export const isPinned = (record: RecordRef) => pinnedRecords().some((r) => sameRecord(r, record))

/** Pins or unpins a Record. */
export function setPinned(record: RecordRef, on: boolean) {
  const before = stored()
  const after = before.filter((k) => k !== key(record))
  if (on) after.push(key(record))
  if (after.length === before.length && on === before.includes(key(record))) return
  db.value!.run('insert or replace into setting (key, value) values (?, ?)', [KEY, JSON.stringify(after)])
  changed('keep-titles')
}
