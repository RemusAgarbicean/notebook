import type { RecordType } from './record-types'

export type Field = {
  /** The column name. */
  name: string
  label: string
  /** `hidden` fields are saved by code and never shown as a form row (a Diagram's canvas). */
  kind: 'text' | 'url' | 'email' | 'date' | 'checkbox' | 'choice' | 'markdown' | 'hidden'
  required?: true
  /** The allowed values of a `choice`. */
  options?: readonly string[]
}

// The one place that knows each Record type's fixed fields, beyond the shared
// title and notes. Automatic columns (done_at, answered_at) are not fields.
export const RECORD_FIELDS: Record<
  RecordType,
  {
    /** The type's name for one Record, as shown on its page. */
    singular: string
    /** The field shown under the title in the list column. */
    key?: string
    fields: readonly Field[]
  }
> = {
  system: {
    singular: 'System',
    key: 'summary',
    fields: [
      { name: 'summary', label: 'Summary', kind: 'text' },
      { name: 'url', label: 'URL', kind: 'url' },
    ],
  },
  acronym: {
    singular: 'Acronym',
    key: 'expansion',
    fields: [{ name: 'expansion', label: 'Expansion', kind: 'text', required: true }],
  },
  person: {
    singular: 'Person',
    key: 'role',
    fields: [
      { name: 'role', label: 'Role', kind: 'text' },
      { name: 'email', label: 'Email', kind: 'email' },
      { name: 'go_to_for', label: 'Go to for', kind: 'text' },
    ],
  },
  team: { singular: 'Team', fields: [] },
  process: { singular: 'Process', fields: [] },
  project: {
    singular: 'Project',
    key: 'status',
    fields: [
      { name: 'status', label: 'Status', kind: 'choice', options: ['active', 'on hold', 'done'] },
      { name: 'due', label: 'Due', kind: 'date' },
      { name: 'summary', label: 'Summary', kind: 'text' },
    ],
  },
  diagram: { singular: 'Diagram', fields: [{ name: 'canvas', label: 'Canvas', kind: 'hidden' }] },
  bookmark: {
    singular: 'Bookmark',
    key: 'url',
    fields: [{ name: 'url', label: 'URL', kind: 'url', required: true }],
  },
  open_question: {
    singular: 'Open question',
    key: 'status',
    fields: [
      { name: 'status', label: 'Status', kind: 'choice', options: ['open', 'answered'] },
      { name: 'answer', label: 'Answer', kind: 'markdown' },
    ],
  },
  task: {
    singular: 'Task',
    key: 'due',
    fields: [
      { name: 'done', label: 'Done', kind: 'checkbox' },
      { name: 'due', label: 'Due', kind: 'date' },
    ],
  },
  journal_entry: {
    singular: 'Journal entry',
    key: 'date',
    fields: [
      { name: 'date', label: 'Date', kind: 'date', required: true },
      { name: 'kind', label: 'Kind', kind: 'choice', options: ['log', 'meeting'] },
    ],
  },
}
