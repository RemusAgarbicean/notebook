import type { NotebookFolder } from './storage'

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
    listBackups: async () => [...folder.backups.keys()],
    async deleteBackup(fileName: string): Promise<void> {
      folder.backups.delete(fileName)
    },
    lastModified: async () => (folder.file ? folder.modified : null),
  }
  return folder satisfies NotebookFolder
}
