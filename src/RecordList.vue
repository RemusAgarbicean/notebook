<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import ImportDialog from './ImportDialog.vue'
import { current, list, openRecord } from './navigation'
import { RECORD_FIELDS } from './record-fields'
import { recordType } from './record-types'
import { createRecord, isClosed, listRecords, listTags, recordsWithTag } from './records'

const type = computed(() => (typeof list.value === 'string' && list.value !== 'home' ? list.value : null))
const tagId = computed(() => (typeof list.value === 'object' ? list.value.tag : null))

const heading = computed(() => {
  if (type.value) return recordType(type.value).label
  if (tagId.value !== null) return `#${listTags().find((t) => t.id === tagId.value)?.name ?? ''}`
  return 'Home'
})

// Each row: the title with one key field underneath (the type's name in a Tag list).
const items = computed(() => {
  const t = type.value
  if (t) {
    const { key } = RECORD_FIELDS[t]
    return listRecords(t).map((r) => ({
      type: t,
      id: r.id,
      title: r.title,
      sub: key ? r[key] : null,
      closed: isClosed(t, r),
    }))
  }
  if (tagId.value !== null)
    return recordsWithTag(tagId.value).map((r) => ({
      ...r,
      sub: RECORD_FIELDS[r.type].singular,
      closed: false,
    }))
  return []
})

function add() {
  const t = type.value!
  // A Journal entry names itself after its date.
  openRecord(t, createRecord(t, t === 'journal_entry' ? '' : `New ${RECORD_FIELDS[t].singular}`))
}
</script>

<template>
  <section data-testid="list-column" class="flex w-72 shrink-0 flex-col border-r">
    <header class="flex h-12 shrink-0 items-center justify-between gap-1 border-b px-4">
      <h1 class="flex-1 truncate font-semibold">{{ heading }}</h1>
      <ImportDialog v-if="type && type !== 'diagram'" :key="type" :type="type" />
      <button
        v-if="type"
        type="button"
        data-testid="new-record"
        class="flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
        @click="add"
      >
        <Plus class="size-3.5" />
        New
      </button>
    </header>

    <ul v-if="items.length" class="flex-1 overflow-y-auto p-2">
      <li v-for="r in items" :key="`${r.type}:${r.id}`">
        <!-- A Tag list stays put when a row is opened, so it sets `current` itself. -->
        <button
          type="button"
          data-testid="list-row"
          class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent aria-[current=true]:bg-accent"
          :class="{ 'text-muted-foreground': r.closed }"
          :aria-current="current?.type === r.type && current.id === r.id ? 'true' : undefined"
          @click="current = { type: r.type, id: r.id }"
        >
          <component :is="recordType(r.type).icon" v-if="tagId !== null" class="mt-0.5 size-4 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium" :class="{ 'line-through': r.closed }">{{ r.title }}</span>
            <span v-if="r.sub" class="block truncate text-xs text-muted-foreground">{{ r.sub }}</span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="p-4 text-muted-foreground">Nothing here yet.</p>
  </section>
</template>
