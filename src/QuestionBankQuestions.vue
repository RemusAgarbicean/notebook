<script setup lang="ts">
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { vFocus } from './dialog'
import {
  ANSWER_TYPES,
  deleteQuestion,
  getQuestion,
  listQuestions,
  questionCategories,
  renameCategory,
  type AnswerType,
  type Question,
} from './questionnaires'
import QuestionEditor from './QuestionEditor.vue'
import QuestionImportDialog from './QuestionImportDialog.vue'

// The Question bank dialog's Questions tab: every Question grouped by category, with search and a category
// filter, the editor for one Question, delete, and category rename.
const search = ref('')
const category = ref('')
// The Question in the editor: 'new' for a new one, null when the editor is closed.
const editing = ref<Question | 'new' | null>(null)

const categories = computed(() => questionCategories())
const groups = computed(() => {
  const questions = listQuestions({ search: search.value, category: category.value || undefined })
  return categories.value
    .map((name) => ({ name, questions: questions.filter((q) => q.category === name) }))
    .filter((g) => g.questions.length)
})

const edit = (id: number) => (editing.value = getQuestion(id))

// The Question waiting for Delete to be confirmed.
const deleting = ref<Question | null>(null)
function confirmDelete() {
  const q = deleting.value!
  deleting.value = null
  if (editing.value !== 'new' && editing.value?.id === q.id) editing.value = null
  deleteQuestion(q.id)
}

// The category being renamed, and the name typed so far.
const renaming = ref<string | null>(null)
const newName = ref('')
const error = ref('')
function startRename(name: string) {
  renaming.value = name
  newName.value = name
  error.value = ''
}
function rename() {
  if (renaming.value === null) return
  try {
    if (newName.value.trim() !== renaming.value) renameCategory(renaming.value, newName.value)
    if (category.value === renaming.value) category.value = newName.value.trim()
    renaming.value = null
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const typeLabel = (type: AnswerType) => ANSWER_TYPES.find((t) => t.type === type)?.label ?? type
const categoryName = (c: string) => c || 'No category'
const field = 'h-7 rounded-md border bg-background px-2'
const button = 'flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 font-medium hover:bg-accent'
const icon = 'rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground'
</script>

<template>
  <section data-testid="bank-questions" class="flex min-h-0 flex-1 flex-col gap-2">
    <div data-testid="bank-toolbar" class="flex items-center gap-1">
      <input
        v-model="search"
        type="search"
        data-testid="bank-search"
        aria-label="Search the Question bank"
        placeholder="Search"
        :class="[field, 'min-w-0 flex-1']"
      />
      <select v-model="category" data-testid="bank-category" aria-label="Category" :class="field">
        <option value="">All categories</option>
        <option v-for="c in categories" :key="c" :value="c">{{ categoryName(c) }}</option>
      </select>
      <button type="button" data-testid="bank-new-question" :class="button" @click="editing = 'new'">
        <Plus class="size-4" />
        New question
      </button>
      <QuestionImportDialog />
    </div>

    <QuestionEditor
      v-if="editing"
      :key="editing === 'new' ? 'new' : editing.id"
      :question="editing === 'new' ? null : editing"
      :categories="categories"
      :category="category"
      @done="editing = null"
    />

    <div class="min-h-0 flex-1 overflow-y-auto">
      <p v-if="!groups.length" data-testid="bank-empty" class="px-2 text-muted-foreground">No Questions match.</p>
      <section v-for="g in groups" :key="g.name" data-testid="bank-group" class="mb-3">
        <h3 class="flex h-7 items-center gap-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <input
            v-if="renaming === g.name"
            v-model="newName"
            v-focus
            data-testid="bank-category-input"
            :aria-label="`New name for ${categoryName(g.name)}`"
            :class="[field, 'flex-1 text-sm font-normal tracking-normal text-foreground normal-case']"
            @keydown.enter.prevent="rename"
            @keydown.esc.stop="renaming = null"
            @blur="rename"
          />
          <template v-else>
            <span data-testid="bank-category-name" class="flex-1">{{ categoryName(g.name) }}</span>
            <button
              type="button"
              data-testid="bank-rename-category"
              :aria-label="`Rename the category ${categoryName(g.name)}`"
              :title="`Rename the category on all its Questions`"
              :class="icon"
              @click="startRename(g.name)"
            >
              <Pencil class="size-3.5" />
            </button>
          </template>
        </h3>
        <p v-if="renaming === g.name && error" role="alert" class="px-2 text-destructive">{{ error }}</p>
        <ul>
          <li v-for="q in g.questions" :key="q.id" data-testid="bank-question" class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
            <span data-testid="bank-question-text" class="flex-1">{{ q.text }}</span>
            <span data-testid="bank-question-type" class="text-xs text-muted-foreground">{{ typeLabel(q.answerType) }}</span>
            <button type="button" data-testid="bank-question-edit" :aria-label="`Edit ${q.text}`" :class="icon" @click="edit(q.id)">
              <Pencil class="size-4" />
            </button>
            <button
              type="button"
              data-testid="bank-question-delete"
              :aria-label="`Delete ${q.text}`"
              :class="[icon, 'hover:text-destructive']"
              @click="deleting = q"
            >
              <Trash2 class="size-4" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <ConfirmDialog
      v-if="deleting"
      :title="`Delete “${deleting.text}”?`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
      @cancel="deleting = null"
    >
      <p class="text-muted-foreground">It leaves the bank and its Question sets. Questionnaires that ask it keep their copy.</p>
    </ConfirmDialog>
  </section>
</template>
