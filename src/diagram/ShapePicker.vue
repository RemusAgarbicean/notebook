<script lang="ts">
import { ref as moduleRef } from 'vue'
import { SHAPE_NAMES, SHAPES, usedShape, type Shape, type ShapeName } from './shapes'

// The recent shapes, shared by every picker and kept in this browser: a convenience, not part of the Notebook.
const KEY = 'notebook.recent-shapes'
function load(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}
const recent = moduleRef<string[]>(load())
function remember(name: ShapeName) {
  recent.value = usedShape(recent.value, name)
  try {
    localStorage.setItem(KEY, JSON.stringify(recent.value))
  } catch {
    // Without storage the list lasts until the page closes.
  }
}

// Each shape's preview, drawn once: its usual proportions fitted into 30 by 20.
const PREVIEWS = Object.fromEntries(
  SHAPE_NAMES.map((name) => {
    const shape: Shape = SHAPES[name]
    const [w, h] = shape.size[0] ? shape.size : [84, 56]
    const k = Math.min(30 / w, 20 / h)
    const [pw, ph] = [w * k, h * k]
    return [name, { ...shape.draw(pw, ph), x: 1 + (30 - pw) / 2, y: 1 + (20 - ph) / 2 }]
  }),
) as Record<ShapeName, { fill: string[]; line?: string; x: number; y: number }>
</script>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ChevronDown, Shapes } from 'lucide-vue-next'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { findShapes } from './shapes'

// One button that opens a searchable list of every shape: type to filter, the arrows to move, Enter to apply, Esc to close.
const props = defineProps<{ disabled?: boolean; /** Shown on the button, which then has text: the Node menu's. */ current?: ShapeName }>()
const emit = defineEmits<{ pick: [shape: ShapeName] }>()

const open = ref(false)
const query = ref('')
const active = ref(0)
const at = ref({ left: 0, top: 0 })
const root = useTemplateRef('root')
const trigger = useTemplateRef('trigger')
const input = useTemplateRef('input')
const list = useTemplateRef('list')
const id = useId()

const groups = computed(() => findShapes(query.value, recent.value))
const options = computed(() => groups.value.flatMap((g) => g.names))
// Where each group starts in `options`, so every option has its index.
const starts = computed(() => groups.value.map((_, i) => groups.value.slice(0, i).reduce((n, g) => n + g.names.length, 0)))
watch(query, () => (active.value = 0))
watch(active, () => nextTick(() => list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })))

// The list is fixed on the page, under the button, and kept on screen: it is at most 260 by 360.
function toggle() {
  if (open.value) return close()
  const r = trigger.value!.getBoundingClientRect()
  const below = r.bottom + 4 + 360 <= innerHeight
  at.value = { left: Math.max(8, Math.min(r.left, innerWidth - 268)), top: below ? r.bottom + 4 : Math.max(8, r.top - 364) }
  query.value = ''
  active.value = 0
  open.value = true
  nextTick(() => input.value?.focus())
}
function close() {
  open.value = false
  trigger.value?.focus()
}
function pick(name: ShapeName | undefined) {
  if (!name) return
  remember(name)
  close()
  emit('pick', name)
}
function onKey(e: KeyboardEvent) {
  const n = options.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (n) active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pick(options.value[active.value])
  } else if (e.key === 'Escape') {
    // Only the list closes, not the Node menu around it, nor the selection.
    e.stopPropagation()
    close()
  }
}
useEventListener(window, 'pointerdown', (e: PointerEvent) => open.value && !root.value?.contains(e.target as Node) && (open.value = false))
</script>

<template>
  <!-- click.stop: in the Node menu, a click in here must not close the menu the way one elsewhere does. -->
  <div ref="root" class="relative" @click.stop>
    <button
      ref="trigger"
      type="button"
      data-testid="shape-picker-button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="current ? `Shape: ${SHAPES[current].label}` : 'Shape'"
      :title="current ? 'Shape: choose from all shapes' : 'Shape of the selected Nodes: choose from all shapes'"
      :disabled="disabled"
      class="flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs hover:bg-accent disabled:opacity-40"
      :class="{ 'h-6 border': current }"
      @click="toggle"
    >
      <template v-if="current">
        <svg class="shape-preview" width="32" height="22" aria-hidden="true">
          <g :transform="`translate(${PREVIEWS[current].x} ${PREVIEWS[current].y})`">
            <path v-for="(d, i) in PREVIEWS[current].fill" :key="i" class="fill" :d="d" />
            <path v-if="PREVIEWS[current].line" :d="PREVIEWS[current].line" />
          </g>
        </svg>
        {{ SHAPES[current].label }}
        <ChevronDown class="size-3" />
      </template>
      <Shapes v-else class="size-3.5" />
    </button>
    <div
      v-if="open"
      data-testid="shape-picker"
      class="fixed z-30 flex w-64 flex-col rounded-md border bg-popover text-popover-foreground shadow-md"
      :style="{ left: `${at.left}px`, top: `${at.top}px` }"
    >
      <input
        ref="input"
        v-model="query"
        role="combobox"
        aria-label="Find a shape"
        aria-autocomplete="list"
        :aria-controls="`${id}-list`"
        aria-expanded="true"
        :aria-activedescendant="options.length ? `${id}-${active}` : undefined"
        placeholder="Find a shape"
        class="h-8 border-b bg-transparent px-2 text-xs outline-none"
        @keydown="onKey"
      />
      <div :id="`${id}-list`" ref="list" role="listbox" aria-label="Shapes" class="max-h-80 overflow-y-auto p-1">
        <p v-if="!options.length" class="px-2 py-1 text-xs text-muted-foreground">No shape matches.</p>
        <div v-for="(g, gi) in groups" :key="g.group" role="group" :aria-label="g.group">
          <div class="px-2 pt-1.5 pb-0.5 text-[0.7rem] text-muted-foreground" aria-hidden="true">{{ g.group }}</div>
          <!-- mousedown.prevent: the focus stays in the search box. -->
          <div
            v-for="(name, i) in g.names"
            :id="`${id}-${starts[gi] + i}`"
            :key="name"
            role="option"
            :data-shape="name"
            :aria-selected="starts[gi] + i === active"
            class="flex h-7 cursor-pointer items-center gap-2 rounded-sm px-1.5 text-xs aria-selected:bg-accent aria-selected:text-accent-foreground"
            @mousedown.prevent
            @mousemove="active = starts[gi] + i"
            @click="pick(name)"
          >
            <svg class="shape-preview shrink-0" width="32" height="22" aria-hidden="true">
              <g :transform="`translate(${PREVIEWS[name].x} ${PREVIEWS[name].y})`">
                <path v-for="(d, k) in PREVIEWS[name].fill" :key="k" class="fill" :d="d" />
                <path v-if="PREVIEWS[name].line" :d="PREVIEWS[name].line" />
              </g>
            </svg>
            {{ SHAPES[name].label }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.shape-preview path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
}
.shape-preview path.fill {
  fill: var(--popover, transparent);
}
</style>
