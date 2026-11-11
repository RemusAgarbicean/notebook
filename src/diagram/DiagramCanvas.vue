<script setup lang="ts">
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { Position, useVueFlow, VueFlow, type NodeComponent } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { toPng } from 'html-to-image'
import { ArrowDown, ArrowRight, ImageDown, Maximize2, Minimize2, Plus, Unlink } from 'lucide-vue-next'
import { markRaw, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import { db } from '../notebook'
import { RECORD_FIELDS } from '../record-fields'
import RecordPicker from '../RecordPicker.vue'
import { RECORD_TYPES, type RecordType } from '../record-types'
import { createRecord, getRecord, updateRecord, type Rec, type Titled } from '../records'
import { greyEdge, NODE_TYPE, nextId, parseCanvas, serialiseCanvas } from './canvas'
import DiagramNode from './DiagramNode.vue'
import FillPicker from './FillPicker.vue'
import type { FillName } from './fills'
import { fullScreen } from './full-screen'
import { linkOf, unlinked, withLiveTitles } from './links'
import { tidy, type Direction } from './layout'

// The Record page is keyed by Record, so this mounts once per opened Diagram.
const props = defineProps<{ id: number; record: Rec }>()

// The cast: the Node component declares only the props it uses.
const nodeTypes = { [NODE_TYPE]: markRaw(DiagramNode) as unknown as NodeComponent }
const flowId = `diagram-${props.id}`
const {
  nodes,
  edges,
  viewport,
  dimensions,
  getSelectedNodes,
  addNodes,
  addEdges,
  updateNode,
  updateNodeData,
  findEdge,
  findNode,
  setNodes,
  setEdges,
  setViewport,
  toObject,
  fitView,
  onPaneReady,
  onConnect,
  onNodeContextMenu,
  onEdgeDoubleClick,
} = useVueFlow(flowId)

// --- Save and restore: the canvas JSON lives in `diagram.canvas` and rides the normal autosave.

const ready = ref(false)
// Each save refreshes the title snapshot of the linked Nodes.
const snapshot = () => {
  const canvas = toObject()
  return serialiseCanvas({ ...canvas, nodes: withLiveTitles(canvas.nodes) })
}
let last = ''
// A restore or a reload swaps the database while this is still mounted: its canvas belongs to the old one.
const loadedFrom = db.value

function save() {
  if (!ready.value || db.value !== loadedFrom) return
  const json = snapshot()
  if (json === last) return
  last = json
  updateRecord('diagram', props.id, { canvas: json })
}

// Not fromObject: it drops a pan of exactly 0. The viewport can only be set once the pane exists.
onPaneReady(() => {
  const saved = parseCanvas(props.record.canvas as string | null)
  setNodes(saved.nodes)
  setEdges(saved.edges)
  setViewport(saved.viewport)
  last = snapshot()
  ready.value = true
})

// Every change to Nodes, Edges or the viewport ends up here; a drag is saved when it pauses.
watch(() => ready.value && snapshot(), useDebounceFn(save, 300))
onBeforeUnmount(() => {
  save()
  fullScreen.value = false
})

// --- Editing

function addNode() {
  const { x, y, zoom } = viewport.value
  // Near the middle of what is visible, stepped so Nodes added in a row don't hide each other.
  const step = (nodes.value.length % 10) * 16
  addNodes({
    id: nextId(nodes.value),
    type: NODE_TYPE,
    position: {
      x: (dimensions.value.width / 2 - x) / zoom - 40 + step,
      y: (dimensions.value.height / 2 - y) / zoom - 16 + step,
    },
    data: { label: '' },
  })
}

onConnect((connection) => addEdges(greyEdge({ ...connection, id: nextId(edges.value) })))

// Double-clicking an Edge asks for its label in a dialog.
const labelling = ref<{ id: string; text: string } | null>(null)
onEdgeDoubleClick(({ edge }) => (labelling.value = { id: edge.id, text: String(edge.label ?? '') }))
function saveLabel() {
  const { id, text } = labelling.value!
  labelling.value = null
  const edge = findEdge(id)
  if (edge) edge.label = text.trim() || undefined
}

function setFill(ids: string[], fill: FillName | null) {
  // An undefined fill is left out of the saved JSON.
  for (const id of ids) updateNodeData(id, { fill: fill ?? undefined })
}
const selectedIds = () => getSelectedNodes.value.map((n) => n.id)

// The right-click menu acts on the whole selection when the clicked Node is part of it.
const menu = ref<{ x: number; y: number; ids: string[] } | null>(null)
onNodeContextMenu(({ event, node }) => {
  event.preventDefault()
  const { clientX, clientY } = event as MouseEvent
  // Kept on screen: the menu is at most this big.
  const x = Math.max(0, Math.min(clientX, innerWidth - 250))
  const y = Math.max(0, Math.min(clientY, innerHeight - 150))
  menu.value = { x, y, ids: node.selected ? selectedIds() : [node.id] }
})
useEventListener(window, 'click', () => (menu.value = null))

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  if (menu.value) menu.value = null
  else fullScreen.value = false
})

