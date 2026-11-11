<script setup lang="ts">
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { Position, useVueFlow, VueFlow, type Edge, type EdgeComponent, type GraphNode, type Node, type NodeComponent } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { toPng } from 'html-to-image'
import { ArrowDown, ArrowRight, ImageDown, Maximize2, Minimize2, Plus, Redo2, SquareMenu, Undo2, Unlink } from 'lucide-vue-next'
import { markRaw, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import { focusable, vDialog } from '../dialog'
import { db } from '../notebook'
import { shortcut } from '../platform'
import { RECORD_FIELDS } from '../record-fields'
import RecordPicker from '../RecordPicker.vue'
import { RECORD_TYPES, type RecordType } from '../record-types'
import { createRecord, getRecord, updateRecord, type Rec, type Titled } from '../records'
import { childPosition, type Box } from './arrange'
import { clipOf, held, hold, pasted, type Clip } from './clipboard'
import { greyEdge, MAX_ZOOM, MIN_ZOOM, NODE_TYPE, nextId, parseCanvas, serialiseCanvas, viewportFor, type NodeData } from './canvas'
import DiagramEdge from './DiagramEdge.vue'
import DiagramNode from './DiagramNode.vue'
import FillPicker from './FillPicker.vue'
import type { FillName } from './fills'
import { fullScreen } from './full-screen'
import { editRequest, gestures } from './interaction'
import { linkOf, unlinked, withLiveTitles } from './links'
import ShapePicker from './ShapePicker.vue'
import type { ShapeName } from './shapes'
import { tidy, type Direction } from './layout'
import { record, redo, startHistory, undo } from './undo'

// The Record page is keyed by Record, so this mounts once per opened Diagram.
const props = defineProps<{ id: number; record: Rec }>()

// The cast: the Node component declares only the props it uses.
const nodeTypes = { [NODE_TYPE]: markRaw(DiagramNode) as unknown as NodeComponent }
// Every Edge is drawn by ours; `default` is the type of an Edge that names none, so nothing is stored.
const edgeTypes = { default: markRaw(DiagramEdge) as unknown as EdgeComponent }
const flowId = `diagram-${props.id}`
const {
  nodes,
  edges,
  viewport,
  dimensions,
  getSelectedNodes,
  getSelectedEdges,
  addSelectedEdges,
  addSelectedNodes,
  removeSelectedElements,
  screenToFlowCoordinate,
  setCenter,
  onConnectStart,
  onConnectEnd,
  removeNodes,
  removeEdges,
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
  onNodeDragStart,
  onNodeDragStop,
  onSelectionDragStart,
  onSelectionDragStop,
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
  history.value = startHistory(content())
  gestures.value = 0
  ready.value = true
})

// Every change to Nodes, Edges or the viewport ends up here; a drag is saved when it pauses.
watch(() => ready.value && snapshot(), useDebounceFn(save, 300))
onBeforeUnmount(() => {
  save()
  fullScreen.value = false
})

// --- Undo and redo: snapshots of the Nodes and Edges, kept while this Diagram is open. Panning and zooming are not steps.

const content = () => serialiseCanvas({ ...toObject(), viewport: {} })
const history = shallowRef(startHistory(''))
// The canvas as an undo or redo just set it is not a change of its own.
let travelling = false

function commit() {
  if (ready.value && !gestures.value) history.value = record(history.value, content())
}
watch(
  () => ready.value && content(),
  (now) => {
    if (travelling && now) history.value = { ...history.value, present: now }
    else commit()
    travelling = false
  },
)
// A drag, a resize or typing a text is one step, taken when it ends.
watch(gestures, commit)
for (const on of [onNodeDragStart, onSelectionDragStart]) on(() => void gestures.value++)
for (const on of [onNodeDragStop, onSelectionDragStop]) on(() => void gestures.value--)

const flowEl = () => root.value?.querySelector<HTMLElement>('.vue-flow')
// Whatever had the focus may be gone or disabled now; the keys must still reach the Diagram, not the page behind it.
const keepFocus = () => nextTick(() => root.value?.contains(document.activeElement) || flowEl()?.focus({ preventScroll: true }))

