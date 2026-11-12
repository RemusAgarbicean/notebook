import { db } from './notebook'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { byTitle, foldTitle, revision, rows, textRevision, textVersion, titlesVersion, type Rec, type RecordRef, type Titled } from './records'

/** A search result. `where` names what matched when it was not the title. */
export type Hit = Titled & { where?: string }

// Each Record as search reads it: its texts folded once, in the order a match is named.
type Entry = Titled & { updated: string; folded: string; texts: [where: string, folded: string][] }

const fieldsOf = (type: RecordType) => RECORD_FIELDS[type].fields.filter((f) => !['hidden', 'checkbox'].includes(f.kind))

function entry(type: RecordType, r: Rec): Entry {
  const texts = fieldsOf(type).map((f): [string, string] => [f.label, foldTitle(String(r[f.name] ?? ''))])
  return { type, id: r.id, title: r.title, updated: r.updated_at, folded: foldTitle(r.title), texts: [...texts, ['Notes', foldTitle(r.notes)]] }
}

// The folded Records, brought up to date after a write by re-reading only the rows whose updated_at moved.
// shortcut: two edits of one Record within the same millisecond, with a search in between, leave the second unseen until another edit; key on a per-Record counter if that ever matters.
// `sorted` is the entries by title, kept until one comes, goes or is renamed: typing in the box then needs no sort.
type Cache = {
  db: unknown
  titles: number
  revision: number
  text: number
  entries: Map<string, Entry>
  sorted?: string[]
  tags: Map<string, string[]>
}
let cache: Cache | undefined

function sync(): Cache {
  void textRevision.value // a computed searching re-runs after every write, text included
  const fresh = cache?.db !== db.value || cache.titles !== titlesVersion()
  // A rename rewrites other Records' Mentions without touching their updated_at: read everything again.
  const c: Cache = fresh
    ? (cache = { db: db.value, titles: titlesVersion(), revision: -1, text: -1, entries: new Map(), tags: new Map() })
    : cache!
  if (c.revision === revision.value && c.text === textVersion()) return c
  const seen = new Set<string>()
  for (const { type } of RECORD_TYPES) {
    const stale = rows<{ id: number; updated_at: string }>(`select id, updated_at from ${type}`).filter((r) => {
      const key = `${type}:${r.id}`
      seen.add(key)
      return c.entries.get(key)?.updated !== r.updated_at
    })
    const reread =
      stale.length > 500 ? rows<Rec>(`select * from ${type}`) : stale.length ? rows<Rec>(`select * from ${type} where id in (${stale.map((r) => r.id).join(',')})`) : []
    for (const r of reread) {
      const key = `${type}:${r.id}`
      if (c.entries.get(key)?.title !== r.title) c.sorted = undefined
      c.entries.set(key, entry(type, r))
    }
  }
  for (const key of c.entries.keys())
    if (!seen.has(key)) {
      c.entries.delete(key)
      c.sorted = undefined
    }
  if (c.revision !== revision.value) {
    c.tags = new Map()
    for (const t of rows<RecordRef & { name: string }>('select rt.type, rt.id, t.name from record_tag rt join tag t on t.id = rt.tag_id'))
      c.tags.set(`${t.type}:${t.id}`, [...(c.tags.get(`${t.type}:${t.id}`) ?? []), foldTitle(t.name)])
  }
  c.revision = revision.value
  c.text = textVersion()
  return c
}

/**
 * The Records whose title, fields, notes or Tags contain the text, ignoring
 * case: title matches first, then the rest, each by title. Empty text finds nothing.
 */
export function globalSearch(text: string): Hit[] {
  const needle = foldTitle(text)
  if (!needle) return []
  const c = sync()
  c.sorted ??= [...c.entries.keys()].sort((a, b) => byTitle(c.entries.get(a)!, c.entries.get(b)!))
  // Title matches first, then the rest, each already in title order.
  const [titles, others]: Hit[][] = [[], []]
  for (const key of c.sorted) {
    const e = c.entries.get(key)!
    if (e.folded.includes(needle)) titles.push({ type: e.type, id: e.id, title: e.title, where: undefined })
    else {
      const where = e.texts.find(([, folded]) => folded.includes(needle))?.[0] ?? (c.tags.get(key)?.some((name) => name.includes(needle)) ? 'Tag' : null)
      if (where !== null) others.push({ type: e.type, id: e.id, title: e.title, where })
    }
  }
  return [...titles, ...others]
}
