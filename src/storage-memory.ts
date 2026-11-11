import type { NotebookFolder } from './storage'

/** A Notebook folder held in memory, for tests. */
export function memoryFolder(file: Uint8Array | null = null, name = 'My Notebook') {
  const folder = {
    name,
    file,
    backups: new Map<string, Uint8Array>(),
    read: async () => folder.file,
    async write(bytes: Uint8Array): Promise<void> {
      folder.file = bytes
    },
    async writeBackup(fileName: string, bytes: Uint8Array): Promise<void> {
      folder.backups.set(fileName, bytes)
    },
    listBackups: async () => [...folder.backups.keys()],
  }
  return folder satisfies NotebookFolder
}