function travel(step: typeof undo) {
  endNudge()
  const to = step(history.value)
  if (to === history.value) return
  history.value = to
  travelling = true
  const { nodes, edges } = parseCanvas(to.present)
  setNodes(nodes)
  setEdges(edges)
  keepFocus()
}

// --- Editing

const box = (n: GraphNode): Box => ({ ...n.position, ...n.dimensions })
const select = (ids: string[]) => {
  removeSelectedElements()
  addSelectedNodes(ids.map((id) => findNode(id)!))
}
// Brings a spot of the canvas into view when it is outside it.
function reveal({ x, y }: { x: number; y: number }) {
  const { x: left, y: top, zoom } = viewport.value
  const [sx, sy] = [x * zoom + left, y * zoom + top]
  const { width, height } = dimensions.value
  if (sx < 40 || sy < 40 || sx > width - 160 || sy > height - 80) setCenter(x, y, { zoom, duration: 200 })
}

/** Adds a Node, selects it and, when it has no text yet, opens it for typing. */
function newNode(position: { x: number; y: number }, data: NodeData = { label: '' }, more: Partial<Node> = {}) {
  const id = nextId(nodes.value)
  if (!data.label) editText(id)
  addNodes({ id, type: NODE_TYPE, position, data, ...more })
  select([id])
  reveal(position)
  return id
}
// The top-left corner for a new Node whose middle should be at a point of the view (its centre when none is given).
function spot(at?: { clientX: number; clientY: number }) {
  const frame = flowEl()!.getBoundingClientRect()
  const { x, y } = screenToFlowCoordinate(
    at ? { x: at.clientX, y: at.clientY } : { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2 },
  )
  return { x: x - 40, y: y - 17 }
}
// In the middle of the view, stepped so Nodes added in a row don't hide each other.
function addNode(data?: NodeData) {
  const { x, y } = spot()
  const step = (nodes.value.length % 10) * 16
  newNode({ x: x + step, y: y + step }, data)
}
// A Node linked to the Record; one that is on the Diagram already is simply there twice.
const addRecord = ({ type, id, title }: Titled) => addNode({ label: title, recordType: type, recordId: id })
function onDoubleClick(e: MouseEvent) {
  if ((e.target as Element).classList.contains('vue-flow__pane')) newNode(spot(e))
}

// Opens a new Node's text for typing. Adding it and typing its text are one undo step: the Node ends the gesture.
function editText(id: string) {
  gestures.value++
  editRequest.value = id
}

const newEdge = (ends: { source: string; target: string }) => greyEdge({ ...ends, id: nextId(edges.value) })
// A connection let go over the empty canvas makes the Node it should end at.
let connecting: { nodeId?: string; handleType?: string } | null = null
onConnectStart((from) => (connecting = from))
onConnect((connection) => {
  connecting = null
  addEdges(newEdge(connection))
})
onConnectEnd((event) => {
  const from = connecting
  connecting = null
  const at = event && ('changedTouches' in event ? event.changedTouches[0] : event)
  if (!from?.nodeId || !at || !(at.target as Element).classList?.contains('vue-flow__pane')) return
  const id = newNode(spot(at))
  addEdges(newEdge(from.handleType === 'target' ? { source: id, target: from.nodeId } : { source: from.nodeId, target: id }))
})

// Tab: a child of the selected Node, placed the way Tidy last ran (or the way the Node already points).
let lastTidy: Direction = 'LR'
function addChild(parent: GraphNode) {
  const direction = parent.sourcePosition === Position.Right ? 'LR' : parent.sourcePosition === Position.Bottom ? 'TB' : lastTidy
  const children = edges.value.filter((e) => e.source === parent.id).flatMap((e) => findNode(e.target) ?? [])
  const sides = direction === 'LR' ? { targetPosition: Position.Left, sourcePosition: Position.Right } : {}
  if (direction === 'LR') updateNode(parent.id, { sourcePosition: Position.Right })
  const id = newNode(childPosition(box(parent), children.map(box), direction), { label: '' }, sides)
  addEdges(newEdge({ source: parent.id, target: id }))
}

