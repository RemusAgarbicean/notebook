// The inline build carries the WASM as base64, so nothing is fetched.
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js'

export const loadSqlite = () => initSqlJs()
