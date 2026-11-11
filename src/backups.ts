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

const KINDS: Record<string, string> = {
  import: 'Before import',
  'pre-upgrade': 'Before upgrade',
  restore: 'Before restore',
  manual: 'Manual',
}

export type BackupInfo = { date: string; time: string | null; kind: string }

/** What a Backup's file name says: its day, its time (a daily Backup has none) and why it was taken. Null for other files. */
export function describeBackup(fileName: string): BackupInfo | null {
  // A trailing -2, -3… tells apart Backups taken for the same reason in the same second.
  const m = /^notebook-(\d{4}-\d{2}-\d{2})(?:-(\d{2})(\d{2})(\d{2})-(.+?)(?:-\d+)?)?\.sqlite$/.exec(fileName)
  if (!m) return null
  const [, date, h, min, s, reason] = m
  return reason ? { date, time: `${h}:${min}:${s}`, kind: KINDS[reason] ?? reason } : { date, time: null, kind: 'Daily' }
}

/** A file size for people: whole KB below 1 MB, then MB with one decimal. */
export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function backupName(reason?: string) {
  const now = new Date()
  const extra = reason
    ? `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${reason.replace(/[^\w-]+/g, '-')}`
    : ''
  return `notebook-${day(now)}${extra}.sqlite`
}

/**
 * Writes `bytes`, or else notebook.sqlite as it is on disk, into backups/, then rotates.
 * Without a reason the name is the day's Backup, `notebook-YYYY-MM-DD.sqlite`;
 * with one it is `notebook-YYYY-MM-DD-HHMMSS-<reason>.sqlite`, never an existing file's name.
 */
export async function writeBackup(folder: NotebookFolder, reason?: string, bytes?: Uint8Array | null) {
  bytes ??= await folder.read()
  if (!bytes) return
  const taken = await folder.listBackups()
  let name = backupName(reason)
  for (let n = 2; reason && taken.includes(name); n++) name = backupName(`${reason}-${n}`)
  await folder.writeBackup(name, bytes)
  for (const old of backupsToDelete([...taken, name])) await folder.deleteBackup(old)
}

/** Takes the day's Backup unless it already exists. Call before overwriting the file. */
export async function dailyBackup(folder: NotebookFolder) {
  if (!(await folder.listBackups()).includes(`notebook-${day(new Date())}.sqlite`))
    await writeBackup(folder)
}
