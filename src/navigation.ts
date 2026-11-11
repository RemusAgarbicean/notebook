import { ref } from 'vue'
import type { RecordType } from './record-types'
import type { RecordRef } from './records'

/** What the list column shows: Home, one type's Records, or the Records with a Tag. */
export const list = ref<'home' | RecordType | { tag: number }>('home')

/** The Record open in the page column. */
export const current = ref<RecordRef | null>(null)

/** Opens a Record's page from anywhere, with its type's list beside it. */
export function openRecord(type: RecordType, id: number) {
  list.value = type
  current.value = { type, id }
}
