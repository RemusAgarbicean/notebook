import { RECORD_FIELDS } from './record-fields'
import type { RecordType } from './record-types'
import { getRecord, recordTags } from './records'
import { slotsOf } from './relation-slots'
import { groupRelations, isProjectTask, recordRelations, slotRecords } from './relations'

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * A Record as portable markdown, for pasting into a mail or a chat: the title
 * as a heading, then its fields, Tags and Relations (by title) as a short list,
 * then its notes. Mentions stay as written.
 */
export function recordMarkdown(type: RecordType, id: number): string {
  const record = getRecord(type, id)
  if (!record) return ''
  const { singular, fields } = RECORD_FIELDS[type]
  const facts: [string, string][] = [['Type', singular]]
  for (const f of fields) {
    const value = record[f.name]
    if (f.kind === 'checkbox') facts.push([f.label, value ? 'Yes' : 'No'])
    else if (f.kind !== 'hidden' && f.kind !== 'markdown' && value) facts.push([f.label, String(value)])
  }
  const titles = (records: { title: string }[]) => records.map((r) => r.title).join(', ')
  const tags = recordTags(type, id).map((t) => t.name)
  if (tags.length) facts.push(['Tags', tags.join(', ')])
  for (const slot of slotsOf(type)) {
    const inSlot = slotRecords(slot, id)
    if (inSlot.length) facts.push([slot.name, titles(inSlot)])
  }
  for (const g of groupRelations({ type, id })) facts.push([capital(g.reading), titles(g.entries.map((e) => e.other))])

  const parts = [`# ${record.title}`, facts.map(([label, value]) => `- **${label}:** ${value}`).join('\n')]
  // A Project's Tasks are a checklist on its page, and here.
  const tasks = type === 'project' ? recordRelations({ type, id }).filter(isProjectTask) : []
  if (tasks.length)
    parts.push(
      '## Tasks',
      tasks.map((t) => `- [${getRecord('task', t.other.id)?.done ? 'x' : ' '}] ${t.other.title}`).join('\n'),
    )
  // Notes need a heading of their own only next to another text, e.g. an Open question's answer.
  const texts = fields.filter((f) => f.kind === 'markdown' && String(record[f.name] ?? '').trim())
  for (const f of texts) parts.push(`## ${f.label}`, String(record[f.name]).trim())
  if (record.notes.trim()) parts.push(...(texts.length || tasks.length ? ['## Notes'] : []), record.notes.trim())
  return parts.join('\n\n') + '\n'
}
