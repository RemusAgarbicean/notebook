import { markdown } from './markdown'
import { openRecord } from './navigation'
import { db } from './notebook'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { foldTitle, recordTitles, revision, rows, sameRecord, sameTitle, textVersion, titled, type RecordRef, type Titled } from './records'

// What sits between the brackets: `Title` or `Type: Title`. A title holding `[` or `]` can't be mentioned.
const MENTION = /\[\[([^[\]\n]+)\]\]/g

const singular = (type: RecordType) => RECORD_FIELDS[type].singular

/** The text inside each `[[...]]` of a text. */
export const findMentions = (text: string): string[] => [...text.matchAll(MENTION)].map((m) => m[1].trim())

/**
 * The Records a Mention's inner text matches, ignoring case: more than one when
 * the title is ambiguous. A link goes to the first. `Type: Title` narrows to one type.
 */
export function resolveMention(inner: string): Titled[] {
  const colon = inner.indexOf(':')
  const type = RECORD_TYPES.find((t) => sameTitle(singular(t.type), inner.slice(0, Math.max(colon, 0))))?.type
  const typed = type ? titled(inner.slice(colon + 1)).filter((t) => t.type === type) : []
  // No typed match: the colon may just be part of a title.
  return typed.length ? typed : [...titled(inner)]
}

const write = (type: RecordType | null, title: string) => `[[${type ? `${singular(type)}: ` : ''}${title}]]`

/** The Mention to insert for a Record: `[[Type: Title]]` only when another Record shares the title. */
export const mentionFor = (record: Titled): string =>
  write(titled(record.title).some((t) => !sameRecord(t, record)) ? record.type : null, record.title)

/** Autocomplete: the Records whose title contains what was typed after `[[`. */
export function suggestMentions(query: string): Titled[] {
  const q = foldTitle(query)
  return recordTitles()
    .filter((t) => foldTitle(`${singular(t.type)}: ${t.title}`).includes(q))
    .slice(0, 8)
}

// A text as it must read once `target` (null: a Record about to be created) takes `newTitle`.
function rewrite(text: string, target: RecordRef | null, newTitle: string): string {
  const ambiguous = titled(newTitle).some((t) => !(target && sameRecord(t, target)))
  return text.replace(MENTION, (whole, inner: string) => {
    const hit = resolveMention(inner)[0]
    if (!hit) return whole
    // A Mention of the Record follows it to the new title; one written with its type keeps it.
    if (target && sameRecord(hit, target))
      return write(ambiguous || !sameTitle(inner, hit.title) ? target.type : null, newTitle)
    // A bare Mention of another Record that has the title gets its type, so it keeps pointing there.
    // shortcut: two Records of one type sharing a title can't be told apart by a Mention; needs ids in Mentions.
    return sameTitle(inner, newTitle) ? write(hit.type, hit.title) : whole
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

// Returns whether any text changed.
function retitle(target: RecordRef | null, newTitle: string): boolean {
  let rewrote = false
  for (const { type, id, column, text } of mentionTexts()) {
    const next = rewrite(text, target, newTitle)
    if (next === text) continue
    db.value!.run(`update ${type} set ${column} = ? where id = ?`, [next, id])
    rewrote = true
  }
  return rewrote
}

/**
 * Rewrites every Mention of a Record that is about to be renamed, and gives
 * bare Mentions of other Records that already have the new title their type.
 * Call it before the title changes, inside the caller's transaction (`updateRecord` does).
 */
export const renameMentions = (target: RecordRef, newTitle: string) => void retitle(target, newTitle)

/**
 * Gives bare Mentions of Records that have this title their type, so a Record
 * about to be created with it can't take them over. Call it before the insert,
 * inside the caller's transaction (`createRecord` does). Returns whether it rewrote any text.
 */
export function keepMentions(title: string): boolean {
  // Most new titles are unique: skip reading every note then.
  return titled(title).length > 0 && retitle(null, title)
}

// For each mentioned Record, the Records whose text mentions it. Built from every text at once and
// kept until the next write, so opening pages reads the notes once, not once per page.
let mentions: { db: unknown; revision: number; text: number; to: Map<string, Titled[]> } | undefined

/** The other Records whose notes or answer Mention this one. Reactive, but not on text edits: a Record's own text never changes what it is mentioned in. */
export function mentionedIn(target: RecordRef): Titled[] {
  if (mentions?.db !== db.value || mentions.revision !== revision.value || mentions.text !== textVersion()) {
    const to = new Map<string, Titled[]>()
    for (const { type, id, title, text } of mentionTexts()) {
      const from = { type, id, title }
      for (const m of new Set(findMentions(text))) {
        const hit = resolveMention(m)[0]
        if (!hit || sameRecord(hit, from)) continue
        const key = `${hit.type}:${hit.id}`
        const list = to.get(key) ?? []
        // A Record with both notes and an answer mentioning the target is listed once.
        if (!list.some((r) => sameRecord(r, from))) to.set(key, [...list, from])
      }
    }
    mentions = { db: db.value, revision: revision.value, text: textVersion(), to }
  }
  return mentions.to.get(`${target.type}:${target.id}`) ?? []
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
