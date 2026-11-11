# Vue Flow in an offline single-file HTML app

Research for issue #3. Researched 2026-11-11.

The app this is for: a personal Vue 3 app built into one HTML file with Vite and `vite-plugin-singlefile`, opened from disk (`file://`) in Chrome or Edge, with no network calls allowed.

## Verdict

**Yes, Vue Flow fits.** I built a test bundle (Vue Flow core, background, controls, minimap, a custom node, a custom edge, sidebar drag-and-drop, `toObject`, html-to-image PNG export and dagre layout). It compiled into **one HTML file with one inline `<script>` and no external `src`/`href`**. I opened it from `file://` in headless Chromium:

- every feature worked;
- the page made **zero non-`file:`/`data:` requests**;
- it logged no console errors.

There is one real caveat, covered under Export: html-to-image fills edge paths black unless the edge paths have an inline `fill: none`.

## Facts

| Topic | Finding | Source |
|---|---|---|
| License | MIT for core and every add-on (background, controls, minimap, node-resizer) | npm metadata (`npm view @vue-flow/core license`) |
| Versions | core 1.48.2 (2026-01-28), background 1.3.2, controls 1.1.3, minimap 1.5.4. Peer dependency `vue ^3.3.0` | npm |
| Runtime dependencies | `@vueuse/core`, `d3-drag`, `d3-interpolate`, `d3-selection`, `d3-zoom`. All pure JS, no workers, no fetches | `npm view @vue-flow/core dependencies` |
| Maintenance | About 6.9k stars, not archived, 19 open issues. Last code fix was 2026-01-23 (#2014); since then, only doc commits (latest 2026-06-23). Releases ran roughly monthly through 2025 and stopped after 1.48.2 in Jan 2026. Reads as **mature/slow, not abandoned**, and it is a single-maintainer project | GitHub API `repos/bcakmakoglu/vue-flow` |
| CSS | Import `@vue-flow/core/dist/style.css` (required) and `theme-default.css` (optional), plus `@vue-flow/controls/dist/style.css` and `@vue-flow/minimap/dist/style.css`. Vite inlines them all | `docs/src/guide/getting-started.md`, `theming.md` |

## Bundle size (measured)

I built with Vite 8.3.8, @vitejs/plugin-vue 6.0.10, vite-plugin-singlefile 2.3.4 and Vue 3.5.45. Sizes are of the single `index.html`:

| Build | Raw | gzip -9 |
|---|---|---|
| Vue only (baseline) | 62 KB | 24 KB |
| + Vue Flow core, background, controls, minimap, CSS, custom node and edge | 295 KB | 99 KB |
| + html-to-image | 309 KB | 104 KB |
| + @dagrejs/dagre 3.1.3 | 356 KB | 120 KB |
| elkjs 0.12.1 `elk.bundled.js` alone (not built in) | 1.65 MB | 477 KB |

Vue Flow and its add-ons cost about **230 KB raw (about 75 KB gzip)**. Since the file is read from disk, the raw size only matters for parse time, and at this size that is negligible.

## Serialization (toObject / fromObject)

- `toObject()` returns `{ nodes, edges, position, zoom, viewport }`. `position` and `zoom` are `@deprecated` in favour of `viewport: {x, y, zoom}` (`FlowExportObject` in `packages/core/src/types/flow.ts`).
- It strips runtime-only fields (`computedPosition`, `handleBounds`, `selected`, `dimensions`, `dragging`, `events`, …, and `sourceNode`/`targetNode` on edges). It then runs `JSON.parse(JSON.stringify(...))`, so the result is plain JSON that can go straight into a SQLite TEXT column (`packages/core/src/store/actions.ts`, `toObject`).
- In the test, a saved node came out as `{"id":"1","type":"record","initialized":false,"position":{"x":0,"y":0},"data":{"label":"Root","recordId":42}}`. **`data` survives intact**, so a link to a record in another table can simply be `data.recordId` / `data.table`.
- `fromObject(obj)` returns a Promise. It calls `setNodes`, then `setEdges`, then waits for the viewport to initialise and calls `setViewport` (same file).
- **Bug to work around:** `fromObject` restores the viewport only when `viewport.x && viewport.y` are truthy. A pan of exactly `x = 0` or `y = 0` is therefore silently skipped. A safe restore is `setNodes(o.nodes); setEdges(o.edges); setViewport(o.viewport)` after `onPaneReady`, or just accept the quirk.
- The docs page `guide/utils/instance` still describes an older `toObject` shape (`elements, position, zoom`). Trust the source and types, not that page.
- Vue Flow has "no built-in persistent storage feature". The official save/restore example uses `localStorage.setItem(key, JSON.stringify(toObject()))` (`docs/examples/save-restore/Controls.vue`). Swapping in a SQLite write is trivial.
- Keep `type` names (e.g. `record`, `link`) stable: they are stored in the JSON and resolved against `nodeTypes`/`edgeTypes` when the diagram loads.

## Custom nodes and edges

- Both are first-class. Register a component through the `nodeTypes` / `edgeTypes` props (wrap it with `markRaw`), or through `#node-<type>` / `#edge-<type>` slots (`docs/src/guide/node.md` "User-Defined Nodes", `edge.md` "User-Defined Edges").
- Custom nodes get `data`, `id`, `selected`, etc. as props and place `<Handle>` components themselves.
- Custom edges use `BaseEdge`, path helpers (`getBezierPath`, `getSmoothStepPath`, …) and `EdgeLabelRenderer` for HTML labels.
- **Verified:** both worked in the test bundle (`RecordNode.vue` showed `data.recordId`, and `LinkEdge.vue` had an HTML label).

## Drag from sidebar to canvas

- Supported. The official example (`docs/examples/dnd/useDnD.js`) uses native HTML5 drag events:
  1. `dragstart` calls `dataTransfer.setData('application/vueflow', type)`.
  2. `dragover.prevent` lets the canvas accept the drop.
  3. `drop` converts the cursor position with `screenToFlowCoordinate({x: clientX, y: clientY})` and calls `addNodes`.
  4. It optionally re-centres the new node in `onNodesInitialized`.
- **Verified:** dropping a sidebar item via Playwright added a node.

## Export to PNG / SVG offline

- Vue Flow has no built-in export. The official screenshot example (`examples/vite/src/Screenshot/useScreenshot.ts`) wraps **html-to-image** (`toPng` / `toJpeg`, then a download through a temporary `<a download>`).
- html-to-image: MIT, 1.11.13 (last release Feb 2025), repo active but with 187 open issues. It works by drawing the DOM into an SVG `<foreignObject>` and then onto a canvas. This all happens locally, with no network.
- **Verified offline:** `toPng(document.querySelector('.vue-flow'), { filter })` produced a valid PNG. The filter drops `.vue-flow__minimap` and `.vue-flow__controls`.
- **Caveat (reproduced):** in the export, edge `<path>`s came out **filled black** (curved edges became black blobs, straight edges disappeared), even though the computed style is `fill: none`. Fix: set inline `style="fill:none; stroke:…"` on edge paths, e.g. `<BaseEdge :style="{ fill: 'none', stroke: '#b1b1b7' }" …>` in a custom edge, or `style` on each edge object for built-in edge types. After this fix the exported PNG matched the screen.
- **Scope of export:** capturing `.vue-flow` only gives the visible viewport. To export the whole diagram, either call `fitView()` first, or capture `.vue-flow__viewport` with a computed transform. Vue Flow exports `getRectOfNodes` and `getTransformForBounds` for this (same approach as React Flow's "download image" example).
- **SVG:** html-to-image's `toSvg` returns an SVG that wraps HTML in `<foreignObject>`. It opens in browsers but is **not a clean vector SVG** for Inkscape/Illustrator/Word. Treat PNG as the reliable format; a true vector export would need a custom serializer, which is not worth it for a personal app.
- Fonts: in an offline single file, any web font must be bundled (Vite inlines it as a `data:` URL). System fonts just work.

## Mind-map use and auto-layout

- Vue Flow is a free-positioned node graph, not a mind-map tool. Mind-map conveniences need about 20–50 lines of app code each:
  - "add child" and "add sibling" commands;
  - keyboard navigation;
  - collapse/expand (hide descendants via `hidden`);
  - automatic re-layout.
- **dagre** (`@dagrejs/dagre` 3.1.3, MIT, active; about 47 KB raw / 16 KB gzip) is what the official layout example uses (`docs/examples/layout/useLayout.js`). It builds a graph from node dimensions (`findNode(id).dimensions`), runs `dagre.layout`, and writes positions back. `rankdir: 'LR'` gives a decent left-to-right tree/mind-map. **Verified** in the test bundle.
  - It does not produce a radial mind map (children on both sides of the root). If you want that, lay out the left and right subtrees separately, or write a tiny tree layout by hand.
- **elkjs** is more capable, but it is EPL-2.0 OR GPL-3.0 and **1.65 MB raw / 477 KB gzip**. It also prefers a Web Worker, which is awkward from `file://` (it can run without one, on the main thread). It is overkill here.
- Dagre positions are the node centre, while Vue Flow positions are the top-left corner. The official example ignores the difference; subtract width/2 and height/2 if alignment matters.

## Recommendations

1. Use `@vue-flow/core` with `background`, `controls` and `minimap`, and bundle it through `vite-plugin-singlefile`. No special config was needed.
2. Store `JSON.stringify(toObject())` in a SQLite TEXT column, with record links in `node.data`. Restore with `setNodes`/`setEdges`/`setViewport`, or with `fromObject`, keeping in mind its x/y = 0 quirk.
3. Define one custom node (`record`) and, if needed, one custom edge. Put inline `fill: none` on every edge path so PNG export works.
4. For export, use `html-to-image` `toPng`, with a filter that excludes the minimap and controls, and `fitView()` before capturing. Do not promise vector SVG.
5. For layout, add `@dagrejs/dagre` only when you want a "tidy" button. Skip elkjs.

## Not checked

- Real Chrome/Edge on macOS. Only headless Chromium (Playwright build 1243) on Linux was tested, but nothing here is OS-specific.
- Performance with hundreds of nodes.
- Vue Flow inside an iframe or with a strict CSP.

Probe sources (throwaway, not committed): scratchpad `r3/build` (Vite project) and `r3/pwtest` (Playwright script).
