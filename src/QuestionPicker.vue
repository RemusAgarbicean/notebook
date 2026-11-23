<script setup lang="ts">
import { Check, Plus, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { vDialog, vFocus } from './dialog'
import { addCategory, addedQuestionIds, addQuestions, addSet, answerTypeLabel, listQuestions, listSets, questionCategories } from './questionnaires'

// The dialog that adds bank Questions to a Questionnaire: one by one, a whole category, or a Question set.
// It stays open, so several can be added in a row; Questions already on the Questionnaire are marked and can't be added twice.
const props = defineProps<{ questionnaireId: number }>()
const emit = defineEmits<{ close: [] }>()

const search = ref('')
const category = ref('')
const error = ref('')

const questions = computed(() => listQuestions({ search: search.value, category: category.value || undefined }))
const added = computed(() => addedQuestionIds(props.questionnaireId))
const categoryLeft = computed(() => listQuestions({ category: category.value }).filter((q) => !added.value.has(q.id)).length)
const sets = computed(() =>
  listSets().map((s) => ({ ...s, left: s.questionIds.filter((id) => !added.value.has(id)).length })),
)

function attempt(add: () => unknown) {
  try {
    add()
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const button =
  'flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
const input = 'h-8 rounded-md border bg-background px-2'
</script>

<template>
  <div
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <div
      data-testid="question-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-title"
      class="flex max-h-full w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center">
        <h2 id="picker-title" class="flex-1 font-semibold">Add Questions from the bank</h2>
        <button type="button" data-testid="close-picker" aria-label="Close" class="rounded-md p-1 hover:bg-accent" @click="emit('close')">
          <X class="size-4" />
        </button>
      </header>

      <section v-if="sets.length" aria-labelledby="picker-sets" class="flex flex-col gap-1">
        <h3 id="picker-sets" class="text-xs font-medium text-muted-foreground">Question sets</h3>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="s in sets"
            :key="s.id"
            type="button"
            data-testid="picker-add-set"
            :disabled="!s.left"
            :title="s.left ? `Add the ${s.left} Questions not on it yet` : 'All on the Questionnaire already'"
            :class="button"
            @click="attempt(() => addSet(questionnaireId, s.id))"
          >
            <component :is="s.left ? Plus : Check" class="size-3.5" />
            {{ s.name }}
            <span class="font-normal text-muted-foreground">{{ s.questionIds.length }}</span>
          </button>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="search"
          v-focus
          type="search"
          data-testid="picker-search"
          aria-label="Search the Question bank"
          placeholder="Search questions"
          :class="[input, 'min-w-40 flex-1']"
        />
        <select v-model="category" data-testid="picker-category" aria-label="Category" :class="input">
          <option value="">All categories</option>
          <option v-for="c in questionCategories()" :key="c" :value="c">{{ c }}</option>
        </select>
        <button
          v-if="category"
          type="button"
          data-testid="picker-add-category"
          :disabled="!categoryLeft"
          :class="button"
          @click="attempt(() => addCategory(questionnaireId, category))"
        >
          <Plus class="size-3.5" />
          Add all of {{ category }}
        </button>
      </div>

      <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }}</p>

      <ul aria-label="Questions" class="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <li
          v-for="q in questions"
          :key="q.id"
          data-testid="picker-question"
          class="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
        >
          <div class="flex min-w-0 flex-1 flex-col">
            <span data-testid="picker-question-text">{{ q.text }}</span>
            <span class="text-xs text-muted-foreground">
              <template v-if="!category">{{ q.category }} · </template>{{ answerTypeLabel(q.answerType) }}
            </span>
          </div>
          <button
            type="button"
            data-testid="picker-add"
            :disabled="added.has(q.id)"
            :aria-label="added.has(q.id) ? `${q.text}: added` : `Add ${q.text}`"
            :class="button"
            @click="attempt(() => addQuestions(questionnaireId, [q.id]))"
          >
            <template v-if="added.has(q.id)"><Check class="size-3.5" /> Added</template>
            <template v-else><Plus class="size-3.5" /> Add</template>
          </button>
        </li>
        <li v-if="!questions.length" class="px-1 py-2 text-muted-foreground">No Questions match.</li>
      </ul>
    </div>
  </div>
</template>
