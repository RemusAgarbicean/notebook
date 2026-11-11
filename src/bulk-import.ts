import { db, takeBackup } from './notebook'
import { RECORD_FIELDS, type Field } from './record-fields'
import { searchRecords } from './record-search'
import type { RecordType } from './record-types'
import {
  addTag,
  createRecord,
  foldTitle as fold,
  listRecords,
  sameRecord,
  sameTitle,
  today,
  transaction,
  updateRecord,
  type Patch,
} from './records'
import { slotsOf } from './relation-slots'
import { addToSlot, slotRecords } from './relations'

// Bulk import: a pasted table or CSV file becomes Records of one type.
// Reading and planning are pure; only `runImport` touches the Notebook.

// ---- Reading the table

const SEPARATORS = ['\t', ',', ';'] as const

/** The separator the first row (the column names) uses most: tab, comma or semicolon. */
export function detectSeparator(text: string): (typeof SEPARATORS)[number] {
  const header = text.split('\n', 1)[0]
  const count = (sep: string) => header.split(sep).length
  // A single column, or a tie, reads as CSV.
  return SEPARATORS.reduce((best, sep) => (count(sep) > count(best) ? sep : best), ',' as (typeof SEPARATORS)[number])
}

/**
 * Parses a pasted table or CSV into rows of trimmed cells, the first being the
 * column names. A cell in double quotes may hold separators, newlines and
 * doubled quotes. Blank rows are dropped.
 */
export function parseTable(text: string): string[][] {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const sep = detectSeparator(text)
  const table: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (row.some(Boolean)) table.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') cell += c
      else if (text[i + 1] === '"') cell += text[i++]
      else quoted = false
    } else if (c === '"' && !cell.trim()) quoted = true
    else if (c === sep) endCell()
    else if (c === '\n') endRow()
    else cell += c
  }
  endRow()
  return table
}

// ---- Matching columns

/** Where a column goes: `title`, `notes`, `tags`, a field's name, `slot:<Name>`, or `''` to ignore it. */
export type Target = string

const importFields = (type: RecordType) => RECORD_FIELDS[type].fields.filter((f) => f.kind !== 'hidden')

// Each place a column can go, with the column names that match it.
const targets = (type: RecordType): { value: Target; label: string; names: string[] }[] => [
  // A sheet of Systems often heads its first column "System".
  { value: 'title', label: 'Title', names: ['title', 'name', 'abbreviation', RECORD_FIELDS[type].singular] },
  ...importFields(type).map((f) => ({ value: f.name, label: f.label, names: [f.name, f.label] })),
  ...slotsOf(type).map((s) => ({ value: `slot:${s.name}`, label: s.name, names: [s.name] })),
  { value: 'tags', label: 'Tags', names: ['tags', 'tag'] },
  { value: 'notes', label: 'Notes', names: ['notes'] },
]

/** The choices of a column's dropdown, besides "ignore". */
export const importTargets = (type: RecordType): { value: Target; label: string }[] =>
  targets(type).map(({ value, label }) => ({ value, label }))

/** Matches each column name to a target, ignoring case, spaces and punctuation. The first column to match wins. */
export function matchColumns(type: RecordType, headers: readonly string[]): Target[] {
  const key = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const free = targets(type)
  return headers.map((h) => {
    const i = free.findIndex((t) => t.names.some((n) => key(n) === key(h)))
    return i < 0 ? '' : free.splice(i, 1)[0].value
  })
}

// ---- Values

/** Reads `YYYY-MM-DD` or `DD.MM.YYYY` as `YYYY-MM-DD`; null when it is neither or no real date. */
export function parseDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim())
  const parts = iso ? [iso[1], iso[2], iso[3]] : dotted ? [dotted[3], dotted[2], dotted[1]] : null
  if (!parts) return null
  const [y, m, d] = parts
  const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const real = new Date(`${date}T00:00:00Z`)
  return !isNaN(+real) && real.toISOString().startsWith(date) ? date : null
}

/** yes / true / x / 1 are true; an empty cell, no / false / 0 are false; anything else is null. */
export function parseTrueFalse(text: string): boolean | null {
  const v = fold(text)
  return ['yes', 'true', 'x', '1'].includes(v) ? true : ['', 'no', 'false', '0'].includes(v) ? false : null
}

// ---- Planning the rows

/** One Record the import will save, or a row it will skip. */
export type ImportRow = {
  title: string
  fields: Record<string, string | boolean>
  tags: string[]
  /** Titles per slot name. */
  slots: Record<string, string[]>
  /** Why the row can't be imported. */
  error?: string
  /** A Record of this type already has the title. */
  duplicate?: true
}

// Adds the titles or Tag names not yet in the list, ignoring case.
function addNew(list: string[], more: readonly string[]) {
  for (const m of more) if (m && !list.some((l) => fold(l) === fold(m))) list.push(m.trim())
  return list
}

/**
 * Turns the table (column names first) into the rows as they will be saved.
 * Rows with the same title are merged; rows that can't be read carry an `error`.
 */
