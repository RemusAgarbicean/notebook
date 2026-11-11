import { RECORD_TYPES, type RecordType } from './record-types'
import { rows, type RecordRef } from './records'

export type Found = RecordRef & { title: string }

const fold = (s: string) => s.trim().toLocaleLowerCase()

/** Whether two titles are the same ignoring case. */
export const sameTitle = (a: string, b: string) => fold(a) === fold(b)

/**
 * The Records whose title contains the text, ignoring case, by title. Only the
 * given types when `types` is passed. An empty text matches every Record.
 */
export function searchRecords(text: string, types?: readonly RecordType[]): Found[] {
  const wanted = RECORD_TYPES.filter((t) => !types || types.includes(t.type))
  if (!wanted.length) return []
  const all = rows<Found>(
    `select * from (${wanted
      .map(({ type }) => `select '${type}' as type, id, title from ${type}`)
      .join(' union all ')}) order by title collate nocase, id`,
  )
  // Matched here, not with LIKE, which only ignores case for ASCII letters.
  const needle = fold(text)
  return all.filter((r) => fold(r.title).includes(needle))
}
