import { markdown } from './markdown'
import { openRecord } from './navigation'
import { db } from './notebook'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { foldTitle, recordTitles, rows, sameRecord, sameTitle, type RecordRef, type Titled } from './records'

// What sits between the brackets: `Title` or `Type: Title`. A title holding `[` or `]` can't be mentioned.
const MENTION = /\[\[([^[\]\n]+)\]\]/g

const singular = (type: RecordType) => RECORD_FIELDS[type].singular

/** The text inside each `[[...]]` of a text. */
export const findMentions = (text: string): string[] => [...text.matchAll(MENTION)].map((m) => m[1].trim())

/**
 * The Records a Mention's inner text matches, ignoring case: more than one when
 * the title is ambiguous. A link goes to the first. `Type: Title` narrows to one type.
 */
export function resolveMention(inner: string, titles = recordTitles()): Titled[] {
  const colon = inner.indexOf(':')
  const type = RECORD_TYPES.find((t) => sameTitle(singular(t.type), inner.slice(0, Math.max(colon, 0))))?.type
  const typed = type ? titles.filter((t) => t.type === type && sameTitle(t.title, inner.slice(colon + 1))) : []
  // No typed match: the colon may just be part of a title.
  return typed.length ? typed : titles.filter((t) => sameTitle(t.title, inner))
}

const write = (type: RecordType | null, title: string) => `[[${type ? `${singular(type)}: ` : ''}${title}]]`

/** The Mention to insert for a Record: `[[Type: Title]]` only when another Record shares the title. */
export const mentionFor = (record: Titled, titles = recordTitles()): string =>
  write(titles.some((t) => !sameRecord(t, record) && sameTitle(t.title, record.title)) ? record.type : null, record.title)

/** Autocomplete: the Records whose title contains what was typed after `[[`. */
export function suggestMentions(query: string): Titled[] {
  const q = foldTitle(query)
  return recordTitles()
    .filter((t) => foldTitle(`${singular(t.type)}: ${t.title}`).includes(q))
    .slice(0, 8)
}

// A text with its Mentions of `target` pointed at its new title.
function rewrite(text: string, target: RecordRef, newTitle: string, titles: Titled[]): string {
  const ambiguous = titles.some((t) => !sameRecord(t, target) && sameTitle(t.title, newTitle))
  return text.replace(MENTION, (whole, inner: string) => {
    const hit = resolveMention(inner, titles)[0]
    if (!hit || !sameRecord(hit, target)) return whole
    // A Mention written with its type keeps it.
    return write(ambiguous || !sameTitle(inner, hit.title) ? target.type : null, newTitle)
  })
}

// Every markdown text that holds a Mention: all notes, and an Open question's answer.
const mentionTexts = () =>
  RECORD_TYPES.flatMap(({ type }) =>
    ['notes', ...RECORD_FIELDS[type].fields.filter((f) => f.kind === 'markdown').map((f) => f.name)].flatMap(
      (column) =>
        rows<{ id: number; title: string; text: string }>(
          `select id, title, ${column} as text from ${type} where ${column} like '%[[%' order by id`,
        ).map((row) => ({ ...row, type, column })),
    ),
  )

/**
 * Rewrites every Mention of a Record that is about to be renamed. Call it before
 * the title changes, inside the caller's transaction (`updateRecord` does).
 */
export function renameMentions(target: RecordRef, newTitle: string) {
  const titles = recordTitles()
  for (const { type, id, column, text } of mentionTexts()) {
    const next = rewrite(text, target, newTitle, titles)
    if (next !== text) db.value!.run(`update ${type} set ${column} = ? where id = ?`, [next, id])
  }
}

/** Call before a Record is created with this title, inside the caller's transaction. */
export function keepMentions(_title: string) {}

/** The other Records whose notes or answer Mention this one. */
export function mentionedIn(target: RecordRef): Titled[] {
  const titles = recordTitles()
  const found = new Map<string, Titled>()
  for (const { type, id, title, text } of mentionTexts())
    if (!sameRecord({ type, id }, target) && findMentions(text).some((m) => sameRecord(resolveMention(m, titles)[0] ?? { type, id }, target)))
      found.set(`${type}:${id}`, { type, id, title })
  return [...found.values()]
}

/** Click handler for rendered markdown: opens the Record of a clicked Mention. */
export function openMention(e: MouseEvent) {
  const [type, id] = (e.target as Element).closest?.('[data-mention]')?.getAttribute('data-mention')?.split(':') ?? []
  if (!type) return
  e.preventDefault()
  openRecord(type as RecordType, Number(id))
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

markdown.use({
  extensions: [
    {
      name: 'mention',
      level: 'inline',
      start: (src) => src.indexOf('[['),
      tokenizer(src) {
        const m = /^\[\[([^[\]\n]+)\]\]/.exec(src)
        if (m) return { type: 'mention', raw: m[0], text: m[1].trim() }
      },
      renderer({ text }) {
        const hit = resolveMention(text)[0]
        return hit
          ? `<a href="#" class="mention" data-mention="${hit.type}:${hit.id}">${escape(text)}</a>`
          : `<span class="mention-broken" title="No Record has this title">${escape(text)}</span>`
      },
    },
  ],
})
