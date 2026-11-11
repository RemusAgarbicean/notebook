<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { computed } from 'vue'
import { openRecord } from './navigation'
import RecordPicker from './RecordPicker.vue'
import { RECORD_FIELDS } from './record-fields'
import { recordType, type RecordType } from './record-types'
import { slotsOf } from './relation-slots'
import { addToSlot, removeFromSlot, slotRecords } from './relations'

// The Relation slots of a Record, as rows among its fixed fields.
// `record` is what every page section is handed; the slots only need the type and id.
const props = defineProps<{ type: RecordType; id: number; record?: unknown }>()

const slots = computed(() =>
  slotsOf(props.type).map((slot) => ({
    slot,
    records: slotRecords(slot, props.id),
    add: `Add ${slot.offers.map((t) => RECORD_FIELDS[t].singular).join(' or ')}`,
  })),
)
</script>

<template>
  <div v-for="s in slots" :key="s.slot.name" :data-testid="`slot-${s.slot.name}`" class="flex min-h-8 items-center gap-2">
    <span class="w-28 shrink-0 text-muted-foreground">{{ s.slot.name }}</span>
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      <span
        v-for="r in s.records"
        :key="`${r.type}:${r.id}`"
        class="flex h-6 max-w-full items-center gap-1 rounded-md bg-secondary pl-2 pr-1 text-xs text-secondary-foreground"
      >
        <button
          type="button"
          data-testid="slot-record"
          class="flex min-w-0 items-center gap-1 hover:underline"
          @click="openRecord(r.type, r.id)"
        >
          <component :is="recordType(r.type).icon" class="size-3 shrink-0" />
          <span class="truncate">{{ r.title }}</span>
        </button>
        <button
          type="button"
          :aria-label="`Remove ${r.title}`"
          class="shrink-0 rounded hover:bg-background"
          @click="removeFromSlot(s.slot, id, r)"
        >
          <X class="size-3" />
        </button>
      </span>
      <RecordPicker
        class="w-40"
        :label="s.add"
        :types="s.slot.offers"
        :exclude="[{ type, id }, ...s.records]"
        @pick="addToSlot(s.slot, id, $event)"
      />
    </div>
  </div>
</template>
