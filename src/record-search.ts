import type { RecordType } from './record-types'
import { byTitle, foldTitle, recordTitles, type Titled } from './records'

/**
 * The Records whose title contains the text, ignoring case, by title. Only the
 * given types when `types` is passed. An empty text matches every Record.
 */
export function searchRecords(text: string, types?: readonly RecordType[]): Titled[] {
  const needle = foldTitle(text)
  return recordTitles()
    .filter((r) => (!types || types.includes(r.type)) && foldTitle(r.title).includes(needle))
    .sort(byTitle)
}
