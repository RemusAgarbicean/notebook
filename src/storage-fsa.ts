// Storage on the File System Access API (Chrome and Edge), with the directory
// handles of the Recent Notebooks remembered in IndexedDB.
import { promote, recentFromStore, type Remembered } from './recent'
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

// The handle behind each folder this storage handed out.
const handleOf = new WeakMap<NotebookFolder, FileSystemDirectoryHandle>()

function folderFor(dir: FileSystemDirectoryHandle): NotebookFolder {
  const folder: NotebookFolder = {
    ...openFolder(dir),
    async isSame(other) {
      const theirs = handleOf.get(other)
      return !!theirs && dir.isSameEntry(theirs)
    },
  }
  handleOf.set(folder, dir)
  return folder
}

// One IndexedDB store, 'handles', holding the Recent Notebooks under 'recent'.
// Before there was a list it held one handle under 'folder'.
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

type Recent = Remembered<FileSystemDirectoryHandle>[]
const newId = () => crypto.randomUUID()

async function loadRecent(): Promise<Recent> {
  try {
    const store = await handles('readonly')
    const [stored, legacy] = await Promise.all([request(store.get('recent')), request(store.get('folder'))])
    return recentFromStore<FileSystemDirectoryHandle>(stored, legacy, newId)
  } catch {
    return [] // IndexedDB unavailable: the user just picks the folder again.
  }
}

async function saveRecent(list: Recent) {
  const store = await handles('readwrite')
  await request(store.put(list, 'recent'))
  await request(store.delete('folder'))
}

export const fsaStorage: NotebookStorage = {
  async pick() {
    if (!window.showDirectoryPicker)
      throw new Error("This browser can't open folders. Use Chrome or Edge.")
    try {
      return folderFor(await window.showDirectoryPicker({ id: 'notebook', mode: 'readwrite' }))
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null
      throw e
    }
  },
  recent: async () => (await loadRecent()).map((r) => ({ id: r.id, name: r.handle.name })),
  async reopen(id) {
    const dir = (await loadRecent()).find((r) => r.id === id)?.handle
    if (!dir) return null
    return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted' ? folderFor(dir) : null
  },
  async remember(folder) {
    const dir = handleOf.get(folder)
    if (!dir) return null
    try {
      const list = await promote(await loadRecent(), dir, (a, b) => a.isSameEntry(b), newId)
      await saveRecent(list)
      return list[0].id
    } catch {
      return null // Not being able to remember the folder must not stop it from opening.
    }
  },
  async forget(id) {
    await saveRecent((await loadRecent()).filter((r) => r.id !== id)).catch(() => {})
  },
}
