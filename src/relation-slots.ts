import type { RecordType } from './record-types'

/**
 * The ids of the labels that slots and features rely on. Labels can be renamed,
 * so code finds them by the id they were seeded with, never by their reading.
 * These are exactly the protected labels.
 */
export const LABEL = {
  owns: 1,
  memberOf: 2,
  askAbout: 3,
  attended: 4,
  partOf: 6,
  answeredBy: 8,
} as const

export type RelationSlot = {
  /** The type whose page shows the slot. */
  type: RecordType
  /** The slot's name on the page, and its column name in a bulk import. */
  name: string
  labelId: number
  /** Which end of the Relation the slot's own Record is. */
  end: 'from' | 'to'
  /** The types the picker offers; the first one is the type a new Record gets. */
  offers: readonly RecordType[]
}

// The one place that knows the Relation slots. A slot stores nothing of its own.
export const RELATION_SLOTS: readonly RelationSlot[] = [
  { type: 'system', name: 'Owner', labelId: LABEL.owns, end: 'to', offers: ['person', 'team'] },
  { type: 'person', name: 'Team', labelId: LABEL.memberOf, end: 'from', offers: ['team'] },
  { type: 'open_question', name: 'Ask', labelId: LABEL.askAbout, end: 'to', offers: ['person'] },
  { type: 'journal_entry', name: 'Attendees', labelId: LABEL.attended, end: 'to', offers: ['person'] },
  { type: 'task', name: 'Project', labelId: LABEL.partOf, end: 'from', offers: ['project'] },
  { type: 'project', name: 'Owner', labelId: LABEL.owns, end: 'to', offers: ['person', 'team'] },
]

export const slotsOf = (type: RecordType) => RELATION_SLOTS.filter((s) => s.type === type)
