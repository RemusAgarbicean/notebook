import { promote, type Remembered } from './recent'
import type { NotebookFolder, NotebookStorage } from './storage'

/** A Notebook folder held in memory, for tests. */
export function memoryFolder(file: Uint8Array | null = null, name = 'My Notebook') {
  const folder = {
    name,
    file,
    /** Stands in for the file's lastModified: bump it to play an edit made outside the app. */
    modified: 0,
    backups: new Map<string, Uint8Array>(),
    read: async () => folder.file,
    async write(bytes: Uint8Array): Promise<void> {
      folder.file = bytes
      folder.modified++
    },
    async writeBackup(fileName: string, bytes: Uint8Array): Promise<void> {
      folder.backups.set(fileName, bytes)
    },
    readBackup: async (fileName: string) => folder.backups.get(fileName) ?? null,
    listBackups: async () => [...folder.backups.keys()],
    async deleteBackup(fileName: string): Promise<void> {
      folder.backups.delete(fileName)
    },
    lastModified: async () => (folder.file ? folder.modified : null),
  }
  return folder satisfies NotebookFolder
}

/**
 * A storage over memory folders, for tests. `pick` is what the picker returns:
 * a folder, null for Cancel, or a function for anything else. `recent` are the
 * Recent Notebooks, most recent first. Spread it and override a method to play
 * a refusal.
 */
export function memoryStorage(
  pick: NotebookFolder | null | (() => Promise<NotebookFolder | null>) = null,
  recent: NotebookFolder[] = [],
): NotebookStorage {
  let n = 0
  const newId = () => `m${++n}`
  let list: Remembered<NotebookFolder>[] = recent.map((handle) => ({ id: newId(), handle }))
  return {
    pick: typeof pick === 'function' ? pick : async () => pick,
    recent: async () => list.map((r) => ({ id: r.id, name: r.handle.name })),
    reopen: async (id) => list.find((r) => r.id === id)?.handle ?? null,
    async remember(folder) {
      list = await promote(list, folder, async (a, b) => a === b, newId)
      return list[0].id
    },
    async forget(id) {
      list = list.filter((r) => r.id !== id)
    },
  }
}
