// Storage on the File System Access API (Chrome and Edge), with the picked
// directory handle remembered in IndexedDB.
import type { NotebookFolder, NotebookStorage } from './storage'

const FILE = 'notebook.sqlite'
const BACKUPS = 'backups'

const isMissing = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError'

async function writeFile(dir: FileSystemDirectoryHandle, name: string, bytes: Uint8Array) {
  const file = await dir.getFileHandle(name, { create: true })
  // The real file is only replaced when close() succeeds.
  const writable = await file.createWritable()
  await writable.write(bytes as Uint8Array<ArrayBuffer>)
  await writable.close()
}

// Null when the file (or the folder it is in) is gone.
async function fileIn(dir: () => FileSystemDirectoryHandle | Promise<FileSystemDirectoryHandle>, name: string) {
  try {
    return await (await (await dir()).getFileHandle(name)).getFile()
  } catch (e) {
    if (isMissing(e)) return null
    throw e
  }
}
const currentFile = (dir: FileSystemDirectoryHandle) => fileIn(() => dir, FILE)

const openFolder = (dir: FileSystemDirectoryHandle): NotebookFolder => ({
  name: dir.name,
  async read() {
    const file = await currentFile(dir)
    return file && new Uint8Array(await file.arrayBuffer())
  },
  lastModified: async () => (await currentFile(dir))?.lastModified ?? null,
  deleteBackup: async (fileName) => (await dir.getDirectoryHandle(BACKUPS)).removeEntry(fileName),
  write: (bytes) => writeFile(dir, FILE, bytes),
  async writeBackup(fileName, bytes) {
    await writeFile(await dir.getDirectoryHandle(BACKUPS, { create: true }), fileName, bytes)
  },
  async readBackup(fileName) {
    const file = await fileIn(() => dir.getDirectoryHandle(BACKUPS), fileName)
    return file && new Uint8Array(await file.arrayBuffer())
  },
  async listBackups() {
    try {
      const names = []
      for await (const name of (await dir.getDirectoryHandle(BACKUPS)).keys()) names.push(name)
      return names
    } catch (e) {
      if (isMissing(e)) return []
      throw e
    }
  },
})

// One IndexedDB store holding one value: the last picked directory handle.
const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

async function handles(mode: IDBTransactionMode) {
  const open = indexedDB.open('notebook', 1)
  open.onupgradeneeded = () => open.result.createObjectStore('handles')
  return (await request(open)).transaction('handles', mode).objectStore('handles')
}

const lastHandle = async (): Promise<FileSystemDirectoryHandle | undefined> => {
  try {
    return await request((await handles('readonly')).get('folder'))
  } catch {
    return undefined // IndexedDB unavailable: the user just picks the folder again.
  }
}

export const fsaStorage: NotebookStorage = {
  async pick() {
    if (!window.showDirectoryPicker)
      throw new Error("This browser can't open folders. Use Chrome or Edge.")
    let dir
    try {
      dir = await window.showDirectoryPicker({ id: 'notebook', mode: 'readwrite' })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      throw e
    }
    // Not being able to remember the folder must not stop it from opening.
    await handles('readwrite')
      .then((store) => request(store.put(dir, 'folder')))
      .catch(() => {})
    return openFolder(dir)
  },
  lastName: async () => (await lastHandle())?.name ?? null,
  async reopen() {
    const dir = await lastHandle()
    if (!dir) return null
    return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted' ? openFolder(dir) : null
  },
}
