<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { NodeData } from './canvas'
import { fillVars } from './fills'
import { useLabelEdit } from './label-edit'
import ResizeHandles from './ResizeHandles.vue'

// A Frame: a titled rectangle behind the Nodes, for a swimlane or a group. It is moved by its title;
// the rest of it lets the mouse through to the canvas, so Nodes can be added, dragged and boxed inside it.
defineOptions({ inheritAttrs: false })
const props = defineProps<{ id: string; data: NodeData; selected?: boolean }>()

const input = useTemplateRef('input')
const root = useTemplateRef('root')
const { editing, edit, commit, end } = useLabelEdit(props.id, input, root)

const size = computed(() => ({ width: `${props.data.width ?? FRAME_SIZE.width}px`, height: `${props.data.height ?? FRAME_SIZE.height}px` }))
</script>

<script lang="ts">
/** The size of a Frame added to an empty spot, and the smallest it can be made. */
export const FRAME_SIZE = { width: 320, height: 200 }
const MIN_SIZE = { width: 96, height: 64 }
</script>

<template>
  <div ref="root" data-testid="diagram-frame" class="diagram-frame" :class="{ filled: data.fill }" :style="[fillVars(data.fill), size]">
    <div data-edit class="diagram-frame-title" @dblclick="edit()">
      <input
        v-if="editing"
        ref="input"
        aria-label="Frame title"
        class="nodrag nopan w-full bg-transparent outline-none"
        @blur="commit"
        @keydown.enter.prevent="end(true)"
        @keydown.esc.stop="end(false)"
      />
      <template v-else>{{ data.label || 'Frame' }}</template>
    </div>
    <ResizeHandles v-if="selected" :id="id" :min="MIN_SIZE" />
  </div>
</template>

<style>
/* Behind the Edges and the Nodes, also while selected. Only its title and handles take the mouse. */
.diagram-canvas .vue-flow__node-frame {
  z-index: -1 !important;
  pointer-events: none !important;
}
.diagram-frame {
  position: relative;
  border: 1px solid var(--dg-border);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--fill-light, transparent) 35%, transparent);
  color: var(--dg-text);
  font-size: 0.75rem;
}
.dark .diagram-canvas:not(.exporting) .diagram-frame {
  background: color-mix(in srgb, var(--fill-dark, transparent) 30%, transparent);
}
.diagram-frame-title {
  height: 1.75rem;
  padding: 0.375rem 0.625rem;
  overflow: hidden;
  border-radius: 0.5rem 0.5rem 0 0;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: grab;
  pointer-events: auto;
}
.diagram-canvas:not(.exporting) .vue-flow__node-frame.selected .diagram-frame {
  box-shadow: 0 0 0 2px var(--ring);
}
.diagram-canvas:not(.exporting) .vue-flow__node-frame:focus-visible .diagram-frame {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
</style>
