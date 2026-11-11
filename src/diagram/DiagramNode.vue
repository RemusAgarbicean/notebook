<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { until } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { openRecord } from '../navigation'
import { recordType } from '../record-types'
import { getRecord } from '../records'
import type { NodeData } from './canvas'
import { fillVars } from './fills'
import { linkOf } from './links'

// Vue Flow passes many more props than these; they must not land on the element.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id: string
  data: NodeData
  sourcePosition?: Position
  targetPosition?: Position
}>()

const { updateNodeData, findNode } = useVueFlow()

const editing = ref(false)
const input = useTemplateRef('input')

const link = computed(() => linkOf(props.data))
// A linked Node shows its Record's title as it is now; the saved label is only the fallback.
const label = computed(() => (link.value && getRecord(link.value.type, link.value.id)?.title) || props.data.label)

async function edit() {
  // A linked Node's text is its Record's title: double-clicking opens the Record instead.
  if (link.value) return openRecord(link.value.type, link.value.id)
  editing.value = true
  // A Node just added stays hidden, and so cannot take focus, until Vue Flow has measured it.
  await until(() => !!findNode(props.id)?.dimensions.width).toBe(true, { timeout: 1000 })
  await nextTick()
  input.value?.focus()
  input.value?.select()
}
function commit() {
  // Esc already ended the edit; the blur that follows must not save.
  if (!editing.value) return
  editing.value = false
  updateNodeData(props.id, { label: input.value!.value.trim() })
}

// Ending the edit with a key keeps the focus on the Node, so the canvas's keys go on working.
const root = useTemplateRef('root')
function end(save: boolean) {
  if (save) commit()
  editing.value = false
  root.value?.closest<HTMLElement>('.vue-flow__node')?.focus({ preventScroll: true })
}

// A Node without text was just added: its text is ready to be typed.
onMounted(() => props.data.label || edit())
</script>

<template>
  <div
    ref="root"
    data-testid="diagram-node"
    class="diagram-node"
    :class="{ linked: link }"
    :style="fillVars(data.fill)"
    @dblclick="edit"
  >
    <Handle type="target" :position="targetPosition ?? Position.Top" />
    <!-- nodrag/nopan: typing and selecting text must not move the Node or the canvas. -->
    <input
      v-if="editing"
      ref="input"
      aria-label="Node text"
      class="nodrag nopan w-32 bg-transparent text-center outline-none"
      :value="data.label"
      @blur="commit"
      @keydown.enter="end(true)"
      @keydown.esc.stop="end(false)"
    />
    <span v-else class="whitespace-pre-wrap">
      <component :is="recordType(link.type).icon" v-if="link" class="mr-1 inline size-3.5 align-text-bottom" />
      {{ label || '\u00a0' }}
    </span>
    <Handle type="source" :position="sourcePosition ?? Position.Bottom" />
  </div>
</template>
