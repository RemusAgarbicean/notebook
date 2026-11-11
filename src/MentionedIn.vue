<script setup lang="ts">
import { computed } from 'vue'
import { mentionedIn } from './mentions'
import { openRecord } from './navigation'
import { recordType, type RecordType } from './record-types'

const props = defineProps<{ type: RecordType; id: number }>()
const records = computed(() => mentionedIn(props))
</script>

<template>
  <section v-if="records.length">
    <h2 class="flex h-8 items-center text-xs font-medium text-muted-foreground">Mentioned in</h2>
    <ul>
      <li v-for="r in records" :key="`${r.type}:${r.id}`">
        <button
          type="button"
          data-testid="mentioned-in"
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