export function planImport(
  type: RecordType,
  table: readonly string[][],
  columns: readonly Target[],
  existingTitles: readonly string[],
): ImportRow[] {
  const existing = new Set(existingTitles.map(fold))
  const fields: Field[] = [...importFields(type), { name: 'notes', label: 'Notes', kind: 'markdown' }]
  const out: ImportRow[] = []
  const byTitle = new Map<string, ImportRow>()

  for (const cells of table.slice(1)) {
    const row: ImportRow = { title: '', fields: {}, tags: [], slots: {} }
    const raw: Record<string, string> = {}
    columns.forEach((target, i) => {
      const cell = cells[i] ?? ''
      if (target === 'tags') addNew(row.tags, cell.split(','))
      else if (target.startsWith('slot:')) {
        if (cell) addNew((row.slots[target.slice(5)] ??= []), cell.split(','))
      } else if (target) raw[target] ||= cell
    })

    const errors: string[] = []
    for (const f of fields) {
      const cell = raw[f.name]
      if (f.kind === 'checkbox') {
        // Only a mapped column says anything: an empty cell is false, no column leaves the field alone.
        if (cell === undefined) continue
        const value = parseTrueFalse(cell)
        if (value === null) errors.push(`${f.label}: can't read "${cell}" as true or false`)
        else row.fields[f.name] = value
      } else if (!cell) {
        if (f.name === 'date' && type === 'journal_entry') row.fields.date = today()
        else if (f.required) errors.push(`${f.label} is required`)
      } else if (f.kind === 'date') {
        const value = parseDate(cell)
        if (value) row.fields[f.name] = value
        else errors.push(`${f.label}: can't read "${cell}" as a date`)
      } else if (f.options) {
        const value = f.options.find((o) => fold(o) === fold(cell))
        if (value) row.fields[f.name] = value
        else errors.push(`${f.label} must be one of: ${f.options.join(', ')}`)
      } else row.fields[f.name] = cell
    }
    row.title = raw.title ?? ''
    // A Journal entry names itself after its date, as `createRecord` does.
    if (!row.title && type === 'journal_entry') row.title = `${row.fields.date ?? ''} ${row.fields.kind ?? 'log'}`.trim()
    if (!row.title) errors.unshift('Title is required')

    if (errors.length) {
      out.push({ ...row, error: errors[0] })
      continue
    }
    const first = byTitle.get(fold(row.title))
    if (first) {
      // The first row's values win, except that a later "true" beats an empty cell.
      for (const [k, v] of Object.entries(row.fields)) if (!first.fields[k]) first.fields[k] = v
      addNew(first.tags, row.tags)
      for (const [slot, titles] of Object.entries(row.slots)) addNew((first.slots[slot] ??= []), titles)
      continue
    }
    if (existing.has(fold(row.title))) row.duplicate = true
    byTitle.set(fold(row.title), row)
    out.push(row)
  }
  return out
}

// ---- Saving

/** What happens to rows whose title a Record already has. */
export type DuplicateMode = 'skip' | 'fill'

/**
 * Takes a Backup, then saves the import in one transaction: all of it or
 * nothing. `fill` only fills a duplicate's empty fields and adds its slot
 * Relations and Tags; it never overwrites. Rejects without saving if the
 * Backup fails.
 */
export async function runImport(
  type: RecordType,
  table: readonly string[][],
  columns: readonly Target[],
  mode: DuplicateMode,
): Promise<{ created: number; filled: number; skipped: number }> {
  await takeBackup('import')
  if (!db.value) throw new Error('The Notebook is closed')
  // Planned after the Backup, which may have waited on a save.
  const existing = listRecords(type)
  const plan = planImport(type, table, columns, existing.map((r) => r.title))
  const result = { created: 0, filled: 0, skipped: 0 }

  // Nothing below awaits, so no save can run inside the transaction.
  transaction(() => {
    for (const row of plan) {
      if (row.error || (row.duplicate && mode === 'skip')) {
        result.skipped++
        continue
      }
      let id: number
      if (row.duplicate) {
        const old = existing.find((r) => sameTitle(r.title, row.title))!
        id = old.id
        const patch: Patch = {}
        // A false, a 0 and a chosen option are values, so only null and '' count as empty.
        for (const [k, v] of Object.entries(row.fields)) if (old[k] === null || old[k] === '') patch[k] = v
        if (Object.keys(patch).length) updateRecord(type, id, patch)
        result.filled++
      } else {
        id = createRecord(type, row.title, row.fields)
        result.created++
      }
      for (const tag of row.tags) addTag(type, id, tag)
      for (const slot of slotsOf(type)) {
        for (const title of row.slots[slot.name] ?? []) {
          const found = searchRecords(title, slot.offers).filter((r) => sameTitle(r.title, title))
          const other = slot.offers.flatMap((t) => found.filter((r) => r.type === t))[0] ?? {
            type: slot.creates ?? slot.offers[0],
            id: createRecord(slot.creates ?? slot.offers[0], title),
          }
          if (!slotRecords(slot, id).some((r) => sameRecord(r, other)))
            addToSlot(slot, id, other)
        }
      }
    }
  })
  return result
}
