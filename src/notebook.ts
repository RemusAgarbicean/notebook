import type { Database } from 'sql.js'
import { ref, shallowRef } from 'vue'
import { dailyBackup, describeBackup, writeBackup, type BackupInfo } from './backups'
import { MIGRATIONS, migrate, schemaVersion } from './migrations'
import { downloadedAt, manualSave, saveStatus } from './save-status'
import { loadSqlite } from './sqlite'
import type { NotebookFolder } from './storage'

/** The open Notebook's database, or null on the start screen. */
export const db = shallowRef<Database | null>(null)

/**
 * Why edits are not reaching the disk: the last write 'failed', or the file was
 * 'changed' outside the app and autosave is stopped until the user chooses
 * reloadFromDisk() or overwriteDisk().
 */
export const saveProblem = ref<null | 'failed' | 'changed'>(null)

let folder: NotebookFolder | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let queue = Promise.resolve()
// Saves, Backups and restores run one after the other, so two never write the file at the same time.
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job)
  queue = run.then(
    () => {},
    () => {},
  )
  return run
}
// The file's lastModified as of our last load or save.
let knownModified: number | null = null

// The database in `bytes` (a new one for null). `name` is the file or folder the user knows it by.
async function parse(bytes: Uint8Array | null, name: string) {
  const opened = new (await loadSqlite()).Database(bytes)
  try {
    schemaVersion(opened) // SQLite only looks at the bytes on the first read
  } catch {
    throw new Error(`"${name}" is not a Notebook: the file is not a SQLite database.`)
  }
  return opened
}

/**
 * Opens the Notebook in `target`, upgrading its schema if needed. Returns
 * false when there is no notebook.sqlite, unless `create` asks for a new one.
 * An existing file is never replaced by an empty one.
 */
export async function openNotebook(target: NotebookFolder, create = false): Promise<boolean> {
  // Read before the bytes: a change in between then shows as a conflict instead of being missed.
  let modified = await target.lastModified()
  const bytes = await target.read()
  if (!bytes && !create) return false
  const opened = await parse(bytes, target.name)
  // A manual folder is never written unasked: the opened file stays as it was, which is its own Backup.
  if (!target.manual && bytes && schemaVersion(opened) < MIGRATIONS.length)
    await writeBackup(target, 'pre-upgrade')
  if ((migrate(opened) || !bytes) && !target.manual) {
    await target.write(opened.export())
    modified = await target.lastModified()
  }
  clearTimeout(timer)
  folder = target
  knownModified = modified
  db.value = opened
  manualSave.value = !!target.manual
  downloadedAt.value = null
  saveStatus.value = 'saved'
  saveProblem.value = null
  return true
}

/** Closes the open Notebook without saving, back to the start screen. */
export function closeNotebook() {
  clearTimeout(timer)
  folder = null
  db.value = null
  manualSave.value = false
  downloadedAt.value = null
  saveStatus.value = 'saved'
  saveProblem.value = null
}

/** Call after every change to the database: it is saved 1 s after the last call. */
export function markDirty() {
  saveStatus.value = 'unsaved'
  clearTimeout(timer)
  timer = setTimeout(saveNow, 1000)
}

/**
 * Writes unsaved changes now. Never rejects: a failed save leaves the status
 * at 'unsaved' and sets saveProblem. Does nothing while saveProblem is 'changed'.
 * A Notebook saved by download is only saved when the user `asked`, and then
 * even with nothing new, so a lost download can be had again.
 */
export function saveNow(asked = false): Promise<void> {
  clearTimeout(timer)
  return enqueue(() => save(asked))
}

async function save(asked: boolean) {
  if (!db.value || !folder || saveProblem.value === 'changed') return
  if (folder.manual ? !asked : saveStatus.value !== 'unsaved') return
  saveStatus.value = 'saving'
  try {
    const onDisk = await folder.lastModified()
    // A file that is gone is simply written again.
    if (onDisk !== null && onDisk !== knownModified) {
      saveProblem.value = 'changed'
      saveStatus.value = 'unsaved'
      return
    }
    if (!folder.manual) await dailyBackup(folder)
    // export() frees prepared statements and resets pragmas such as foreign_keys.
    await folder.write(db.value.export())
    knownModified = await folder.lastModified()
    saveProblem.value = null
    if (folder.manual) downloadedAt.value = new Date().toTimeString().slice(0, 5)
    // An edit made during the write has already set the status back to 'unsaved'.
    if (saveStatus.value === 'saving') saveStatus.value = 'saved'
  } catch {
    saveStatus.value = 'unsaved'
    saveProblem.value = 'failed'
  }
}

