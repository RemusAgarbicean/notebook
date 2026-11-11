import { expect, test } from 'vitest'
import { loadSqlite } from './sqlite'

test('the bundled SQLite runs queries', async () => {
  const SQL = await loadSqlite()
  const db = new SQL.Database()
  expect(db.exec('select 1 + 1')[0].values).toEqual([[2]])
})