// --- Copy, cut, paste and duplicate, with the Diagram's own clipboard.

function selection() {
  const { nodes, edges } = parseCanvas(content())
  return clipOf(nodes, edges, selectedIds())
}
function add(clip: Clip) {
  addNodes(clip.nodes as Node[])
  addEdges((clip.edges as Edge[]).map(greyEdge))
  select(clip.nodes.map((n) => n.id))
  keepFocus()
}
function copy() {
  if (selectedIds().length) hold(selection(), loadedFrom)
  pastes = 0
}
function cut() {
  copy()
  removeNodes(getSelectedNodes.value)
  keepFocus()
}
// Each paste of the same clip lands a step further on.
let pastes = 0
function paste() {
  const clip = held(loadedFrom)
  if (!clip?.nodes.length) return
  // Its top-left Node goes near the middle of the view.
  const { x, y } = spot()
  const step = pastes++ * 16 - 60
  add(pasted(clip, nodes.value, edges.value, {
    x: x + step - Math.min(...clip.nodes.map((n) => n.position.x)),
    y: y + step - Math.min(...clip.nodes.map((n) => n.position.y)),
  }))
}
const duplicate = () => add(pasted(selection(), nodes.value, edges.value, { x: 24, y: 24 }))

// The arrow keys move the selection: a small step, a larger one with Shift. Held down, the moves are one undo step.
const NUDGE = 4
let nudging = false
function endNudge() {
  if (nudging) gestures.value--
  nudging = false
}
const nudgeSoonOver = useDebounceFn(endNudge, 400)
function onNudge(e: KeyboardEvent) {
  const by = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
  if (!by || !getSelectedNodes.value.length || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
  // Vue Flow's own arrow keys (another step, and only with the focus on a Node) are not to run as well.
  e.preventDefault()
  e.stopPropagation()
  if (!nudging) gestures.value++
  nudging = true
  const step = NUDGE * (e.shiftKey ? 4 : 1)
  for (const n of getSelectedNodes.value) n.position = { x: n.position.x + by[0] * step, y: n.position.y + by[1] * step }
  nudgeSoonOver()
}

// Double-clicking an Edge, or Enter on a selected one, asks for its label in a dialog.
const labelling = ref<{ id: string; text: string } | null>(null)
const editLabel = (edge: { id: string; label?: unknown }) => (labelling.value = { id: edge.id, text: String(edge.label ?? '') })
onEdgeDoubleClick(({ edge }) => editLabel(edge))
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
// The rectangle is the shape of a Node that names none.
function setShape(ids: string[], shape: ShapeName) {
  for (const id of ids) updateNodeData(id, { shape: shape === 'rectangle' ? undefined : shape })
}
const selectedIds = () => getSelectedNodes.value.map((n) => n.id)

// The Node menu acts on the whole selection when the clicked Node is part of it.
const menu = ref<{ x: number; y: number; ids: string[] } | null>(null)
const menuEl = useTemplateRef('menuEl')
const nodeEl = (id: string) => root.value?.querySelector<HTMLElement>(`.vue-flow__node[data-id="${CSS.escape(id)}"]`)

function openMenu(ids: string[], clientX: number, clientY: number) {
  // The Node takes the focus first, so closing the menu gives it back to the canvas.
  nodeEl(ids[0])?.focus({ preventScroll: true })
  // Kept on screen: the menu is at most this big.
  const x = Math.max(0, Math.min(clientX, innerWidth - 250))
  const y = Math.max(0, Math.min(clientY, innerHeight - 200))
  menu.value = { x, y, ids }
  nextTick(() => menuEl.value && focusable(menuEl.value)[0]?.focus())
}
onNodeContextMenu(({ event, node }) => {
  event.preventDefault()
  const { clientX, clientY } = event as MouseEvent
  openMenu(node.selected ? selectedIds() : [node.id], clientX, clientY)
})
// From the keyboard or the toolbar: the menu of the selection, under its first Node.
let openedByKey = 0
function openSelectionMenu() {
  const ids = selectedIds()
  if (!ids.length) return
  const at = nodeEl(ids[0])?.getBoundingClientRect()
  openMenu(ids, at?.left ?? 0, (at?.bottom ?? 0) + 4)
  openedByKey = Date.now()
}
// The browser's own menu would follow the context-menu key and cover ours.
function onContextMenu(e: Event) {
  if (Date.now() - openedByKey > 1000) return
  e.preventDefault()
  e.stopPropagation()
}
useEventListener(window, 'click', () => (menu.value = null))

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

// The arrow keys walk the menu's controls; a text box or a select keeps them for itself, and Tab moves on.
function onMenuKey(e: KeyboardEvent) {
  // A plain key in the menu is not one of the page's single-key shortcuts; Esc and Ctrl+K or S still pass.
  if (e.key !== 'Escape' && !e.ctrlKey && !e.metaKey) e.stopPropagation()
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
  if (!step || typing(e.target)) return
  e.preventDefault()
  const stops = focusable(menuEl.value!)
  stops[(stops.indexOf(document.activeElement as HTMLElement) + step + stops.length) % stops.length]?.focus()
}

// The canvas's own keys, on top of Vue Flow's (Tab to a Node, Space or Enter selects it, the arrows move it).
// They count only while the focus is on the canvas, and never while typing a Node's text.
function onCanvasKey(e: KeyboardEvent) {
  if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
  const [picked, pickedEdges] = [getSelectedNodes.value, getSelectedEdges.value]
  let handled = true
  // Vue Flow means to select an Edge on Space or Enter, but binds the key under a name that never fires.
  const tabbed = e.target instanceof Element && findEdge(e.target.closest('.vue-flow__edge')?.getAttribute('data-id') ?? '')
  if (tabbed && !e.shiftKey && [' ', 'Enter', 'F2'].includes(e.key)) {
    addSelectedEdges([tabbed])
    if (e.key !== ' ') editLabel(tabbed)
  } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) openSelectionMenu()
  else if (e.shiftKey) handled = false
  // Only with the focus on that Node or on the canvas: from any other Node, Tab moves on as it always does.
  else if (e.key === 'Tab' && picked.length === 1 && !pickedEdges.length && [nodeEl(picked[0].id), flowEl()].includes(e.target as HTMLElement))
    addChild(picked[0])
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    removeNodes(picked)
    removeEdges(pickedEdges)
    keepFocus()
  } else if ((e.key === 'Enter' || e.key === 'F2') && picked.length === 1 && !pickedEdges.length)
    // The same as a double-click: edits a Node's text, or opens the Record of a linked one.
    nodeEl(picked[0].id)?.querySelector('.diagram-node')?.dispatchEvent(new MouseEvent('dblclick'))
  else if ((e.key === 'Enter' || e.key === 'F2') && pickedEdges.length === 1 && !picked.length) editLabel(pickedEdges[0])
  else handled = false
  if (handled) e.preventDefault()
}
// A click on the canvas gives it the focus, so the keys above follow the mouse.
function onCanvasPointerDown(e: PointerEvent) {
  const flow = e.currentTarget as HTMLElement
  if (!typing(e.target) && !flow.contains(document.activeElement)) flow.focus({ preventScroll: true })
}

