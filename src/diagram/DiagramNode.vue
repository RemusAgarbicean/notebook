<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { until } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { openRecord } from '../navigation'
import { recordType } from '../record-types'
import { getRecord } from '../records'
import type { NodeData } from './canvas'
import { fillVars } from './fills'
import { editRequest, gestures } from './interaction'
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

const { updateNodeData, findNode } = useVueFlow()

const editing = ref(false)
const input = useTemplateRef('input')
// A resized Node keeps its width and grows downwards with its text.
const size = computed(() =>
  props.data.width ? { width: `${props.data.width}px`, minHeight: `${props.data.height ?? 0}px`, maxWidth: 'none' } : {},
)
const MIN_SIZE = { width: 48, height: 28 }

const link = computed(() => linkOf(props.data))
// A linked Node shows its Record's title as it is now; the saved label is only the fallback.
const label = computed(() => (link.value && getRecord(link.value.type, link.value.id)?.title) || props.data.label)

// `counted`: the canvas already counts this edit as a gesture in progress.
async function edit(counted = false) {
  // A linked Node's text is its Record's title: double-clicking opens the Record instead.
  if (link.value) return openRecord(link.value.type, link.value.id)
  if (editing.value) return
  if (!counted) gestures.value++
  editing.value = true
  // A Node just added stays hidden, and so cannot take focus, until Vue Flow has measured it.
  await until(() => !!findNode(props.id)?.dimensions.width).toBe(true, { timeout: 1000 })
  await nextTick()
  if (!input.value) return
  // Set once, not bound: the Node is drawn again while it grows, and that must not put the old text back.
  input.value.value = props.data.label
  input.value.focus()
  input.value.select()
}
function commit() {
  // Esc already ended the edit; the blur that follows must not save.
  if (!editing.value) return
  stop()
  updateNodeData(props.id, { label: input.value!.value.trim() })
}
function stop() {
  if (editing.value) gestures.value--
  editing.value = false
}
onBeforeUnmount(stop)

// Ending the edit with a key keeps the focus on the Node, so the canvas's keys go on working.
const root = useTemplateRef('root')
function end(save: boolean) {
  if (save) commit()
  stop()
  root.value?.closest<HTMLElement>('.vue-flow__node')?.focus({ preventScroll: true })
}

// The canvas asks for the text of a Node it just added to be ready for typing.
watch(
  () => editRequest.value === props.id,
  (asked) => {
    if (!asked) return
    editRequest.value = null
    edit(true)
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="root"
    data-testid="diagram-node"
    class="diagram-node"
    :class="[shapeOf(data.shape), { linked: link }]"
    :style="[fillVars(data.fill), size]"
    @dblclick="edit()"
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
      {{ label || '\u00a0' }}
    </span>
    <Handle type="source" :position="sourcePosition ?? Position.Bottom" />
    <ResizeHandles v-if="selected" :id="id" :min="MIN_SIZE" />
  </div>
</template>
