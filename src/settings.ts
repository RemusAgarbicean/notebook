import { db, markDirty } from './notebook'

/** Reads a value from the open Notebook's `setting` table, or null when unset. */
export const getSetting = (key: string) =>
  (db.value?.exec('select value from setting where key = ?', [key])[0]?.values[0][0] as
    | string
    | undefined) ?? null

/** Saves a value in the open Notebook's `setting` table. */
export function setSetting(key: string, value: string) {
  db.value?.run('insert or replace into setting (key, value) values (?, ?)', [key, value])
  markDirty()
}
