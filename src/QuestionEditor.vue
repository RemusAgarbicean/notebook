<script setup lang="ts">
import { ref } from 'vue'
import { createQuestion, updateQuestion, type Question } from './questionnaires'
import WordingFields, { formWording, wordingForm } from './WordingFields.vue'

// The editor for one bank Question: a new one when `question` is null. Every field of a Question.
const props = defineProps<{ question: Question | null; categories: string[]; category?: string }>()
const emit = defineEmits<{ done: [id: number | null] }>()

const q = props.question
const form = ref(wordingForm(q))
const category = ref(q?.category ?? props.category ?? '')
const error = ref('')

function save() {
  const draft = { ...formWording(form.value), category: category.value }
  try {
    if (q) updateQuestion(q.id, draft)
    emit('done', q ? q.id : createQuestion(draft))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <form
    data-testid="question-form"
    :aria-label="q ? 'Edit Question' : 'New Question'"
    class="flex flex-col gap-2 rounded-md border p-3"
    @submit.prevent="save"
    @keydown.esc.stop="emit('done', null)"
  >
    <WordingFields v-model="form" testid="question">
      <template #group="{ label, input }">
        <label :class="label" class="min-w-40 flex-1">
          Category
          <input v-model="category" data-testid="question-category" list="question-categories" :class="input" />
          <datalist id="question-categories">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
        </label>
      </template>
    </WordingFields>
    <p v-if="error" data-testid="question-error" role="alert" class="text-destructive">{{ error }}</p>
    <div class="flex justify-end gap-2">
      <button type="button" data-testid="question-cancel" class="h-7 rounded-md border px-3 font-medium hover:bg-accent" @click="emit('done', null)">
        Cancel
      </button>
      <button type="submit" data-testid="question-save" class="h-7 rounded-md border border-primary bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90">
        {{ q ? 'Save' : 'Add to bank' }}
      </button>
    </div>
  </form>
</template>
