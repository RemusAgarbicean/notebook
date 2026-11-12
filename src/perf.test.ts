// Guards the hot paths of a large Notebook. Counts recomputations and rows read rather than
// timing them, so a regression to "everything reruns" or "a full scan per row" fails without flaky clocks.
import type { Database } from 'sql.js'
import { beforeEach, expect, test } from 'vitest'
import { computed } from 'vue'
import { matchColumns, parseTable, runImport } from './bulk-import'
import { globalSearch } from './global-search'
import { mentionedIn } from './mentions'
import { migrate } from './migrations'
import { db } from './notebook'
import { RECORD_TYPES } from './record-types'
import { createRecord, getRecord, incompleteRecords, listRecords, listTags, recordCounts, recordTitles, transaction, updateRecord } from './records'
import { loadSqlite } from './sqlite'

const PER_TYPE = 300 // 3,300 Records

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
  transaction(() => {
    for (const { type } of RECORD_TYPES)
      for (let i = 1; i <= PER_TYPE; i++)
        createRecord(type, `${type} ${i}`, {
          notes: `Some words about ${type} ${i}. See [[system ${1 + ((i * 7) % PER_TYPE)}]] and [[person ${i}]].`,
          ...(type === 'acronym' && { expansion: `expansion ${i}` }),
          ...(type === 'bookmark' && { url: `https://example.invalid/${i}` }),
        })
  })
})

/** Counts the rows SQLite hands back while `work` runs. */
async function rowsRead(work: () => unknown): Promise<number> {
  const d = db.value as Database
  const exec = d.exec.bind(d)
  let read = 0
  d.exec = (sql, params) => {
    const out = exec(sql, params)
    read += out.reduce((n, r) => n + r.values.length, 0)
    return out
  }
  try {
    await work()
  } finally {
    d.exec = exec
  }
  return read
}

/** How often each computed reran after `work`. */
function reruns(readers: Record<string, () => unknown>, work: () => void): Record<string, number> {
  const runs = Object.fromEntries(Object.keys(readers).map((k) => [k, 0]))
  const cs = Object.entries(readers).map(([k, read]) => computed(() => (runs[k]++, read())))
  for (const c of cs) void c.value
  for (const k of Object.keys(runs)) runs[k] = 0
  work()
  for (const c of cs) void c.value
  return runs
}

test('typing in notes refreshes the page but not the lists, counts, Tags, titles or Mentioned in', () => {
  const runs = reruns(
    {
      page: () => getRecord('system', 1),
      list: () => listRecords('system'),
      counts: () => recordCounts(),
      tags: () => listTags(),
      titles: () => recordTitles(),
      incomplete: () => incompleteRecords(),
      mentionedIn: () => mentionedIn({ type: 'system', id: 1 }),
    },
    () => {
      for (const c of 'hello') updateRecord('system', 1, { notes: `${getRecord('system', 1)!.notes}${c}` })
    },
  )
  expect(runs).toEqual({ page: 1, list: 0, counts: 0, tags: 0, titles: 0, incomplete: 0, mentionedIn: 0 })
})

test('a notes edit is still read back, and a field edit still refreshes the lists', () => {
  updateRecord('system', 1, { notes: 'changed' })
  expect(getRecord('system', 1)!.notes).toBe('changed')
  expect(globalSearch('changed').map((h) => h.id)).toEqual([1])
  const runs = reruns({ list: () => listRecords('system') }, () => updateRecord('system', 1, { summary: 'x' }))
  expect(runs.list).toBe(1)
})

test('Mentioned in reads each text once, not once per title', async () => {
  let found: unknown[] = []
  const read = await rowsRead(() => (found = mentionedIn({ type: 'system', id: 8 })))
  // 3,300 notes all hold Mentions; a lookup per title would read millions.
  expect(read).toBeLessThan(4 * 3300)
  expect(found.length).toBeGreaterThan(0)
})

test('importing 1,000 rows reads the Notebook a bounded number of times, not once per row', async () => {
  const csv = ['Title,Owner,Notes', ...Array.from({ length: 1000 }, (_, i) => `New ${i},Team ${i % 20},"See [[New ${i ? i - 1 : 999}]]"`)].join('\n')
  const table = parseTable(csv)
  let result
  const read = await rowsRead(async () => (result = await runImport('system', table, matchColumns('system', table[0]), 'skip')))
  expect(result).toEqual({ created: 1000, filled: 0, skipped: 0 })
  // Re-reading every title per row would be 1,000 × 3,300.
  expect(read).toBeLessThan(100_000)
})

test('a palette search after an edit re-reads only what changed', async () => {
  globalSearch('words')
  updateRecord('task', 5, { notes: 'needle in task five' })
  let hits: unknown[] = []
  const read = await rowsRead(() => (hits = globalSearch('needle')))
  expect(hits).toMatchObject([{ type: 'task', id: 5, where: 'Notes' }])
  expect(read).toBeLessThan(3300 + 100)
  // Typing on in the box reads nothing new.
  expect(await rowsRead(() => globalSearch('needle i'))).toBe(0)
})
