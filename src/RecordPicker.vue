<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { RECORD_FIELDS } from './record-fields'
import { sameTitle, searchRecords, type Found } from './record-search'
import { RECORD_TYPES, recordType, type RecordType } from './record-types'
import { createRecord, type RecordRef } from './records'

// The shared Record search picker: type to find a Record by title, or create one.
const props = defineProps<{
  /** The input's accessible name and placeholder. */
  label: string
  /** Offer and create only these types; every type when left out. */
  types?: readonly RecordType[]
  /** Records to leave out of the results (the Record itself, ones already picked). */
  exclude?: readonly RecordRef[]
}>()
const emit = defineEmits<{
  /** The chosen Record; one made with "Create" already exists when this fires. */
  pick: [record: Found]
}>()

const MAX = 20
const text = ref('')
const open = ref(false)
const active = ref(0)

type Option = { key: string; type: RecordType; text: string; record?: Found }

const options = computed<Option[]>(() => {
  if (!open.value) return []
  const title = text.value.trim()
  const found = searchRecords(title, props.types)
  const records = found
    .filter((r) => !props.exclude?.some((x) => x.type === r.type && x.id === r.id))
    .slice(0, MAX)
    .map((r) => ({ key: `${r.type}:${r.id}`, type: r.type, text: r.title, record: r }))
  // A type that already has a Record with exactly this title is not offered a second one.
  const creates = !title
    ? []
    : RECORD_TYPES.filter((t) => !props.types || props.types.includes(t.type))
        .filter((t) => !found.some((r) => r.type === t.type && sameTitle(r.title, title)))
        .map((t) => ({ key: `new:${t.type}`, type: t.type, text: `Create ${RECORD_FIELDS[t.type].singular} '${title}'` }))
  return [...records, ...creates]
})

function choose(o: Option | undefined) {
  if (!o) return
  const title = text.value.trim()
  const record = o.record ?? { type: o.type, id: createRecord(o.type, title), title }
  text.value = ''
  open.value = false
  emit('pick', record)
}

function move(by: number) {
  open.value = true
  const n = options.value.length
  if (n) active.value = (active.value + by + n) % n
}
function onInput() {
  open.value = true
  active.value = 0
}
</script>

<template>
  <div class="relative">
    <input
      v-model="text"
      data-testid="record-picker"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-label="label"
      :placeholder="label"
      class="h-6 w-full rounded-md border bg-background px-2 text-xs"
      @input="onInput"
      @focus="onInput"
      @blur="open = false"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="choose(options[active])"
      @keydown.esc="open = false"
    />
    <ul
      v-if="open && options.length"
      role="listbox"
      :aria-label="label"
      class="absolute left-0 top-7 z-20 max-h-64 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <!-- mousedown is prevented so the input keeps the focus and the list stays up for the click. -->
      <li
        v-for="(o, i) in options"
        :key="o.key"
        data-testid="picker-option"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 aria-selected:bg-accent aria-selected:text-accent-foreground"
        @mousedown.prevent
        @mousemove="active = i"
        @click="choose(o)"
      >
        <component :is="o.record ? recordType(o.type).icon : Plus" class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate">{{ o.text }}</span>
      </li>
    </ul>
  </div>
</template>
