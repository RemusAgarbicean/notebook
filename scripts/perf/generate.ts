// Builds large Notebooks for performance work: perf-notebooks/notebook-<n>.sqlite for each size in PERF_SIZES
// (default 2000,10000,30000). Run with `npm run perf-notebooks`. Rows go in with plain SQL, so a 30,000-Record
// Notebook takes seconds; the schema comes from the app's migrations.
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { NODE_TYPE, serialiseCanvas } from '../../src/diagram/canvas'
import { MIGRATIONS, migrate, schemaVersion } from '../../src/migrations'
import { RECORD_TYPES, type RecordType } from '../../src/record-types'
import { LABEL } from '../../src/relation-slots'
import { loadSqlite } from '../../src/sqlite'

// A seeded random source, so every run builds the same Notebook.
function random(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}

// The share of each type; Diagrams are counted apart.
const SHARE: Partial<Record<RecordType, number>> = {
  system: 0.15,
  acronym: 0.1,
  person: 0.1,
  team: 0.02,
  process: 0.05,
  project: 0.05,
  bookmark: 0.08,
  open_question: 0.05,
  task: 0.25,
  journal_entry: 0.15,
}
const WORDS =
  'supplier invoice contract approval budget forecast catalog onboarding payment ledger report dashboard pipeline vendor quarter review spend category freight warehouse audit policy request migration interface'.split(
    ' ',
  )

