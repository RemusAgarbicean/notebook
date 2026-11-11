<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import { exportCsv, exportFileName } from './csv-export'
import { recordsName, type RecordType } from './record-types'
import { download } from './storage-download'

// The list's Export button: every Record of the type as a .csv file the Import reads back.
const props = defineProps<{ type: RecordType }>()
const save = () => download(new TextEncoder().encode(exportCsv(props.type)), exportFileName(props.type))
</script>

<template>
  <button
    type="button"
    data-testid="export-csv"
    :aria-label="`Export ${recordsName(type)}`"
    :title="`Export all ${recordsName(type)} to a .csv file: the whole list, not only the rows the filter shows`"
    class="flex size-7 shrink-0 items-center justify-center rounded-md border hover:bg-accent hover:text-accent-foreground"
    @click="save"
  >
    <Download class="size-3.5" />
  </button>
</template>
