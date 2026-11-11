import type { NotebookFolder } from './storage'

const pad = (n: number) => String(n).padStart(2, '0')
// Local time: "the first save of each day" means the user's day.
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const DAILY = /^notebook-\d{4}-\d{2}-\d{2}\.sqlite$/

/**
 * The Backup file names to remove so that the newest `keep` daily Backups and
 * the newest `keep` reason Backups (import, pre-upgrade) remain. The two are
 * counted apart, so a day of imports can't push out the dailies.
 */
export function backupsToDelete(names: string[], keep = 14) {
  const backups = names.filter((n) => /^notebook-.*\.sqlite$/.test(n))
  return [true, false].flatMap((daily) =>
    backups
      .filter((n) => DAILY.test(n) === daily)
      .sort() // names start with the date, so name order is age order
      .reverse()
      .slice(keep),
  )
}

export function backupName(reason?: string) {
  const now = new Date()
  const extra = reason
    ? `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${reason.replace(/[^\w-]+/g, '-')}`
    : ''
  return `notebook-${day(now)}${extra}.sqlite`
}

/**
 * Copies notebook.sqlite as it is on disk into backups/, then rotates.
 * Without a reason the name is the day's Backup, `notebook-YYYY-MM-DD.sqlite`;
 * with one it is `notebook-YYYY-MM-DD-HHMMSS-<reason>.sqlite`.
 */
export async function writeBackup(folder: NotebookFolder, reason?: string) {
  const bytes = await folder.read()
  if (!bytes) return
  await folder.writeBackup(backupName(reason), bytes)
  for (const old of backupsToDelete(await folder.listBackups())) await folder.deleteBackup(old)
}

/** Takes the day's Backup unless it already exists. Call before overwriting the file. */
export async function dailyBackup(folder: NotebookFolder) {
  if (!(await folder.listBackups()).includes(`notebook-${day(new Date())}.sqlite`))
    await writeBackup(folder)
}
