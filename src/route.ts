import { RECORD_TYPES, type RecordType } from './record-types'
import type { RecordRef } from './records'

/** Where the user is: what the list column shows and the Record open beside it. */
export type Place = { list: 'home' | RecordType | { tag: number }; current: RecordRef | null }

const HOME: Place = { list: 'home', current: null }

/** The URL hash for a place: `#/`, `#/system`, `#/system/12`, `#/tag/3`, `#/tag/3/system/12`. */
export function encodePlace({ list, current }: Place): string {
  const record = current ? `/${current.type}/${current.id}` : ''
  if (typeof list === 'object') return `#/tag/${list.tag}${record}`
  if (list === 'home') return '#/'
  return record ? `#${record}` : `#/${list}`
}

const id = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : null)
const type = (s: string | undefined) => RECORD_TYPES.find((t) => t.type === s)?.type

/** The place a URL hash names. Anything it can't read is Home; an unreadable Record leaves just the list. */
export function decodePlace(hash: string): Place {
  const parts = hash.startsWith('#/') ? hash.slice(2).split('/') : []
  const tag = parts[0] === 'tag' ? id(parts[1]) : null
  const [t, n, ...rest] = tag !== null ? parts.slice(2) : parts
  const recordType = type(t)
  const recordId = id(n)
  const current = recordType && recordId !== null && !rest.length ? { type: recordType, id: recordId } : null
  if (tag !== null) return { list: { tag }, current }
  if (!recordType || rest.length) return HOME
  return { list: recordType, current }
}
