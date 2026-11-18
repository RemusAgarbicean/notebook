// Everything the app needs from disk. The File System Access version is in
// storage-fsa.ts; the <input type=file> + download fallback for browsers
// without that API is in storage-download.ts.

/** An opened Notebook folder: `notebook.sqlite` plus `backups/`. */
export interface NotebookFolder {
  readonly name: string
  /**
   * True when write() and writeBackup() hand the user a download instead of
   * writing silently: nothing may call them unasked, and there is no backups/.
   */
  readonly manual?: boolean
  /** The bytes of `notebook.sqlite`, or null when the file (or the folder) is gone. */
  read(): Promise<Uint8Array | null>
  /** Replaces the whole of `notebook.sqlite`. */
  write(bytes: Uint8Array): Promise<void>
  writeBackup(fileName: string, bytes: Uint8Array): Promise<void>
  /** File names in `backups/`. */
  listBackups(): Promise<string[]>
  /** The bytes of one file in `backups/`, or null when it is gone. */
  readBackup(fileName: string): Promise<Uint8Array | null>
  deleteBackup(fileName: string): Promise<void>
  /** When `notebook.sqlite` was last changed on disk, by anyone. Null when it is gone. */
  lastModified(): Promise<number | null>
  /** Whether `other` is this same folder, reached another way. Without it, only the same object is. */
  isSame?(other: NotebookFolder): Promise<boolean>
}

/** One of the Recent Notebooks, as the start screen and the sidebar list them. */
export interface RecentNotebook {
  /** Stays the same while the entry is in the list: two folders can have the same name. */
  readonly id: string
  readonly name: string
}

export interface NotebookStorage {
  /** Asks the user for a folder. Null when they cancel. */
  pick(): Promise<NotebookFolder | null>
  /** The Recent Notebooks, most recent first. Always empty on the download fallback. */
  recent(): Promise<RecentNotebook[]>
  /**
   * Re-asks permission for one of the Recent Notebooks. Must be called from a
   * click. Null when refused, or when `id` is no longer in the list.
   */
  reopen(id: string): Promise<NotebookFolder | null>
  /**
   * Puts a folder that just opened at the front of the Recent Notebooks and
   * returns its id there; null when it is not remembered (the download
   * fallback, or IndexedDB unavailable).
   */
  remember(folder: NotebookFolder): Promise<string | null>
  /** Takes one entry off the Recent Notebooks. */
  forget(id: string): Promise<void>
  /**
   * Only on the download fallback, where there is no folder: a new, empty
   * Notebook. There pick() opens one notebook.sqlite file.
   */
  blank?(): NotebookFolder
}
