<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import { openRecord } from './navigation'
import type { RecordType } from './record-types'
import { duplicateRecord } from './records'

// The Record page's Duplicate button: makes "<title> copy" and opens it.
const props = defineProps<{ type: RecordType; id: number }>()
</script>

<template>
  <button
    type="button"
    data-testid="duplicate-record"
    title="Make a copy with the same fields, notes and Tags (not its Relations), and open it"
    class="flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent hover:text-accent-foreground"
    @click="openRecord(props.type, duplicateRecord(props.type, props.id))"
  >
    <Copy class="size-3.5" />
    Duplicate
  </button>
</template>
