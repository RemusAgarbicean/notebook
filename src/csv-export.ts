import { RECORD_FIELDS } from './record-fields'
import { recordType, type RecordType } from './record-types'
import { listRecords, recordTags, today } from './records'
import { slotsOf } from './relation-slots'
import { slotRecords } from './relations'

// Export a type's Records as CSV: the inverse of the bulk import, with the column names it matches.

// A cell is quoted when it holds the separator, a quote, a line break, or outer spaces the import would trim.
const cell = (value: string) => (/[",\r\n]|^\s|\s$/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)

/**
 * Every Record of a type as CSV text: title, the type's fields, its Relation
 * slots (titles joined by commas), Tags and notes. Starts with a byte order
 * mark, without which Excel on Windows misreads UTF-8.
 * shortcut: a title or Tag holding a comma splits in two when imported again; the import format has no escape for it.
 */
export function exportCsv(type: RecordType): string {
  const fields = RECORD_FIELDS[type].fields.filter((f) => f.kind !== 'hidden')
  const slots = slotsOf(type)
  const table = [
    ['Title', ...fields.map((f) => f.label), ...slots.map((s) => s.name), 'Tags', 'Notes'],
    ...listRecords(type).map((r) => [
      r.title,
      ...fields.map((f) => (f.kind === 'checkbox' ? (r[f.name] ? 'yes' : 'no') : String(r[f.name] ?? ''))),
      ...slots.map((s) =>
        slotRecords(s, r.id)
          .map((o) => o.title)
          .join(', '),
      ),
      recordTags(type, r.id)
        .map((t) => t.name)
        .join(', '),
      r.notes,
    ]),
  ]
  return '﻿' + table.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** The download's name: `systems-2026-11-11.csv`. */
export const exportFileName = (type: RecordType) =>
  `${recordType(type).label.toLowerCase().replaceAll(' ', '-')}-${today()}.csv`
