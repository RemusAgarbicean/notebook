declare module 'sql.js/dist/sql-wasm-inline.js' {
  import initSqlJs from 'sql.js'
  export default initSqlJs
}

// File System Access calls that TypeScript's DOM library does not include yet.
interface Window {
  showDirectoryPicker?(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
  }): Promise<FileSystemDirectoryHandle>
}
interface FileSystemHandle {
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}
