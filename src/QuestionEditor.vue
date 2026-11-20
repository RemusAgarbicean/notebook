<script setup lang="ts">
import { computed, ref } from 'vue'
import { vFocus } from './dialog'
import { ANSWER_TYPES, createQuestion, isChoice, updateQuestion, type AnswerType, type Question } from './questionnaires'

// The editor for one bank Question: a new one when `question` is null. Every field of a Question;
// the type's own fields (options, Other, unit, end labels) show only for that type.
const props = defineProps<{ question: Question | null; categories: string[]; category?: string }>()
const emit = defineEmits<{ done: [id: number | null] }>()

const q = props.question
const text = ref(q?.text ?? '')
const help = ref(q?.help ?? '')
const answerType = ref<AnswerType>(q?.answerType ?? 'short_text')
const options = ref(q?.options.join('\n') ?? '')
const allowOther = ref(q?.allowOther ?? false)
const unit = ref(q?.unit ?? '')
const scaleLow = ref(q?.scaleLow ?? '')
const scaleHigh = ref(q?.scaleHigh ?? '')
const category = ref(q?.category ?? props.category ?? '')
const error = ref('')

const choice = computed(() => isChoice(answerType.value))

function save() {
  const draft = {
    text: text.value,
    help: help.value,
    answerType: answerType.value,
    options: options.value.split('\n'),
    allowOther: allowOther.value,
    unit: unit.value,
    scaleLow: scaleLow.value,
    scaleHigh: scaleHigh.value,
    category: category.value,
  }
  try {
    if (q) updateQuestion(q.id, draft)
    emit('done', q ? q.id : createQuestion(draft))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const field = 'h-7 w-full rounded-md border bg-background px-2'
const label = 'flex flex-col gap-0.5 text-xs font-medium text-muted-foreground'
</script>

<template>
  <form
    data-testid="question-form"
    :aria-label="q ? 'Edit Question' : 'New Question'"
    class="flex flex-col gap-2 rounded-md border p-3"
    @submit.prevent="save"
    @keydown.esc.stop="emit('done', null)"
  >
    <label :class="label">
      Question
      <input v-model="text" v-focus data-testid="question-text" :class="field" class="text-sm text-foreground" />
    </label>
    <label :class="label">
      Help text
      <input v-model="help" data-testid="question-help" placeholder="Optional" :class="field" class="text-sm text-foreground" />
    </label>
    <div class="flex gap-2">
      <label :class="label" class="flex-1">
        Answer type
        <select v-model="answerType" data-testid="question-type" :class="field" class="text-sm text-foreground">
          <option v-for="t in ANSWER_TYPES" :key="t.type" :value="t.type">{{ t.label }}</option>
        </select>
      </label>
      <label :class="label" class="flex-1">
        Category
        <input v-model="category" data-testid="question-category" list="question-categories" :class="field" class="text-sm text-foreground" />
        <datalist id="question-categories">
          <option v-for="c in categories" :key="c" :value="c" />
        </datalist>
      </label>
    </div>
    <template v-if="choice">
      <label :class="label">
        Options, one per line
        <textarea v-model="options" data-testid="question-options" rows="4" class="rounded-md border bg-background p-2 text-sm text-foreground" />
      </label>
      <label class="flex items-center gap-2">
        <input v-model="allowOther" type="checkbox" data-testid="question-allow-other" />
        Allow Other, with free text
      </label>
    </template>
    <label v-if="answerType === 'number'" :class="label">
      Unit
      <input v-model="unit" data-testid="question-unit" placeholder="users, €, GB" :class="field" class="text-sm text-foreground" />
    </label>
    <div v-if="answerType === 'scale'" class="flex gap-2">
      <label :class="label" class="flex-1">
        Label at 1
        <input v-model="scaleLow" data-testid="question-scale-low" placeholder="Low" :class="field" class="text-sm text-foreground" />
      </label>
      <label :class="label" class="flex-1">
        Label at 5
        <input v-model="scaleHigh" data-testid="question-scale-high" placeholder="High" :class="field" class="text-sm text-foreground" />
      </label>
    </div>
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