// --- Links to Records: offered for one Node at a time.

const menuNode = () => (menu.value?.ids.length === 1 ? findNode(menu.value.ids[0]) : undefined)
const makeType = ref<RecordType>('system')

function link(id: string, { type, id: recordId, title }: Titled) {
  updateNodeData(id, { recordType: type, recordId, label: title })
  menu.value = null
}
// The Node's text becomes the new Record's title.
function makeRecord(id: string) {
  const title = String(findNode(id)!.data.label).trim()
  link(id, { type: makeType.value, id: createRecord(makeType.value, title), title })
}

// The Node keeps the Record's title as its own text; the Record itself is untouched.
function unlink(id: string) {
  const link = linkOf(findNode(id)!.data)!
  updateNodeData(id, (n) => unlinked(n.data, getRecord(link.type, link.id)?.title), { replace: true })
  menu.value = null
}

function runTidy(direction: Direction) {
  const positions = tidy(
    nodes.value.map((n) => ({ id: n.id, ...n.dimensions })),
    edges.value,
    direction,
  )
  const [targetPosition, sourcePosition] =
    direction === 'LR' ? [Position.Left, Position.Right] : [Position.Top, Position.Bottom]
  for (const n of nodes.value) updateNode(n.id, { position: positions[n.id], targetPosition, sourcePosition })
  // A frame later, once Vue Flow has taken in the new positions.
  requestAnimationFrame(() => fitView())
}

// --- Export PNG: the whole Diagram, always in the light shades.

const root = useTemplateRef('root')
const exporting = ref(false)

const labelParts = () => root.value!.querySelectorAll<SVGElement>('.vue-flow__edge-textbg, .vue-flow__edge-text')

async function exportPng() {
  const before = { ...viewport.value }
  exporting.value = true // switches the canvas to its light colors, see the styles below
  try {
    // html-to-image only captures what is in view.
    await fitView({ padding: 0.1 })
    await new Promise(requestAnimationFrame)
    // html-to-image loses what CSS gives SVG, so the label parts get it inline for the capture.
    for (const el of labelParts()) Object.assign(el.style, { fill: getComputedStyle(el).fill, fontSize: getComputedStyle(el).fontSize })
    const url = await toPng(root.value!.querySelector<HTMLElement>('.vue-flow')!, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      skipFonts: true,
      // Controls and minimap are panels.
      filter: (el) => !el.classList?.contains('vue-flow__panel'),
    })
    Object.assign(document.createElement('a'), { href: url, download: `${props.record.title}.png` }).click()
  } finally {
    for (const el of labelParts()) Object.assign(el.style, { fill: '', fontSize: '' })
    exporting.value = false
    setViewport(before)
  }
}

const tool =
  'flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent disabled:opacity-40 [&>svg]:size-3.5'
</script>

