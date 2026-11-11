<script setup lang="ts">
import { computed } from 'vue'
import { openRecord } from './navigation'
import { recordType, type RecordType } from './record-types'
import type { RecordRef, Titled } from './records'

// A list of Records that point at this one: "Mentioned in" and "In Diagrams".
const props = defineProps<{
  type: RecordType
  id: number
  heading: string
  source: (record: RecordRef) => Titled[]
  testId: string
}>()
const records = computed(() => props.source({ type: props.type, id: props.id }))
</script>

<template>
  <section v-if="records.length">
    <h2 class="flex h-8 items-center text-xs font-medium text-muted-foreground">{{ heading }}</h2>
    <ul>
      <li v-for="r in records" :key="`${r.type}:${r.id}`">
        <button
          type="button"
          :data-testid="testId"
          class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-accent hover:text-accent-foreground"
          @click="openRecord(r.type, r.id)"
        >
          <component :is="recordType(r.type).icon" class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{{ r.title }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