// Ctrl or Cmd with a letter, anywhere in the Diagram area; a text box, the menu and the dialog keep theirs.
function onAreaKey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || typing(e.target) || menu.value || labelling.value) return
  const key = e.key.toLowerCase()
  const step = key === 'z' ? (e.shiftKey ? redo : undo) : key === 'y' && !e.shiftKey ? redo : null
  const action = step ? () => travel(step) : e.shiftKey ? null : { d: duplicate, c: copy, x: cut, v: paste }[key]
  if (!action) return
  e.preventDefault()
  action()
}

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
  lastTidy = direction
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
// Pixels of the canvas left free around the outermost Nodes and Edges.
const EXPORT_MARGIN = 32

const labelParts = () => root.value!.querySelectorAll<SVGElement>('.vue-flow__edge-textbg, .vue-flow__edge-text')

async function exportPng() {
  const before = { ...viewport.value }
  exporting.value = true // switches the canvas to its light colors, see the styles below
  // html-to-image fetches the images and fonts it comes across. A Diagram has none, and the app never goes online.
  const realFetch = window.fetch
  window.fetch = () => Promise.reject(new Error('The Notebook does not fetch anything.'))
  try {
    // html-to-image only captures what is in view. Not fitView: it fits the Nodes and lets an Edge that bows out past them be cut off.
    const flow = root.value!.querySelector<HTMLElement>('.vue-flow')!
    const frame = flow.getBoundingClientRect()
    const { x, y, zoom } = viewport.value
    const rects = [...flow.querySelectorAll('.vue-flow__node, .vue-flow__edge-path, .vue-flow__edge-textwrapper')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width || r.height)
    if (rects.length) {
      const [left, top, right, bottom] = [
        Math.min(...rects.map((r) => r.left)),
        Math.min(...rects.map((r) => r.top)),
        Math.max(...rects.map((r) => r.right)),
        Math.max(...rects.map((r) => r.bottom)),
      ]
      // From screen to canvas coordinates.
      const bounds = { x: (left - frame.left - x) / zoom, y: (top - frame.top - y) / zoom, width: (right - left) / zoom, height: (bottom - top) / zoom }
      await setViewport(viewportFor(bounds, frame, EXPORT_MARGIN))
    }
    await new Promise(requestAnimationFrame)
    // html-to-image loses what CSS gives SVG, so the label parts get it inline for the capture.
    for (const el of labelParts()) Object.assign(el.style, { fill: getComputedStyle(el).fill, fontSize: getComputedStyle(el).fontSize })
    const url = await toPng(flow, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      skipFonts: true,
      // Controls and minimap are panels.
      filter: (el) => !el.classList?.contains('vue-flow__panel'),
    })
    Object.assign(document.createElement('a'), { href: url, download: `${props.record.title}.png` }).click()
  } finally {
    window.fetch = realFetch
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
    @contextmenu.capture="onContextMenu"
    @keydown="onAreaKey"
    :class="[fullScreen ? 'fixed inset-y-0 right-0 left-56 z-10' : 'h-[32rem] rounded-md border', { exporting }]"
  >
    <div class="flex flex-wrap items-center gap-1 border-b p-1">
      <button type="button" :class="tool" aria-label="Undo" :title="`Undo (${shortcut('Z')})`" :disabled="!history.past.length" @click="travel(undo)">
        <Undo2 />
      </button>
      <button type="button" :class="tool" aria-label="Redo" :title="`Redo (${shortcut('Shift Z')})`" :disabled="!history.future.length" @click="travel(redo)">
        <Redo2 />
      </button>
      <button type="button" :class="tool" aria-label="Add Node" @click="addNode()"><Plus />Add Node</button>
      <RecordPicker data-testid="add-record" class="w-32" label="Add Record" @pick="addRecord" />
      <FillPicker class="px-2" :disabled="!getSelectedNodes.length" @pick="setFill(selectedIds(), $event)" />
      <ShapePicker :disabled="!getSelectedNodes.length" @pick="setShape(selectedIds(), $event)" />
      <!-- click.stop: the click that opens the menu must not close it the way one elsewhere does. -->
      <button
        type="button"
        data-testid="node-menu-button"
        :class="tool"
        aria-haspopup="menu"
        aria-label="Node menu"
        :disabled="!getSelectedNodes.length"
        title="Node menu: fill, Link, Make Record (Shift+F10)"
        @click.stop="openSelectionMenu"
      >
        <SquareMenu />
      </button>
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

    <VueFlow
      :id="flowId"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :min-zoom="MIN_ZOOM"
      :max-zoom="MAX_ZOOM"
      :delete-key-code="null"
      :zoom-on-double-click="false"
      tabindex="-1"
      class="flex-1 outline-none"
      @keydown="onCanvasKey"
      @keydown.capture="onNudge"
      @dblclick="onDoubleClick"
      @pointerdown.capture="onCanvasPointerDown"
    >
      <Background />
      <Controls />
      <MiniMap pannable zoomable :width="120" :height="80" />
    </VueFlow>

    <div
      v-if="menu"
      ref="menuEl"
      v-dialog
      role="menu"
      aria-label="Node"
      class="fixed z-20 flex flex-col gap-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @keydown="onMenuKey"
    >
      <span class="text-xs text-muted-foreground">Fill</span>
      <FillPicker @pick="setFill(menu.ids, $event)" />
      <span class="text-xs text-muted-foreground">Shape</span>
      <ShapePicker @pick="setShape(menu.ids, $event)" />
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
  --node-bg: var(--fill-light, var(--dg-node));
  --node-line: var(--dg-border);
  --node-line-width: 1px;
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 4rem;
  max-width: 14rem;
  padding: 0.5rem 0.75rem;
  border: var(--node-line-width) solid var(--node-line);
  border-radius: 0.375rem;
  background: var(--node-bg);
  color: var(--dg-text);
  font-size: 0.75rem;
  text-align: center;
}
.diagram-node.linked {
  --node-line: var(--dg-link);
  --node-line-width: 2px;
}
.dark .diagram-canvas:not(.exporting) .diagram-node {
  --node-bg: var(--fill-dark, var(--dg-node));
}
.node-text {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.node-text-input {
  width: 100%;
  min-width: 6rem;
  resize: none;
  text-align: inherit;
  field-sizing: content;
}
/* The shapes. The rectangle is the Node as it is above. */
.diagram-node.pill {
  padding-inline: 1rem;
  border-radius: 9999px;
}
.diagram-node.note {
  --node-bg: var(--fill-light, transparent);
  justify-content: flex-start;
  text-align: left;
}
.dark .diagram-canvas:not(.exporting) .diagram-node.note {
  --node-bg: var(--fill-dark, transparent);
}
.diagram-node.note:not(.linked),
.diagram-node.diamond,
.diagram-node.cylinder {
  border-color: transparent;
}
/* Drawn behind the text by two layers: the line, and the fill inside it. */
.diagram-node.diamond,
.diagram-node.cylinder {
  background: none;
}
.diagram-node.diamond::before,
.diagram-node.diamond::after,
.diagram-node.cylinder::before,
.diagram-node.cylinder::after {
  position: absolute;
  z-index: -1;
  content: '';
}
.diagram-node.diamond {
  padding: 1.1rem 2rem;
}
.diagram-node.diamond::before,
.diagram-node.diamond::after {
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}
.diagram-node.diamond::before {
  inset: calc(-1 * var(--node-line-width));
  background: var(--node-line);
}
.diagram-node.diamond::after {
  inset: calc(0.5 * var(--node-line-width));
  background: var(--node-bg);
}
.diagram-node.cylinder {
  --cap: 0.45rem;
  padding-top: 1.15rem;
  padding-bottom: 0.6rem;
}
.diagram-node.cylinder::before {
  inset: calc(-1 * var(--node-line-width));
  border: var(--node-line-width) solid var(--node-line);
  border-radius: 50% / var(--cap);
  background: var(--node-bg);
}
/* The lid: a whole ellipse over the top edge. */
.diagram-node.cylinder::after {
  inset: calc(-1 * var(--node-line-width)) calc(-1 * var(--node-line-width)) auto;
  height: calc(2 * var(--cap));
  border: var(--node-line-width) solid var(--node-line);
  border-radius: 50%;
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
/* Where the Tab key is: Vue Flow's theme removes the outline and offers nothing for custom Nodes or styled Edges. */
.diagram-canvas:not(.exporting) .vue-flow__node:focus-visible .diagram-node {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.diagram-canvas:not(.exporting) .vue-flow__edge:focus-visible {
  outline: none;
}
.diagram-canvas:not(.exporting) .vue-flow__edge:focus-visible .vue-flow__edge-path {
  stroke: var(--dg-text) !important;
  stroke-dasharray: 5 3;
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
