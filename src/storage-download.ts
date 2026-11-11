// Storage for browsers without the File System Access API (Brave by default,
// or a company policy): the Notebook is opened with a file input, kept in
// memory, and reaches the disk only as a download.
import type { NotebookFolder, NotebookStorage } from './storage'

const FILE = 'notebook.sqlite'

/** Hands `bytes` to the browser as a download called `fileName`. */
export function download(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>]))
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
  // Some browsers drop the download of a link that is not in the page, or whose URL is revoked right away.
  document.body.append(a)
  a.click()
  setTimeout(() => (a.remove(), URL.revokeObjectURL(url)), 60_000)
}

/** The "folder" behind one opened file, or behind a new Notebook when `file` is null. */
export const downloadFolder = (file: File | null, save = download): NotebookFolder => ({
  name: file?.name ?? FILE,
  manual: true,
  read: async () => file && new Uint8Array(await file.arrayBuffer()),
  write: async (bytes) => save(bytes, FILE),
  writeBackup: async (fileName, bytes) => save(bytes, fileName),
  listBackups: async () => [],
  readBackup: async () => null,
  deleteBackup: async () => {},
  // The browser cannot look at the file again, so it never counts as changed outside the app.
  lastModified: async () => null,
})

export const downloadStorage: NotebookStorage = {
  pick: () =>
    new Promise((resolve) => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.sqlite' })
      input.onchange = () => resolve(input.files?.[0] ? downloadFolder(input.files[0]) : null)
      // Older browsers never say the chooser was cancelled: nothing may wait on this promise.
      input.oncancel = () => resolve(null)
      input.click()
    }),
  lastName: async () => null,
  reopen: async () => null,
  blank: () => downloadFolder(null),
}
