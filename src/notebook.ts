import type { Database } from 'sql.js'
import { shallowRef } from 'vue'
import { migrate } from './migrations'
import { saveStatus } from './save-status'
import { loadSqlite } from './sqlite'
import type { NotebookFolder } from './storage'

/** The open Notebook's database, or null on the start screen. */
export const db = shallowRef<Database | null>(null)

let folder: NotebookFolder | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let queue = Promise.resolve()

/**
 * Opens the Notebook in `target`, upgrading its schema if needed. Returns
 * false when there is no notebook.sqlite, unless `create` asks for a new one.
 * An existing file is never replaced by an empty one.
 */
export async function openNotebook(target: NotebookFolder, create = false): Promise<boolean> {
  const bytes = await target.read()
  if (!bytes && !create) return false
  const SQL = await loadSqlite()
  const opened = new SQL.Database(bytes)
  if (migrate(opened) || !bytes) await target.write(opened.export())
  clearTimeout(timer)
  folder = target
  db.value = opened
  saveStatus.value = 'saved'
  return true
}

/** Call after every change to the database: it is saved 1 s after the last call. */
export function markDirty() {
  saveStatus.value = 'unsaved'
  clearTimeout(timer)
  timer = setTimeout(saveNow, 1000)
}

/** Writes unsaved changes now. Never rejects: a failed save leaves the status at 'unsaved'. */
export function saveNow(): Promise<void> {
  clearTimeout(timer)
  // Queued so two saves never write the file at the same time.
  return (queue = queue.then(async () => {
    if (!db.value || !folder || saveStatus.value !== 'unsaved') return
    saveStatus.value = 'saving'
    try {
      // export() frees prepared statements and resets pragmas such as foreign_keys.
      await folder.write(db.value.export())
      // An edit made during the write has already set the status back to 'unsaved'.
      if (saveStatus.value === 'saving') saveStatus.value = 'saved'
    } catch {
      saveStatus.value = 'unsaved'
    }
  }))
}

window.addEventListener('pagehide', saveNow)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow()
})
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    saveNow()
  }
})
