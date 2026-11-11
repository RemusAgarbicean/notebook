import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { getSetting, setSetting } from './settings'

// The one place that knows the note templates: the notes a Record made with "New" starts with.
// There is one per Record type, and a second one for a Journal entry of kind meeting.

/** A Record type, or `meeting` for a Journal entry of that kind. */
export type TemplateKey = RecordType | 'meeting'

export const templateKey = (type: RecordType, kind?: unknown): TemplateKey =>
  type === 'journal_entry' && kind === 'meeting' ? 'meeting' : type

/** The templates the app ships with; every other type starts with empty notes. Attendees is a slot, so a meeting has no heading for them. */
export const DEFAULT_TEMPLATES: Partial<Record<TemplateKey, string>> = {
  meeting: '## Agenda\n\n## Notes\n\n## Decisions\n\n## Actions\n\n- [ ] ',
  // A Process's steps are a numbered list in its notes.
  process: '1. ',
}

/** Every template, in sidebar order, named for the Templates dialog. */
export const TEMPLATES = RECORD_TYPES.flatMap(({ type }): { key: TemplateKey; name: string }[] =>
  type === 'journal_entry'
    ? [
        { key: type, name: 'Journal entry (log)' },
        { key: 'meeting', name: 'Journal entry (meeting)' },
      ]
    : [{ key: type, name: RECORD_FIELDS[type].singular }],
)

const defaultOf = (key: TemplateKey) => DEFAULT_TEMPLATES[key] ?? ''

/** A template as the user left it in this Notebook, else the one the app ships with. */
export const getTemplate = (key: TemplateKey): string => getSetting(`template:${key}`) ?? defaultOf(key)

/** Saves a template in the open Notebook. An empty one means the notes start empty. */
export const setTemplate = (key: TemplateKey, text: string) => setSetting(`template:${key}`, text)

export const resetTemplate = (key: TemplateKey) => setTemplate(key, defaultOf(key))

/** Whether notes hold nothing the user wrote: empty, or still exactly a template. */
export const untouched = (notes: string): boolean =>
  !notes.trim() || TEMPLATES.some((t) => getTemplate(t.key) === notes)
