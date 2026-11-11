// Everything the app needs from disk. The File System Access version is in
// storage-fsa.ts; an <input type=file> + download fallback would be a second
// implementation of these two interfaces.

/** An opened Notebook folder: `notebook.sqlite` plus `backups/`. */
export interface NotebookFolder {
  readonly name: string
  /** The bytes of `notebook.sqlite`, or null when the file (or the folder) is gone. */
  read(): Promise<Uint8Array | null>
  /** Replaces the whole of `notebook.sqlite`. */
  write(bytes: Uint8Array): Promise<void>
  writeBackup(fileName: string, bytes: Uint8Array): Promise<void>
  /** File names in `backups/`. */
  listBackups(): Promise<string[]>
  deleteBackup(fileName: string): Promise<void>
  /** When `notebook.sqlite` was last changed on disk, by anyone. Null when it is gone. */
  lastModified(): Promise<number | null>
}

export interface NotebookStorage {
  /** Asks the user for a folder and remembers it. Null when they cancel. */
  pick(): Promise<NotebookFolder | null>
  /** The name of the remembered folder, if there is one. */
  lastName(): Promise<string | null>
  /** Re-asks permission for the remembered folder. Must be called from a click. Null when refused. */
  reopen(): Promise<NotebookFolder | null>
}
