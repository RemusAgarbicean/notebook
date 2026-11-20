<script setup lang="ts">
import { Download, Upload, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { parseTable } from './bulk-import'
import { vDialog, vFocus } from './dialog'
import { exampleCsv, planQuestionImport, runQuestionImport, type QuestionImportRow } from './question-import'
import { ANSWER_TYPES, listQuestions, listSets, questionCategories } from './questionnaires'
import { manualSave } from './save-status'
import { download } from './storage-download'

// The bank's "Import…" button and the dialog it opens: paste or pick a file, check the preview, choose a
// category for rows without one and, if wanted, a Question set, then save.
const open = ref(false)
const text = ref('')
const category = ref('Imported')
// '' adds to no set, 'new' to a new set named `setName`, otherwise an existing set's id.
const set = ref('')
const setName = ref('')
const error = ref('')
const saving = ref(false)

const table = computed(() => parseTable(text.value))
const plan = computed(() =>
  open.value && table.value.length
    ? planQuestionImport(
        table.value,
        listQuestions().map((q) => q.text),
        category.value,
      )
    : { problem: null, rows: [] },
)
const count = computed(() => plan.value.rows.filter((r) => !r.error && !r.duplicate).length)
const sets = computed(() => (open.value ? listSets() : []))
const categories = computed(() => (open.value ? questionCategories().filter(Boolean) : []))
// Something to save: a new Question, or a duplicate that goes into the set.
const ready = computed(
  () =>
    !saving.value &&
    (set.value === 'new' ? !!setName.value.trim() : true) &&
    plan.value.rows.some((r) => !r.error && (!r.duplicate || set.value)),
)

const typeLabel = (r: QuestionImportRow) => ANSWER_TYPES.find((t) => t.type === r.answerType)?.label ?? r.answerType
const status = (r: QuestionImportRow) => (r.error ? `Skipped: ${r.error}` : r.duplicate ? 'Duplicate: skipped' : 'New')

function start() {
  text.value = error.value = setName.value = set.value = ''
  category.value = 'Imported'
  open.value = true
}

async function pick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) text.value = await file.text()
}

const example = () => download(new TextEncoder().encode(exampleCsv()), 'questions-example.csv')

async function save() {
  saving.value = true
  error.value = ''
  try {
    await runQuestionImport(
      table.value,
      category.value,
      set.value === 'new' ? { name: setName.value } : set.value ? { id: Number(set.value) } : null,
    )
    open.value = false
  } catch (e) {
    error.value = `Nothing was imported: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    saving.value = false
  }
}

const field = 'h-7 rounded-md border bg-background px-2'
</script>

<template>
  <button
    type="button"
    data-testid="bank-import"
    title="Import Questions from a pasted table or a .csv file"
    class="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 font-medium hover:bg-accent"
    @click="start"
  >
    <Upload class="size-4" />
    Import…
  </button>

  <div
    v-if="open"
    v-dialog
    class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="open = false"
    @keydown.esc.stop="open = false"
  >
    <div
      data-testid="question-import-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-import-title"
      class="flex max-h-full w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center">
        <h2 id="question-import-title" class="flex-1 font-semibold">Import Questions</h2>
        <button type="button" aria-label="Close" class="rounded-md p-1 hover:bg-accent" @click="open = false">
          <X class="size-4" />
        </button>
      </header>

      <p class="text-muted-foreground">
        Paste a table copied from Excel or Sheets, or pick a .csv file. The first row holds the column names:
        question, type, options, category and help, in any order. Only question is required.
      </p>
      <div class="flex items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv,.tsv,text/tab-separated-values"
          data-testid="question-import-file"
          aria-label="CSV file to import"
          class="min-w-0 flex-1 text-xs file:mr-2 file:h-7 file:rounded-md file:border file:border-solid file:bg-background file:px-2 file:font-medium"
          @change="pick"
        />
        <button
          type="button"
          data-testid="question-import-example"
          class="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent"
          @click="example"
        >
          <Download class="size-3.5" />
          Example CSV
        </button>
      </div>
      <textarea
        v-model="text"
        v-focus
        data-testid="question-import-text"
        aria-label="Table to import"
        rows="5"
        class="w-full shrink-0 rounded-md border bg-background p-2 font-mono text-xs"
      />

      <div class="flex flex-wrap items-end gap-4">
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">
          Category for rows without one
          <input
            v-model="category"
            data-testid="question-import-category"
            list="question-import-categories"
            :class="[field, 'text-sm text-foreground']"
          />
          <datalist id="question-import-categories">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">
          Also add them to
          <select v-model="set" data-testid="question-import-set" :class="[field, 'text-sm text-foreground']">
            <option value="">No Question set</option>
            <option value="new">A new Question set…</option>
            <option v-for="s in sets" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </select>
        </label>
        <input
          v-if="set === 'new'"
          v-model="setName"
          data-testid="question-import-set-name"
          aria-label="Name of the new Question set"
          placeholder="Set name"
          :class="[field, 'text-sm']"
        />
      </div>

      <p v-if="plan.problem" data-testid="question-import-problem" role="alert" class="text-destructive">
        {{ plan.problem }}
      </p>
      <table v-else-if="plan.rows.length" class="w-full text-left">
        <thead class="text-xs text-muted-foreground">
          <tr>
            <th class="pr-2 font-medium">Row</th>
            <th class="pr-2 font-medium">Question</th>
            <th class="pr-2 font-medium">Type</th>
            <th class="pr-2 font-medium">Options</th>
            <th class="pr-2 font-medium">Category</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in plan.rows"
            :key="i"
            data-testid="question-import-row"
            class="border-t align-top"
            :class="r.error ? 'text-destructive' : r.duplicate ? 'text-muted-foreground' : ''"
          >
            <td class="py-1 pr-2">{{ status(r) }}</td>
            <td class="py-1 pr-2">{{ r.text }}</td>
            <td class="py-1 pr-2">{{ typeLabel(r) }}</td>
            <td class="py-1 pr-2">{{ r.options.join(', ') }}</td>
            <td class="py-1 pr-2">{{ r.category }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="table.length" class="text-muted-foreground">No rows under the column names yet.</p>

      <p v-if="error" data-testid="question-import-error" role="alert" class="text-destructive">{{ error }}</p>
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
          data-testid="question-import-save"
          :disabled="!ready"
          class="h-7 rounded-md bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50"
          @click="save"
        >
          Import {{ count }} {{ count === 1 ? 'Question' : 'Questions' }}
        </button>
      </footer>
    </div>
  </div>
</template>
