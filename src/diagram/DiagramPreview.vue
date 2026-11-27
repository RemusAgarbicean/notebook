<script setup lang="ts">
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { VueFlow, type EdgeComponent, type NodeComponent } from '@vue-flow/core'
import { computed, markRaw } from 'vue'
import { getRecord } from '../records'
import { FRAME_TYPE, NODE_TYPE, parseCanvas } from './canvas'
import DiagramEdge from './DiagramEdge.vue'
import DiagramFrame from './DiagramFrame.vue'
import DiagramNode from './DiagramNode.vue'

// A Diagram drawn as a picture on another Record's page: fitted to its box, nothing to select, drag or edit.
// The look comes from DiagramCanvas's CSS, through the `diagram-canvas` class.
const props = defineProps<{ id: number; /** Unique on the page, so two previews never share a Vue Flow store. */ flowId: string }>()

const nodeTypes = {
  [NODE_TYPE]: markRaw(DiagramNode) as unknown as NodeComponent,
  [FRAME_TYPE]: markRaw(DiagramFrame) as unknown as NodeComponent,
}
const edgeTypes = { default: markRaw(DiagramEdge) as unknown as EdgeComponent }

const canvas = computed(() => parseCanvas(getRecord('diagram', props.id)?.canvas as string | null))
</script>

<template>
  <div class="diagram-canvas h-full">
    <VueFlow
      :id="flowId"
      :nodes="canvas.nodes"
      :edges="canvas.edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :pan-on-drag="false"
      :zoom-on-scroll="false"
      :zoom-on-pinch="false"
      :zoom-on-double-click="false"
      :prevent-scrolling="false"
      :min-zoom="0.1"
      :max-zoom="1"
      fit-view-on-init
      class="h-full"
    />
  </div>
</template>
