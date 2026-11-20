<script setup lang="ts">
import { computed, ref } from 'vue'
import { vFocus } from './dialog'
import { ANSWER_TYPES, addNewItem, isChoice, questionCategories, updateItem, type AnswerType, type Item } from './questionnaires'
import { transaction } from './records'

// The form for an Item's wording: editing one on this Questionnaire only, or writing a new one at the end,
// optionally saved to the Question bank (its section is then its category there).
const props = defineProps<{ questionnaireId: number; item?: Item; section?: string }>()
const emit = defineEmits<{ done: [] }>()

const text = ref(props.item?.text ?? '')
const help = ref(props.item?.help ?? '')
const answerType = ref<AnswerType>(props.item?.answerType ?? 'short_text')
const options = ref(props.item?.options.join('\n') ?? '')
const allowOther = ref(props.item?.allowOther ?? false)
const unit = ref(props.item?.unit ?? '')
const scaleLow = ref(props.item?.scaleLow ?? '')
const scaleHigh = ref(props.item?.scaleHigh ?? '')
const section = ref(props.item?.section ?? props.section ?? '')
const saveToBank = ref(false)
const error = ref('')

const choice = computed(() => isChoice(answerType.value))
const uid = `editor-${props.item?.id ?? 'new'}`

function submit() {
  const wording = {
    text: text.value,
    help: help.value,
    answerType: answerType.value,
    options: options.value.split('\n'),
    allowOther: allowOther.value,
    unit: unit.value,
    scaleLow: scaleLow.value,
    scaleHigh: scaleHigh.value,
  }
  try {
    if (props.item) updateItem(props.item.id, { ...wording, section: section.value })
    else
      transaction(() => {
        const id = addNewItem(props.questionnaireId, { ...wording, category: section.value }, { saveToBank: saveToBank.value })
        // Not saved to the bank, the Item still takes the section it was given.
        if (!saveToBank.value && section.value.trim()) updateItem(id, { section: section.value })
      })
    emit('done')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const input = 'h-8 rounded-md border bg-background px-2'
const label = 'flex flex-col gap-1 text-xs text-muted-foreground'
const button = 'h-7 rounded-md border px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground'
</script>

<template>
  <form
    data-testid="item-editor"
    :aria-label="item ? `Edit: ${item.text}` : 'New question'"
    class="flex flex-col gap-2 rounded-md border bg-muted/30 p-3"
    @submit.prevent="submit"
    @keydown.esc.stop="emit('done')"
  >
    <label :class="label">
      Question
      <input v-model="text" v-focus data-testid="editor-text" :class="[input, 'text-sm text-foreground']" />
    </label>
    <label :class="label">
      Help text
      <input v-model="help" data-testid="editor-help" placeholder="Optional" :class="[input, 'text-sm text-foreground']" />
    </label>
    <div class="flex flex-wrap gap-2">
      <label :class="label">
        Answer type
        <select v-model="answerType" data-testid="editor-type" :class="[input, 'text-sm text-foreground']">
          <option v-for="t in ANSWER_TYPES" :key="t.type" :value="t.type">{{ t.label }}</option>
        </select>
      </label>
      <label :class="[label, 'min-w-40 flex-1']">
        {{ item ? 'Section' : 'Section (the category, when saved to the bank)' }}
        <input
          v-model="section"
          data-testid="editor-section"
          :list="`${uid}-sections`"
          placeholder="None"
          :class="[input, 'text-sm text-foreground']"
        />
        <datalist :id="`${uid}-sections`">
          <option v-for="c in questionCategories()" :key="c" :value="c" />
        </datalist>
      </label>
    </div>
    <template v-if="choice">
      <label :class="label">
        Options, one per line
        <textarea v-model="options" data-testid="editor-options" rows="4" class="rounded-md border bg-background p-2 text-sm text-foreground" />
      </label>
      <label class="flex items-center gap-2 text-xs">
        <input v-model="allowOther" type="checkbox" data-testid="editor-allow-other" />
        Allow "Other" with free text
      </label>
    </template>
    <label v-if="answerType === 'number'" :class="label">
      Unit
      <input v-model="unit" data-testid="editor-unit" placeholder="users, €, GB" :class="[input, 'w-40 text-sm text-foreground']" />
    </label>
    <div v-if="answerType === 'scale'" class="flex flex-wrap gap-2">
      <label :class="label">
        Label at 1
        <input v-model="scaleLow" data-testid="editor-scale-low" placeholder="Low" :class="[input, 'text-sm text-foreground']" />
      </label>
      <label :class="label">
        Label at 5
        <input v-model="scaleHigh" data-testid="editor-scale-high" placeholder="High" :class="[input, 'text-sm text-foreground']" />
      </label>
    </div>
    <p v-if="item?.answer" class="text-xs text-muted-foreground">An answer that no longer fits the type or options is cleared.</p>
    <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }}</p>
    <div class="flex flex-wrap items-center gap-2">
      <label v-if="!item" class="flex items-center gap-2 text-xs">
        <input v-model="saveToBank" type="checkbox" data-testid="editor-save-to-bank" />
        Save to bank
      </label>
      <span class="flex-1" />
      <button type="button" data-testid="editor-cancel" :class="button" @click="emit('done')">Cancel</button>
      <button type="submit" data-testid="editor-save" :class="[button, 'bg-primary text-primary-foreground hover:bg-primary/90']">
        {{ item ? 'Save' : 'Add question' }}
      </button>
    </div>
  </form>
</template>
