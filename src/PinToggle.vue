<script setup lang="ts">
import { Pin } from 'lucide-vue-next'
import { computed } from 'vue'
import { isPinned, setPinned } from './pins'
import type { RecordType } from './record-types'

// The Record page's pin button: a pinned Record shows on Home and first in its list.
const props = defineProps<{ type: RecordType; id: number }>()
const pinned = computed(() => isPinned(props))
</script>

<template>
  <button
    type="button"
    data-testid="pin-record"
    :aria-pressed="pinned"
    :title="pinned ? 'Unpin: take it off Home and the top of its list' : 'Pin: keep it on Home and at the top of its list'"
    class="flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent hover:text-accent-foreground aria-pressed:text-foreground"
    @click="setPinned(props, !pinned)"
  >
    <Pin class="size-3.5" :class="{ 'fill-current': pinned }" />
    {{ pinned ? 'Pinned' : 'Pin' }}
  </button>
</template>
