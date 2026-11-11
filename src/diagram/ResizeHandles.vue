<script setup lang="ts">
import { useVueFlow } from '@vue-flow/core'
import { resize, type Box, type Corner } from './arrange'
import { GRID } from './canvas'
import { gestures } from './interaction'

// The four corner handles of a selected Node or Frame. The size goes into its data, as numbers.
const props = defineProps<{ id: string; min: { width: number; height: number } }>()
const { findNode, viewport, snapToGrid } = useVueFlow()

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
let from: { corner: Corner; x: number; y: number; box: Box } | null = null

function down(e: PointerEvent, corner: Corner) {
  const node = findNode(props.id)!
  from = { corner, x: e.clientX, y: e.clientY, box: { ...node.position, ...node.dimensions } }
  ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  gestures.value++
}
function move(e: PointerEvent) {
  const node = findNode(props.id)
  if (!from || !node) return
  const { zoom } = viewport.value
  const { x, y, width, height } = resize(from.box, from.corner, (e.clientX - from.x) / zoom, (e.clientY - from.y) / zoom, props.min, snapToGrid.value ? GRID : 0)
  node.position = { x, y }
  node.data = { ...node.data, width, height }
}
function up() {
  if (from) gestures.value--
  from = null
}
</script>

<template>
  <!-- nodrag/nopan: the drag is the resize, not a move of the Node or the canvas. -->
  <span
    v-for="c in CORNERS"
    :key="c"
    data-testid="resize-handle"
    class="resize-handle nodrag nopan"
    :class="c"
    @pointerdown.stop="down($event, c)"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
  />
</template>

<style>
.resize-handle {
  position: absolute;
  z-index: 1;
  width: 9px;
  height: 9px;
  border: 1px solid var(--dg-text);
  border-radius: 2px;
  background: var(--dg-bg);
  pointer-events: auto;
}
.resize-handle.nw {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.resize-handle.se {
  right: -5px;
  bottom: -5px;
  cursor: nwse-resize;
}
.resize-handle.ne {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.resize-handle.sw {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}
.diagram-canvas.exporting .resize-handle {
  display: none;
}
</style>