/**
 * Saves, then writes the Notebook as it is in the app to backups/ as
 * `notebook-YYYY-MM-DD-HHMMSS-<reason>.sqlite` (reason e.g. 'import').
 * What is in the app, not the file: that is what an import or a restore is
 * about to replace, also when notebook.sqlite was moved or deleted meanwhile.
 * Rejects when the save did not reach the disk or the Backup cannot be written.
 */
export const takeBackup = (reason: string): Promise<void> => enqueue(() => backUp(reason))

async function backUp(reason: string) {
  if (!folder || !db.value) return
  // Without backups/ nothing is written unasked: the Backup is a download of the Notebook as it is now.
  if (!folder.manual) {
    clearTimeout(timer)
    await save(false)
    if (saveProblem.value)
      throw new Error('The Notebook could not be saved, so no Backup was taken. Fix the save problem first.')
  }
  await writeBackup(folder, reason, db.value.export())
}

/** A file in backups/, with what its name says about it. */
export type BackupFile = BackupInfo & { name: string; size: number }

/** The open Notebook's Backups, newest first. Empty for a Notebook saved by download. */
export async function listBackups(): Promise<BackupFile[]> {
  if (!folder) return []
  const list: BackupFile[] = []
  for (const name of await folder.listBackups()) {
    const info = describeBackup(name)
    // shortcut: reads each Backup just for its size (at most 28 small files); add a size call to NotebookFolder if Notebooks grow large.
    if (info) list.push({ name, ...info, size: (await folder.readBackup(name))?.length ?? 0 })
  }
  // A daily Backup has no time: it holds the day's starting state, so it sorts as the day's oldest.
  const age = (b: BackupFile) => `${b.date} ${b.time ?? ''}`
  return list.sort((a, b) => age(b).localeCompare(age(a)))
}

/**
 * Replaces the open Notebook with a Backup, after backing up the current state
 * (reason 'restore'). Rejects, with nothing changed, when the Backup is gone,
 * is not a Notebook, was saved by a newer app or the current state cannot be
 * backed up. An older Backup is upgraded on the way in.
 */
export const restoreBackup = (fileName: string): Promise<void> => enqueue(() => restore(fileName))

async function restore(fileName: string) {
  const target = folder
  if (!target) return
  const bytes = await target.readBackup(fileName)
  if (!bytes) throw new Error(`"${fileName}" is no longer in the folder's backups.`)
  const restored = await parse(bytes, fileName)
  // Before anything is touched. migrate() says "This Notebook": here it is the Backup that is newer.
  if (schemaVersion(restored) > MIGRATIONS.length)
    throw new Error("This Backup was saved by a newer version of the app, so this one can't restore it. Use the newer notebook.html.")
  migrate(restored)
  await backUp('restore')
  await target.write(restored.export())
  await openNotebook(target)
}

/** Answers saveProblem 'changed': drops unsaved edits and loads the file as it is on disk. */
export async function reloadFromDisk(): Promise<void> {
  if (folder) await openNotebook(folder)
}

/** Answers saveProblem 'changed': replaces the file on disk with what is in the app. */
export async function overwriteDisk(): Promise<void> {
  if (!folder) return
  knownModified = await folder.lastModified()
  saveProblem.value = null
  saveStatus.value = 'unsaved'
  await saveNow()
}

window.addEventListener('pagehide', () => saveNow())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow()
})
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    saveNow(true)
  }
})
// The browser's "Leave site?" prompt while edits are not on disk. That includes
// the second before autosave: a write started while the page unloads is lost.
window.addEventListener('beforeunload', (e) => {
  if (!db.value || (saveStatus.value === 'saved' && !saveProblem.value)) return
  e.preventDefault()
  void saveNow()
})
