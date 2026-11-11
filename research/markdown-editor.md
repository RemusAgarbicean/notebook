# Which offline markdown editor and renderer to bundle?

Research for issue #4. Researched 2026-11-11.

## Recommendation

**Start with option A: a plain `<textarea>` editor, `marked` to render, and `DOMPurify` to sanitize.** It adds about **26 kB min+gz**. `[[Record]]` links take one small `marked` extension, and the `[[` autocomplete is a small hand-written Vue popup.

If plain-text editing turns out to be too bare, swap only the editor for **CodeMirror 6** (option B, about **+112 kB gz** in a lean setup). The stored markdown, the renderer and the sanitizer stay the same, so the upgrade is cheap and can wait.

Skip WYSIWYG editors (option C) for now. They are 5 to 6 times bigger, their markdown round-trip is lossy, and a wiki-link needs a custom node plus parse and serialize code.

## Comparison

All sizes were **measured**, not copied from bundlephobia. Each option was built with `esbuild --bundle --minify --format=esm` and `vue` kept external, since Vue is a shared cost. Gzip was run at `-9`. Versions are the npm `latest` versions on 2026-11-11. The entry files are listed under "Method" below.

| | A. textarea + marked + DOMPurify | B. CodeMirror 6 + marked + DOMPurify | C1. Tiptap 3 + @tiptap/markdown | C2. Milkdown 7 (kit) |
|---|---|---|---|---|
| Editor size (min+gz) | 0 (native textarea) | **112 kB** lean / 181 kB with `markdown()` / 203 kB with `basicSetup` | **152 kB** (StarterKit + Markdown + Mention) | **140 kB** (commonmark + gfm + history + listener + slash) |
| Render + sanitize | marked + DOMPurify **26 kB** (markdown-it + DOMPurify: 52 kB) | same 26 kB | none needed (read-only editor or schema-bound HTML) | none needed (same reason) |
| **Total** | **~26 kB** | **~138 kB** | **~152 kB** | **~140 kB** |
| Safe output | DOMPurify sanitizes the HTML | same as A | ProseMirror schema drops unknown HTML | same as C1 |
| Markdown fidelity | exact (the text is the source) | exact | lossy: the doc is converted to markdown and back | lossy (remark round-trip) |
| `[[link]]` render | marked inline extension, ~15 lines | same as A | custom inline node with markdown parse and render | remark plugin + node schema |
| `[[` autocomplete | hand-written popup, roughly 60 to 100 lines | built in: `autocompletion({override:[src]})` | `Mention` with `char: '[['` | slash or tooltip plugin + custom UI |
| License | MIT; DOMPurify MPL-2.0 OR Apache-2.0 | MIT | MIT | MIT |
| Maintenance | marked 18.2.0 (published 2026-11-09), markdown-it 15.0.3 (2026-10-16), DOMPurify 3.4.17 (2026-10-12) | @codemirror/view 6.43.15 (2026-10-19) | @tiptap/core 3.33.1 (2026-11-10) | @milkdown/kit 7.23.0 (2026-10-27) |

Sizes on their own: DOMPurify is 11.8 kB gz, and `marked` alone is about 14 kB gz.

### Offline, single-file and `file://` notes

- **None of the bundles make network calls.** I grepped every bundle for `http(s)://`. The only matches are XML namespace strings (`w3.org/...`) and license or doc URLs inside comments or error messages. There are no fetches, web workers, CDN fonts or remote CSS.
- CodeMirror injects its CSS at runtime with `style-mod`, so there is no stylesheet to inline. Tiptap and Milkdown "kit" ship no theme. Avoid Milkdown's `@milkdown/crepe` theme, because it brings its own CSS and fonts to audit (not measured).
- DOMPurify needs a real DOM. That is fine here, because the app always runs in Chrome or Edge.

## The options in detail

### A. textarea + marked + DOMPurify (recommended)