async function build(total: number) {
  const SQL = await loadSqlite()
  const d = new SQL.Database()
  migrate(d)
  const rnd = random(total)
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)]
  const words = (n: number) => Array.from({ length: n }, () => pick(WORDS)).join(' ')
  const day = (offset: number) => new Date(Date.UTC(2026, 0, 1) + offset * 864e5).toISOString().slice(0, 10)

  const diagrams = 5
  const counts = Object.fromEntries(
    RECORD_TYPES.map(({ type }) => [type, type === 'diagram' ? diagrams : Math.round((SHARE[type] ?? 0) * (total - diagrams))]),
  ) as Record<RecordType, number>
  const titles: { type: RecordType; id: number; title: string }[] = []
  for (const { type } of RECORD_TYPES)
    for (let id = 1; id <= counts[type]; id++)
      titles.push({
        type,
        id,
        title: type === 'acronym' ? `A${id.toString(36).toUpperCase()}` : `${type.replace('_', ' ')} ${id} ${words(2)}`,
      })
  const byType = (type: RecordType) => titles.filter((t) => t.type === type)

  // A few hundred characters of text, with a Mention in about half of them.
  const notes = () => {
    const parts = [`${words(12)}.`, `- ${words(6)}\n- ${words(5)}`, `${words(20)}.`]
    for (let m = Math.floor(rnd() * 3) - 1; m > 0; m--) parts.push(`See [[${pick(titles).title}]].`)
    if (rnd() < 0.5) parts.push(`Ask [[${pick(titles).title}]] about ${words(3)}.`)
    return parts.join('\n\n')
  }

  d.run('begin')
  const stamp = (i: number) => new Date(Date.UTC(2025, 0, 1) + i * 6e4).toISOString()
  let n = 0
  for (const { type, id, title } of titles) {
    const t = stamp(n++)
    const extra: Record<string, string | number | null> = {
      system: { summary: words(4), url: `https://example.invalid/${id}` },
      acronym: { expansion: words(3) },
      person: { role: words(2), email: `p${id}@example.invalid`, go_to_for: words(3) },
      project: { status: pick(['active', 'active', 'on hold', 'done']), due: rnd() < 0.5 ? day(Math.floor(rnd() * 400)) : null, summary: words(5) },
      bookmark: { url: `https://example.invalid/b/${id}` },
      open_question: rnd() < 0.5 ? { status: 'open' } : { status: 'answered', answer: notes(), answered_at: t },
      task: rnd() < 0.4 ? { done: 1, done_at: t } : { done: 0, due: rnd() < 0.6 ? day(Math.floor(rnd() * 400)) : null },
      journal_entry: { date: day(Math.floor(rnd() * 400)), kind: pick(['log', 'meeting']) },
    }[type as string] ?? {}
    // A few Records miss a required field, as real ones do.
    if (type === 'acronym' && rnd() < 0.02) extra.expansion = ''
    const columns = { id, title, notes: notes(), created_at: t, updated_at: t, ...extra }
    d.run(
      `insert into ${type} (${Object.keys(columns).join(', ')}) values (${Object.keys(columns).map(() => '?').join(', ')})`,
      Object.values(columns),
    )
  }

  // Tags: 60 names, up to three per Record on about a third of them.
  for (let i = 1; i <= 60; i++) d.run('insert into tag (id, name) values (?, ?)', [i, `${pick(WORDS)}-${i}`])
  for (const { type, id } of titles)
    if (rnd() < 0.33)
      for (let k = Math.ceil(rnd() * 3); k > 0; k--)
        d.run('insert or ignore into record_tag (tag_id, type, id) values (?, ?, ?)', [1 + Math.floor(rnd() * 60), type, id])

  // Relations: the slots (owner, team, project of a Task, attendees) plus some free ones.
  const relate = (from: { type: string; id: number }, label: number, to: { type: string; id: number }) =>
    d.run('insert or ignore into relation (from_type, from_id, label_id, to_type, to_id) values (?, ?, ?, ?, ?)', [
      from.type,
      from.id,
      label,
      to.type,
      to.id,
    ])
  const people = byType('person')
  const teams = byType('team')
  const projects = byType('project')
  for (const s of byType('system')) relate(pick(rnd() < 0.5 ? people : teams), LABEL.owns, s)
  for (const p of people) relate(p, LABEL.memberOf, pick(teams))
  for (const t of byType('task')) if (rnd() < 0.6) relate(t, LABEL.partOf, pick(projects))
  for (const j of byType('journal_entry')) if (rnd() < 0.3) relate(pick(people), LABEL.attended, j)
  for (let i = 0; i < total / 5; i++) {
    const [a, b] = [pick(titles), pick(titles)]
    if (a !== b) relate(a, pick([5, 7]), b)
  }

  // Diagrams of 50 to 200 Nodes, about half linked to Records.
  for (let id = 1; id <= diagrams; id++) {
    const size = [50, 100, 150, 200, 200][id - 1]
    const nodes = Array.from({ length: size }, (_, i) => {
      const linked = rnd() < 0.5 ? pick(titles) : null
      return {
        id: String(i + 1),
        type: NODE_TYPE,
        position: { x: (i % 20) * 200, y: Math.floor(i / 20) * 120 },
        data: linked ? { label: linked.title, recordType: linked.type, recordId: linked.id } : { label: words(2) },
      }
    })
    const edges = Array.from({ length: size }, (_, i) => ({
      id: String(i + 1),
      source: String(1 + Math.floor(rnd() * size)),
      target: String(1 + Math.floor(rnd() * size)),
    }))
    const canvas = serialiseCanvas({ nodes, edges, viewport: { x: 0, y: 0, zoom: 0.5 } } as never)
    d.run('update diagram set title = ?, canvas = ? where id = ?', [`Landscape ${id} (${size} Nodes)`, canvas, id])
  }
  d.run('commit')
  return d
}

test('builds the performance Notebooks', async () => {
  const sizes = (process.env.PERF_SIZES ?? '2000,10000,30000').split(',').map(Number)
  mkdirSync('perf-notebooks', { recursive: true })
  for (const size of sizes) {
    const d = await build(size)
    expect(schemaVersion(d)).toBe(MIGRATIONS.length)
    const total = RECORD_TYPES.reduce((sum, { type }) => sum + (d.exec(`select count(*) from ${type}`)[0].values[0][0] as number), 0)
    expect(Math.abs(total - size)).toBeLessThan(10)
    writeFileSync(`perf-notebooks/notebook-${size}.sqlite`, d.export())
  }
}, 300_000)
