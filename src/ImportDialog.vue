<script setup lang="ts">
import { Upload, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { vDialog, vFocus } from './dialog'
import { importTargets, matchColumns, parseTable, planImport, runImport, type DuplicateMode } from './bulk-import'
import { recordType, type RecordType } from './record-types'
import { listRecords } from './records'
import { manualSave } from './save-status'

// The list's "Import…" button and the dialog it opens: paste or pick a file, check the preview, save.
const props = defineProps<{ type: RecordType }>()

const open = ref(false)
const text = ref('')
const columns = ref<string[]>([])
const mode = ref<DuplicateMode>('skip')
const error = ref('')
const saving = ref(false)

const table = computed(() => parseTable(text.value))
const headers = computed(() => table.value[0] ?? [])
// New input is matched afresh; the user's own choices last until the column names change.
watch(
  () => headers.value.join('\n'),
  () => (columns.value = matchColumns(props.type, headers.value)),
  { flush: 'sync' },
)

const targets = computed(() => importTargets(props.type))
// The preview's columns: the targets in use, in the type's own order.
const shown = computed(() => targets.value.filter((t) => columns.value.includes(t.value)))
const plan = computed(() =>
  open.value
    ? planImport(
        props.type,
        table.value,
        columns.value,
        listRecords(props.type).map((r) => r.title),
      )
    : [],
)
const count = computed(() => plan.value.filter((r) => !r.error && (mode.value === 'fill' || !r.duplicate)).length)

function cell(row: (typeof plan.value)[number], target: string) {
  if (target === 'title') return row.title
  if (target === 'tags') return row.tags.join(', ')
  if (target.startsWith('slot:')) return (row.slots[target.slice(5)] ?? []).join(', ')
  const value = row.fields[target]
  return typeof value === 'boolean' ? (value ? 'yes' : 'no') : (value ?? '')
}

const status = (row: (typeof plan.value)[number]) =>
  row.error
    ? `Skipped: ${row.error}`
    : !row.duplicate
      ? 'New'
      : mode.value === 'fill'
        ? 'Duplicate: fill empty fields'
        : 'Duplicate: skipped'

function start() {
  text.value = error.value = ''
  mode.value = 'skip'
  open.value = true
}

async function pick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) text.value = await file.text()
}

async function save() {
  saving.value = true
  try {
    await runImport(props.type, table.value, columns.value, mode.value)
    open.value = false
  } catch (e) {
    error.value = `Nothing was imported: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <button
    type="button"
    data-testid="import-open"
    :aria-label="`Import ${recordType(type).label}`"
    :title="`Import ${recordType(type).label} from a pasted table or a .csv file`"
    class="flex size-7 shrink-0 items-center justify-center rounded-md border hover:bg-accent hover:text-accent-foreground"
    @click="start"
  >
    <Upload class="size-3.5" />
  </button>

  <div
    v-if="open"
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="open = false"
    @keydown.esc="open = false"
  >
    <div
      data-testid="import-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
      class="flex max-h-full w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center">
        <h2 id="import-title" class="flex-1 font-semibold">Import {{ recordType(type).label }}</h2>
        <button type="button" aria-label="Close" class="rounded-md p-1 hover:bg-accent" @click="open = false">
          <X class="size-4" />
        </button>
      </header>

      <p class="text-muted-foreground">
        Paste a table copied from Excel, Sheets, Teams or Confluence, or pick a .csv file. The first row holds the
        column names.
      </p>
      <textarea
        v-model="text"
        v-focus
        data-testid="import-text"
        aria-label="Table to import"
        rows="5"
        class="w-full shrink-0 rounded-md border bg-background p-2 font-mono text-xs"
      />
      <input
        type="file"
        accept=".csv,text/csv"
        data-testid="import-file"
        aria-label="CSV file to import"
        class="text-xs file:mr-2 file:h-7 file:rounded-md file:border file:border-solid file:bg-background file:px-2 file:font-medium"
        @change="pick"
      />

      <template v-if="headers.length">
        <fieldset class="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3">
          <legend class="sr-only">Where each column goes</legend>
          <label v-for="(h, i) in headers" :key="i" class="flex flex-col gap-1 text-xs text-muted-foreground">
            {{ h || `Column ${i + 1}` }}
            <select
              v-model="columns[i]"
              data-testid="import-column"
              class="h-7 rounded-md border bg-background px-1 text-foreground"
            >
              <option value="">Ignore</option>
              <option v-for="t in targets" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </label>
        </fieldset>

        <fieldset class="flex flex-wrap gap-4">
          <legend class="mb-1 text-xs text-muted-foreground">
            Rows whose title is already in {{ recordType(type).label }}
          </legend>
          <label class="flex items-center gap-1">
            <input v-model="mode" type="radio" value="skip" data-testid="import-skip" />
            Skip
          </label>
          <label class="flex items-center gap-1">
            <input v-model="mode" type="radio" value="fill" data-testid="import-fill" />
            Fill empty fields
          </label>
        </fieldset>

        <table v-if="plan.length" class="w-full text-left">
          <thead class="text-xs text-muted-foreground">
            <tr>
              <th class="pr-2 font-medium">Row</th>
              <th v-for="t in shown" :key="t.value" class="pr-2 font-medium">{{ t.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in plan"
              :key="i"
              data-testid="import-row"
              class="border-t align-top"
              :class="r.error ? 'text-destructive' : r.duplicate && mode === 'skip' ? 'text-muted-foreground' : ''"
            >
              <td class="py-1 pr-2">{{ status(r) }}</td>
              <td v-for="t in shown" :key="t.value" class="py-1 pr-2 whitespace-pre-wrap">{{ cell(r, t.value) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-muted-foreground">No rows under the column names yet.</p>
      </template>

      <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
      <footer class="flex items-center justify-end gap-2 border-t pt-3">
        <span class="flex-1 text-xs text-muted-foreground">
          {{
            manualSave
              ? 'The Notebook as it is now is downloaded first. That file is the only undo.'
              : 'A Backup is taken first. Restoring it is the only undo.'
          }}
        </span>
        <button type="button" class="h-7 rounded-md border px-3 font-medium hover:bg-accent" @click="open = false">
          Cancel
        </button>
        <button
          type="button"
          data-testid="import-save"
          :disabled="!count || saving"
          class="h-7 rounded-md bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50"
          @click="save"
        >
          Import {{ count }} {{ count === 1 ? 'Record' : 'Records' }}
        </button>
      </footer>
    </div>
  </div>
</template>
