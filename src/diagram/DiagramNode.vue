<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { openRecord } from '../navigation'
import { recordType } from '../record-types'
import { getRecord } from '../records'
import type { NodeData } from './canvas'
import { fillVars } from './fills'
import { useLabelEdit } from './label-edit'
import { linkOf } from './links'
import ResizeHandles from './ResizeHandles.vue'
import { SHAPES, shapeLayout, shapeOf, type Shape } from './shapes'

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

// A shape drawn in SVG grows with its text so the text stays inside it (see shapeLayout); a resized one keeps its width.
const text = useTemplateRef('text')
const textSize = useElementSize(() => (editing.value ? input.value : text.value), undefined, { box: 'border-box' })
const name = computed(() => shapeOf(props.data.shape))
const shape = computed((): Shape => SHAPES[name.value])
// The border's width, as the CSS below and in DiagramCanvas sets it.
const line = computed(() => (link.value ? 2 : 1))
const fit = computed(() =>
  shapeLayout(name.value, { width: textSize.width.value, height: textSize.height.value }, props.data.width ? { width: props.data.width, height: props.data.height } : undefined, line.value),
)
const fitStyle = computed(() => {
  if (!fit.value) return {}
  const { padding, width, height } = fit.value
  // Never narrower than any Node: 4rem, the min-width in DiagramCanvas's CSS, which this one overrides.
  return { padding: padding.map((p) => `${p}px`).join(' '), minWidth: `${Math.max(width, 64)}px`, minHeight: `${height}px`, maxWidth: 'none' }
})
// The outline is drawn on the Node's real size, half a line in, so the line falls inside the box as a CSS border does.
const box = useElementSize(root, undefined, { box: 'border-box' })
const drawing = computed(() => {
  const [w, h] = [box.width.value, shape.value.below ? fit.value!.figure : box.height.value]
  return fit.value && w > 0 && h > 0 ? shape.value.draw(w - line.value, h - line.value, line.value) : null
})

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
    :class="[name, { linked: link, shaped: fit, open: drawing && !drawing.fill.length }]"
    :style="[fillVars(data.fill), size, fitStyle]"
    @dblclick="open"
  >
    <svg v-if="drawing" class="shape-outline" :width="box.width.value" :height="box.height.value" :style="{ top: `-${line}px`, left: `-${line}px` }" aria-hidden="true">
      <g :transform="`translate(${line / 2} ${line / 2})`">
        <path v-for="(d, i) in drawing.fill" :key="i" class="shape-fill" :d="d" />
        <path v-if="drawing.line" class="shape-line" :d="drawing.line" />
      </g>
    </svg>
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
    <span v-else ref="text" class="node-text" :style="fit && { maxWidth: `${shape.text}px` }">
      <component :is="recordType(link.type).icon" v-if="link" class="mr-1 inline size-3.5 align-text-bottom" />
      {{ label || ' ' }}
    </span>
    <Handle type="source" :position="sourcePosition ?? Position.Bottom" />
    <ResizeHandles v-if="selected" :id="id" :min="MIN_SIZE" :aspect="shape.aspect" />
  </div>
</template>

<style>
/* The shapes drawn in SVG: the outline takes the place of the Node's border and background. */
.diagram-node.shaped {
  border-color: transparent;
  background: none;
}
/* One with nothing to fill (a bracket) has the fill, if any, behind its text, as a text note does. */
.diagram-node.open {
  --node-bg: var(--fill-light, transparent);
  background: var(--node-bg);
}
.dark .diagram-canvas:not(.exporting) .diagram-node.open {
  --node-bg: var(--fill-dark, transparent);
}
.shape-outline {
  position: absolute;
  z-index: -1;
  overflow: visible;
  pointer-events: none;
}
.shape-fill,
.shape-line {
  fill: var(--node-bg);
  stroke: var(--node-line);
  stroke-width: var(--node-line-width);
}
.shape-line {
  fill: none;
}
</style>