- **Render:** `DOMPurify.sanitize(marked.parse(text))`, then `v-html`.
- **Sanitize:** DOMPurify keeps `data-*` attributes by default, so links can carry the record id.
- **Wiki-link render:** marked supports custom inline extensions with the fields `name`, `level: 'inline'`, `start(src)`, `tokenizer(src)` and `renderer(token)` ([marked.js.org/using_pro](https://marked.js.org/using_pro)). Sketch:

  ```js
  marked.use({ extensions: [{
    name: 'wikilink', level: 'inline',
    start: src => src.indexOf('[['),
    tokenizer(src) { const m = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(src); if (m) return { type: 'wikilink', raw: m[0], target: m[1].trim(), label: (m[2] ?? m[1]).trim() } },
    renderer: t => `<a href="#" class="wikilink" data-record="${escapeHtml(t.target)}">${escapeHtml(t.label)}</a>`,
  }]})
  ```

  Handle clicks with one delegated `@click` on the rendered container that reads `data-record`. A target with no matching record can render as a "missing" link instead.
- **Autocomplete:** a native `<datalist>` does not work on a `<textarea>`. When the text before the caret matches `/\[\[([^\]\n]*)$/`, show a small absolutely positioned list of record titles. Arrow keys move through it, and Enter or Tab inserts `Title]]`. Placing the list at the caret needs the standard mirror-div trick, or you can place it under the textarea. This is the only real hand-written cost.
- **markdown-it instead of marked:** it also works, through `md.inline.ruler.before('link', ...)` or the community `markdown-it-wikilinks` plugin. But it costs twice as much (52 kB vs 26 kB gz with DOMPurify) for no gain here.

### B. CodeMirror 6

- Adds syntax highlighting, undo history, keymaps, and a ready-made, accessible autocomplete popup.
- **Autocomplete:** pass a source with `autocompletion({ override: [src] })`. Inside it, call `context.matchBefore(/\[\[[^\]]*/)` and return `{ from, options: [{label}], validFor }` ([codemirror.net/examples/autocompletion](https://codemirror.net/examples/autocompletion/)). That is about 10 lines.
- **Size trap:** `@codemirror/lang-markdown` depends on `@codemirror/lang-html`, which brings in the JS and CSS parsers. That costs about 69 kB gz extra: `@lezer/javascript` alone was 76 kB of the minified output. Importing `markdownLanguage` instead of calling `markdown()` let esbuild tree-shake those parsers out, and the editor went from 181 kB to 112 kB gz. The trade-off is that HTML and code blocks get no highlighting.
- Rendering still uses option A's marked + DOMPurify, so B is a superset of A.

### C. WYSIWYG: Tiptap 3 or Milkdown 7 (both on ProseMirror)

- **Tiptap:** the official Markdown extension parses markdown with MarkedJS. Tiptap's docs call it an "early release" that "can be subject to change". They also list lossy cases: comments are lost, and table cells can hold only one child node ([tiptap.dev/docs/editor/markdown](https://tiptap.dev/docs/editor/markdown)).
  - **Wiki-link autocomplete:** `@tiptap/extension-mention` (MIT) + `@tiptap/suggestion` with a custom `render` hook. No UI library is required ([tiptap.dev/docs/editor/extensions/nodes/mention](https://tiptap.dev/docs/editor/extensions/nodes/mention)).
  - **Multi-char trigger:** the installed `findSuggestionMatch.ts` regex-escapes the trigger and slices off `char.length`, so `char: '[['` works. You need `allowSpaces: true` for titles like "Source to Pay".
  - You still have to give the mention node markdown parse and render handlers, so it saves as `[[X]]` rather than as HTML.
- **Milkdown:** markdown-first (remark), but a wiki-link needs three pieces: a remark syntax plugin, a node schema with `parseMarkdown`/`toMarkdown`, and a tooltip or slash plugin for the menu. That is the most custom work of all the options.
- **Both:** the stored markdown is re-serialized on every edit. So formatting the user typed by hand, such as list markers, spacing or raw HTML, gets normalized or dropped. Notes are the user's own data, so this lossiness is the main reason not to pick C.

## Method

The scratch build is at `/tmp/claude-1000/-home-remus-notebook/d2719a37-30af-4d6d-8e11-5c664fff4357/scratchpad/r4/sz`. Each entry file imports a realistic setup:

- **A:** `marked` + `DOMPurify`, or `markdown-it({linkify:true})` + `DOMPurify`.
- **B lean:** `@codemirror/view` + `state` + `commands` (`history`, keymaps) + `language` (`defaultHighlightStyle`) + `autocomplete` + `markdownLanguage`.
- **B variants:** the same with `markdown()`, and `codemirror`'s `basicSetup` + `markdown()`.
- **C1:** `@tiptap/vue-3` `Editor` + `StarterKit` + `@tiptap/markdown` + `@tiptap/extension-mention`.
- **C2:** `@milkdown/kit` core + commonmark + gfm + history + listener + slash.

The breakdown came from esbuild's `--metafile`. Licenses and versions came from each package's `package.json`, and publish dates from `npm view <pkg> time.modified`. Sizes for Vite/Rollup will differ by a few kB, but the ranking will not change.
