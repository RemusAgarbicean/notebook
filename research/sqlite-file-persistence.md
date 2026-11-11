# sql.js + File System Access API from a `file://` single-file app

Question (issue #2): can a single HTML file opened from disk via `file://` in Chrome or Edge on macOS do all of this with no network fetches?

- load a user-picked `.sqlite` file into sql.js,
- write it back through the File System Access API,
- keep the file handle across reloads,
- ship sql.js's WASM inside that one HTML file.

## Verdict: works, with caveats

The whole chain is feasible, and every step I could test without a real file picker passed. The parts that need a human in real Chrome/Edge on the Mac are marked **UNVERIFIED** below.

| Part | Status | Evidence |
|---|---|---|
| `file://` page is a secure context | Yes | MDN, plus empirical: `isSecureContext === true` |
| `showOpenFilePicker` / `showSaveFilePicker` exposed on `file://` | Yes | Empirical: both are `function` in Chromium 153 |
| Pick, read, then `createWritable()` write-back works on `file://` | Very likely, **UNVERIFIED** (needs a real picker) | API exposed and context secure; no source says `file://` is excluded |
| IndexedDB works on `file://` (to store the handle) | Yes | Empirical: open, put and commit succeed |
| Handle survives reload, re-grant via `requestPermission()` | Expected per Chrome docs, **UNVERIFIED** on `file://` | Chrome persistent-permissions blog |
| "Allow on every visit" (persistent permission) offered to a `file://` page | **UNVERIFIED**, unknown | Chrome docs don't mention `file://` |
| sql.js + WASM inlined into one HTML, zero fetches | Yes | Empirical: 961 kB HTML (445 kB gzip); the only request was the HTML itself |
| OPFS on `file://` | **No** | Empirical: `navigator.storage.getDirectory()` throws `SecurityError` |
| Whole-DB rewrite cost | Fine for notebook-scale data | Empirical: 51 MB export takes ~50–75 ms (Node, sql.js 1.16) |

## Recommended approach

1. **Bundle.** Use Vite + `vite-plugin-singlefile`, and import `sql.js/dist/sql-wasm-inline.js`, which ships the WASM embedded in the JS. That way you need no `locateFile`, no `?url` asset and no base64 plumbing of your own. Also set `build.modulePreload.polyfill: false` and `viteSingleFile({ removeViteModuleLoader: true })` so the bundle contains no `fetch(` at all. Keep everything in one chunk: no lazy routes or dynamic `import()`, and use hash routing (see the singlefile README caveats).
2. **Open.** On a user click, call `showOpenFilePicker({ types: [{ accept: { 'application/x-sqlite3': ['.sqlite', '.db'] } }] })`. Then `new SQL.Database(new Uint8Array(await (await handle.getFile()).arrayBuffer()))`. Offer `showSaveFilePicker` for "new notebook".
3. **Remember.** Put the `FileSystemFileHandle` into IndexedDB. On load, read it back and call `handle.queryPermission({ mode: 'readwrite' })`. If the result is not `'granted'`, show a "Reopen <name>" button whose click calls `handle.requestPermission({ mode: 'readwrite' })`. `requestPermission` needs a user gesture, so it cannot run silently on load.
4. **Save.** `const w = await handle.createWritable(); await w.write(db.export()); await w.close();` Debounce saves (for example on idle or every few seconds) rather than saving per keystroke. `close()` is the commit point: Chrome writes to a swap file and replaces the target on close.
5. **Fallback.** If the picker or write is blocked (policy, see below), use `<input type="file">` to load and `<a download>` with a Blob to save. This always works on `file://`, but each save is a manual download.

## Details and sources

### Secure context

MDN's Secure Contexts page lists `file:///path/to/resource.html` as **secure** and names `file` among the potentially trustworthy schemes ([MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)). `createWritable` is secure-context-only ([MDN: createWritable](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable)), so this requirement is met.

Empirical check: the built single-file page, loaded from `file://` in headless Chromium 153 (Playwright's bundled build, Linux), reported `isSecureContext: true`, `location.origin: "file://"`, and both picker functions present.

### Writing back

Per MDN, changes made through the stream do not reach the file until the stream is closed. The browser typically writes to a temporary file and swaps it in on `close()` ([MDN: createWritable](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable)). The default `keepExistingData: false` is what you want, because you rewrite the whole file anyway.

Possible errors on save:

- `NotAllowedError`: permission lapsed. Re-request it on a click.
- `NoModificationAllowedError`: the file is locked.
- `AbortError`: Safe Browsing or malware checks failed.

Handle all of them without discarding the in-memory DB. Keep it dirty and offer "Save as…" or download.

### Handle persistence and permission prompts

From [Chrome: Persistent permissions for the File System Access API](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api):

- File and directory handles can be stored in IndexedDB. Before Chrome 122, access "lasts until you close the last tab of the origin", so every new session needs `requestPermission()`.
- From **Chrome 122**, calling `requestPermission()` on a restored handle shows a three-way prompt: **Allow this time / Allow on every visit / Don't allow**. "Allow on every visit" grants indefinite access until the user revokes it. The prompt also covers every handle the app previously had.
- Access can be auto-revoked after a tab sits in the background, and the same prompt appears when you re-request it.
- If the user dismisses or denies the prompt more than three times, Chrome falls back to the regular prompt.
- Installed PWAs get persistence automatically. A `file://` page cannot be installed, so it does not get this.
- A Chromium change made `queryPermission()` reflect persistent grants. Older builds could report `'prompt'` even when access was granted, so always use the query-then-request-on-click flow.

**UNVERIFIED:** the docs never mention `file://`. Whether Chrome or Edge offers "Allow on every visit" to the `file://` origin needs a manual test. Worst case is one click per session ("Reopen notebook" calls `requestPermission`), which is acceptable.

Empirical check: IndexedDB open, write and commit succeed on `file://`. Storing an actual `FileSystemFileHandle` was not tested, because a handle can only be obtained from a picker.

Note: in Chrome every `file://` page shares the single `file://` storage origin. Any other local HTML file you open can read the same IndexedDB, including the stored handle. Low risk for a personal tool, but worth knowing.

### Managed Mac: enterprise policy is the real risk

Chrome has admin policies that can switch this off independently of the browser's capabilities. They are listed in the Chromium policy definitions (`components/policy/resources/templates/policy_definitions/`):

- `ContentSettings/DefaultFileSystemReadGuardSetting`, `DefaultFileSystemWriteGuardSetting`
- `FileSystemRead/WriteAskForUrls`, `FileSystemRead/WriteBlockedForUrls`
- `FileSelectionDialogs/AllowFileSelectionDialogs`: if false, pickers fail.

Check `chrome://policy` (or `edge://policy`) on the company Mac before building on this. If write is blocked, step 5's download fallback is the remaining option.

### Single-file bundle, zero network

- sql.js 1.16.0 ships `dist/sql-wasm-inline.js` (965 kB) with the WASM embedded. The README describes it as an inline build that avoids `locateFile` ([sql.js README](https://github.com/sql-js/sql.js)). The default `browser` export (`sql-wasm-browser.js`) would try to load a separate `.wasm` file, so import the inline file explicitly.
- `vite-plugin-singlefile` inlines all JS and CSS into `index.html` ([README](https://github.com/richardtallent/vite-plugin-singlefile)). Its caveats:
  - dynamic `import()` or lazy chunks can break on `file://`;
  - History-API routing does not work, but hash routing does;
  - files in `public/` are not inlined;
  - a CSP meta tag needs `'unsafe-inline'`.

Empirical check: Vite 8.3.8 + vite-plugin-singlefile 2.3.4 + sql.js 1.16.0 produced one `dist/index.html` of 961 kB (445 kB gzip).

- Loaded from `file://` in headless Chromium, it created a DB, exported it, reopened it from the bytes, and read the value back.
- Playwright logged exactly **one request**, the HTML file itself.
- With `build.modulePreload.polyfill: false`, the bundle contains no `fetch(` string. Without that setting, Vite's modulepreload polyfill contains one, though it is never triggered here.
- No `http(s)://` URLs appear other than a GitHub link inside an error message.

Vue will add roughly 100 kB on top. Not tested with Vue itself.

### Size and performance of a whole-DB rewrite

- sql.js keeps the DB in memory (MEMFS). `db.export()` returns the full file as a `Uint8Array`. The README warns that large DBs can run out of memory, since everything lives in RAM.
- In the current source, `export()` copies through SQLite's backup API into a separate in-memory file ([src/api.js](https://github.com/sql-js/sql.js/blob/master/src/api.js)). Inferred from that source: open prepared statements and the DB stay usable. Old sql.js versions closed and reopened the DB on export.
- Benchmark (Node 22, sql.js 1.16, 50k rows × 1 kB = 51 MB):
  - export took 50–75 ms;
  - reopening from bytes took 135 ms.
- Writing a few MB to local SSD through `createWritable` should be negligible. That is **UNVERIFIED** in a browser, and Safe Browsing scanning on `close()` may add latency.
- Practical ceiling: up to tens of MB, rewriting on every debounced save is fine. Peak memory is about 2–3× the DB size during export (the WASM heap copy plus the JS array). If the DB grows past roughly 100 MB, revisit the design (for example by moving attachments out of SQLite). A personal notebook is unlikely to get there.

### Alternatives if a part fails

- **OPFS (Origin Private File System) + export button**: ruled out. `navigator.storage.getDirectory()` throws `SecurityError` on `file://` (empirical, Chromium 153). That also rules out OPFS-backed VFSes in either library.
- **Official `@sqlite.org/sqlite-wasm`**: no advantage here.
  - Its persistent VFSes (`opfs` and `opfs-sahpool`) rely on OPFS, which is unavailable on `file://`.
  - It loads `sqlite3.wasm` separately by default, so inlining needs extra work.
  - In-memory plus `sqlite3_js_db_export` / deserialize is the same model as sql.js.
- **Pickers or write blocked by policy**: fall back to `<input type="file">` to load and Blob + `<a download>` to save. The user then manually replaces the file, typically from `~/Downloads`. Optionally add an IndexedDB snapshot of the bytes as crash insurance between downloads.
- **WebAssembly blocked (rare)**: `sql-asm.js`, a pure-JS build of 1.4 MB, exists in `dist/`.

## To verify manually on the company Mac

1. Open the built HTML from Finder in Chrome, then in Edge.
2. Pick a `.sqlite` file, edit, save, and confirm the file changes on disk.
3. Reload and confirm the prompt shows "Allow on every visit" for `file://`. Choose it, reload again, and check whether `queryPermission` returns `'granted'` without a prompt.
4. Check `chrome://policy` and `edge://policy` for the policies listed above.
