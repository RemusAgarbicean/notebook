<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { computed, useTemplateRef } from 'vue'
import { openRecord } from '../navigation'
import { recordType } from '../record-types'
import { getRecord } from '../records'
import type { NodeData } from './canvas'
import { fillVars } from './fills'
import { useLabelEdit } from './label-edit'
import { linkOf } from './links'
import ResizeHandles from './ResizeHandles.vue'
import { shapeOf } from './shapes'

// Vue Flow passes many more props than these; they must not land on the element.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id: string
  data: NodeData
  selected?: boolean
  sourcePosition?: Position
  targetPosition?: Position
}>()

const input = useTemplateRef('input')
const root = useTemplateRef('root')
const { editing, edit, commit, end } = useLabelEdit(props.id, input, root)

// A resized Node keeps its width and grows downwards with its text.
const size = computed(() =>
  props.data.width ? { width: `${props.data.width}px`, minHeight: `${props.data.height ?? 0}px`, maxWidth: 'none' } : {},
)
const MIN_SIZE = { width: 48, height: 28 }

const link = computed(() => linkOf(props.data))
// A linked Node shows its Record's title as it is now; the saved label is only the fallback.
const label = computed(() => (link.value && getRecord(link.value.type, link.value.id)?.title) || props.data.label)

// A linked Node's text is its Record's title: double-clicking opens the Record instead.
const open = () => (link.value ? openRecord(link.value.type, link.value.id) : edit())
</script>

<template>
  <div
    ref="root"
    data-testid="diagram-node"
    data-edit
    class="diagram-node"
    :class="[shapeOf(data.shape), { linked: link }]"
    :style="[fillVars(data.fill), size]"
    @dblclick="open"
  >
    <Handle type="target" :position="targetPosition ?? Position.Top" />
    <!-- nodrag/nopan: typing and selecting text must not move the Node or the canvas. -->
    <!-- Enter ends the edit; Shift+Enter is a line break. -->
    <textarea
      v-if="editing"
      ref="input"
      aria-label="Node text"
      class="node-text-input nodrag nopan bg-transparent outline-none"
      rows="1"
      @blur="commit"
      @keydown.enter.exact.prevent="end(true)"
      @keydown.esc.stop="end(false)"
    />
    <span v-else class="node-text">
      <component :is="recordType(link.type).icon" v-if="link" class="mr-1 inline size-3.5 align-text-bottom" />
      {{ label || ' ' }}
    </span>
    <Handle type="source" :position="sourcePosition ?? Position.Bottom" />
    <ResizeHandles v-if="selected" :id="id" :min="MIN_SIZE" />
  </div>
</template>