<template>
  <!-- Full screen covers the page column; left-56 is the sidebar's width. -->
  <section
    ref="root"
    data-testid="diagram-canvas"
    :data-ready="ready"
    class="diagram-canvas flex flex-col bg-background"
    :class="[fullScreen ? 'fixed inset-y-0 right-0 left-56 z-10' : 'h-[32rem] rounded-md border', { exporting }]"
  >
    <div class="flex flex-wrap items-center gap-1 border-b p-1">
      <button type="button" :class="tool" @click="addNode"><Plus />Add Node</button>
      <FillPicker class="px-2" :disabled="!getSelectedNodes.length" @pick="setFill(selectedIds(), $event)" />
      <button type="button" :class="tool" aria-label="Tidy left to right" title="Tidy left to right" @click="runTidy('LR')">
        Tidy<ArrowRight />
      </button>
      <button type="button" :class="tool" aria-label="Tidy top down" title="Tidy top down" @click="runTidy('TB')">
        Tidy<ArrowDown />
      </button>
      <span class="flex-1" />
      <button type="button" :class="tool" @click="exportPng"><ImageDown />Export PNG</button>
      <button type="button" :class="tool" :aria-pressed="fullScreen" @click="fullScreen = !fullScreen">
        <component :is="fullScreen ? Minimize2 : Maximize2" />Full screen
      </button>
    </div>

    <VueFlow :id="flowId" :node-types="nodeTypes" :delete-key-code="['Backspace', 'Delete']" class="flex-1">
      <Background />
      <Controls />
      <MiniMap pannable zoomable :width="120" :height="80" />
    </VueFlow>

    <div
      v-if="menu"
      role="menu"
      aria-label="Node"
      class="fixed z-20 flex flex-col gap-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
    >
      <span class="text-xs text-muted-foreground">Fill</span>
      <FillPicker @pick="setFill(menu.ids, $event)" />
      <!-- click.stop: a click in here must not close the menu the way one elsewhere does. -->
      <div v-if="menuNode()" class="flex w-56 flex-col gap-1" @click.stop>
        <span class="text-xs text-muted-foreground">Record</span>
        <form
          v-if="!linkOf(menuNode()!.data) && menuNode()!.data.label.trim()"
          data-testid="make-record"
          class="flex gap-1"
          @submit.prevent="makeRecord(menu.ids[0])"
        >
          <select
            v-model="makeType"
            data-testid="make-record-type"
            aria-label="Type of the new Record"
            class="h-6 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
          >
            <option v-for="t in RECORD_TYPES" :key="t.type" :value="t.type">{{ RECORD_FIELDS[t.type].singular }}</option>
          </select>
          <button type="submit" class="h-6 shrink-0 rounded-md border px-2 text-xs hover:bg-accent hover:text-accent-foreground">
            Make Record
          </button>
        </form>
        <button
          v-if="linkOf(menuNode()!.data)"
          type="button"
          role="menuitem"
          data-testid="unlink-node"
          class="flex h-6 items-center gap-1 rounded-md border px-2 text-xs hover:bg-accent hover:text-accent-foreground"
          @click="unlink(menu.ids[0])"
        >
          <Unlink class="size-3" />
          Unlink
        </button>
        <RecordPicker label="Link to a Record" @pick="link(menu.ids[0], $event)" />
      </div>
    </div>

    <ConfirmDialog
      v-if="labelling"
      data-testid="edge-label-dialog"
      title="Edge label"
      confirm-label="Save"
      @confirm="saveLabel"
      @cancel="labelling = null"
    >
      <input
        v-model="labelling.text"
        data-testid="edge-label-input"
        aria-label="Edge label"
        placeholder="No label"
        class="h-8 w-full rounded-md border bg-background px-2"
      />
    </ConfirmDialog>
  </section>
</template>

<style>
/* Own variables rather than the theme tokens, so the PNG export can be light in dark mode. */
.diagram-canvas {
  --dg-bg: #ffffff;
  --dg-node: #ffffff;
  --dg-text: #18181b;
  --dg-border: #a1a1aa;
  /* The theme's primary, the one accent color. */
  --dg-link: #18181b;
}
.dark .diagram-canvas:not(.exporting) {
  --dg-bg: #18181b;
  --dg-node: #27272a;
  --dg-text: #fafafa;
  --dg-border: #71717a;
  --dg-link: #e4e4e7;
}
.diagram-canvas .vue-flow {
  background: var(--dg-bg);
}
.diagram-node {
  min-width: 4rem;
  max-width: 14rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--dg-border);
  border-radius: 0.375rem;
  background: var(--fill-light, var(--dg-node));
  color: var(--dg-text);
  font-size: 0.75rem;
  text-align: center;
}
.diagram-node.linked {
  border: 2px solid var(--dg-link);
}
.dark .diagram-canvas:not(.exporting) .diagram-node {
  background: var(--fill-dark, var(--dg-node));
}
.diagram-canvas:not(.exporting) .vue-flow__node.selected .diagram-node {
  box-shadow: 0 0 0 2px var(--ring);
}
.diagram-canvas .vue-flow__edge-textbg {
  fill: var(--dg-bg);
}
.diagram-canvas .vue-flow__edge-text {
  fill: var(--dg-text);
}
.diagram-canvas .vue-flow__edge.selected .vue-flow__edge-path {
  stroke-width: 2.5 !important;
}
.dark .diagram-canvas .vue-flow__controls-button,
.dark .diagram-canvas .vue-flow__minimap {
  background: #27272a;
  border-color: #3f3f46;
  fill: #fafafa;
}
.dark .diagram-canvas .vue-flow__minimap-mask {
  fill: rgb(9 9 11 / 0.6);
}
.dark .diagram-canvas .vue-flow__minimap-node {
  fill: #71717a;
}
.dark .diagram-canvas .vue-flow__controls-button:hover {
  background: #3f3f46;
}
</style>
