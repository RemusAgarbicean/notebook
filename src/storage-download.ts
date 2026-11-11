// Storage for browsers without the File System Access API (Brave by default,
// or a company policy): the Notebook is opened with a file input, kept in
// memory, and reaches the disk only as a download.
import type { NotebookFolder, NotebookStorage } from './storage'

const FILE = 'notebook.sqlite'

/** Hands `bytes` to the browser as a download called `fileName`. */
export function download(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>]))
  Object.assign(document.createElement('a'), { href: url, download: fileName }).click()
  URL.revokeObjectURL(url)
}

/** The "folder" behind one opened file, or behind a new Notebook when `file` is null. */
export const downloadFolder = (file: File | null, save = download): NotebookFolder => ({
  name: file?.name ?? FILE,
  manual: true,
  read: async () => file && new Uint8Array(await file.arrayBuffer()),
  write: async (bytes) => save(bytes, FILE),
  writeBackup: async (fileName, bytes) => save(bytes, fileName),
  listBackups: async () => [],
  deleteBackup: async () => {},
  // The browser cannot look at the file again, so it never counts as changed outside the app.
  lastModified: async () => null,
})

export const downloadStorage: NotebookStorage = {
  pick: () =>
    new Promise((resolve) => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.sqlite' })
      input.onchange = () => resolve(input.files?.[0] ? downloadFolder(input.files[0]) : null)
      input.oncancel = () => resolve(null)
      input.click()
    }),
  lastName: async () => null,
  reopen: async () => null,
  blank: () => downloadFolder(null),
}
