<script setup lang="ts">
import { Plus, Search } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { globalSearch } from './global-search'
import { openRecord } from './navigation'
import { paletteOpen } from './palette'
import { RECORD_FIELDS } from './record-fields'
import { sameTitle } from './records'
import { RECORD_TYPES, recordType, type RecordType } from './record-types'
import { createRecord } from './records'

// The ⌘K palette: global search over every Record, plus "Create <Type> '<text>'".
// Hand-built like RecordPicker, not shadcn Command, which filters items by their own text.
const MAX = 50
const text = ref('')
const active = ref(0)
const listbox = ref<HTMLElement>()

type Option = { key: string; type: RecordType; text: string; id?: number; where?: string; index: number }

const groups = computed(() => {
  if (!paletteOpen.value) return []
  const title = text.value.trim()
  const hits = globalSearch(title)
  const order = (t: RecordType) => RECORD_TYPES.findIndex((r) => r.type === t)
  const found = hits.slice(0, MAX).sort((a, b) => order(a.type) - order(b.type))
  const out: { heading: string; options: Option[] }[] = []
  let index = 0
  for (const h of found) {
    const heading = recordType(h.type).label
    if (out.at(-1)?.heading !== heading) out.push({ heading, options: [] })
    out.at(-1)!.options.push({ key: `${h.type}:${h.id}`, type: h.type, id: h.id, text: h.title, where: h.where, index: index++ })
  }
  // A type that already has a Record with exactly this title is not offered a second one.
  const creates = !title
    ? []
    : RECORD_TYPES.filter((t) => !hits.some((h) => h.type === t.type && sameTitle(h.title, title))).map((t) => ({
        key: `new:${t.type}`,
        type: t.type,
        text: `Create ${RECORD_FIELDS[t.type].singular} '${title}'`,
        index: index++,
      }))
  if (creates.length) out.push({ heading: 'Create', options: creates })
  return out
})
const options = computed(() => groups.value.flatMap((g) => g.options))

function choose(o: Option | undefined) {
  if (!o) return
  const id = o.id ?? createRecord(o.type, text.value.trim())
  paletteOpen.value = false
  openRecord(o.type, id)
}

function move(by: number) {
  const n = options.value.length
  if (!n) return
  active.value = (active.value + by + n) % n
  // Not in happy-dom, hence the second `?.`.
  nextTick(() => listbox.value?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }))
}

watch(paletteOpen, () => ((text.value = ''), (active.value = 0)))

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  paletteOpen.value = false
})
</script>

<template>
  <div
    v-if="paletteOpen"
    class="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-[12vh] text-sm text-foreground"
    @click.self="paletteOpen = false"
  >
    <div
      data-testid="palette"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      class="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
    >
      <div class="flex items-center gap-2 border-b px-3">
        <Search class="size-4 shrink-0 text-muted-foreground" />
        <input
          v-model="text"
          v-focus
          data-testid="palette-input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="palette-results"
          :aria-activedescendant="options[active] ? `palette-${options[active].key}` : undefined"
          aria-label="Search the Notebook"
          placeholder="Search titles, fields, notes and Tags…"
          class="h-11 w-full bg-transparent outline-none placeholder:text-muted-foreground"
          @input="active = 0"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="choose(options[active])"
          @keydown.esc="paletteOpen = false"
        />
      </div>
      <div id="palette-results" ref="listbox" role="listbox" aria-label="Results" class="overflow-y-auto p-1">
        <p v-if="!options.length" class="px-2 py-4 text-center text-muted-foreground">
          Type to search, or to create a Record.
        </p>
        <div v-for="g in groups" :key="g.heading" role="group" :aria-label="g.heading">
          <div data-testid="palette-group" class="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
            {{ g.heading }}
          </div>
          <div
            v-for="o in g.options"
            :id="`palette-${o.key}`"
            :key="o.key"
            data-testid="palette-option"
            role="option"
            :aria-selected="o.index === active"
            class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 aria-selected:bg-accent aria-selected:text-accent-foreground"
            @mousedown.prevent
            @mousemove="active = o.index"
            @click="choose(o)"
          >
            <component :is="o.id ? recordType(o.type).icon : Plus" class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ o.text }}</span>
            <span v-if="o.where" class="ml-auto shrink-0 text-xs text-muted-foreground">{{ o.where }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
</script>
