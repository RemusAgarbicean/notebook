<script setup lang="ts">
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { until } from '@vueuse/core'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import type { NodeData } from './canvas'
import { fillVars } from './fills'

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

async function edit() {
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

// A Node without text was just added: its text is ready to be typed.
onMounted(() => props.data.label || edit())
</script>

<template>
  <div data-testid="diagram-node" class="diagram-node" :style="fillVars(data.fill)" @dblclick="edit">
    <Handle type="target" :position="targetPosition ?? Position.Top" />
    <!-- nodrag/nopan: typing and selecting text must not move the Node or the canvas. -->
    <input
      v-if="editing"
      ref="input"
      aria-label="Node text"
      class="nodrag nopan w-32 bg-transparent text-center outline-none"
      :value="data.label"
      @blur="commit"
      @keydown.enter="commit"
      @keydown.esc.stop="editing = false"
    />
    <span v-else class="whitespace-pre-wrap">{{ data.label || '\u00a0' }}</span>
    <Handle type="source" :position="sourcePosition ?? Position.Bottom" />
  </div>
</template>
