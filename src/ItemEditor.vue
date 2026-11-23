<script setup lang="ts">
import { ref } from 'vue'
import { addNewItem, questionCategories, updateItem, type Item } from './questionnaires'
import { transaction } from './records'
import WordingFields, { formWording, wordingForm } from './WordingFields.vue'

// The form for an Item's wording: editing one on this Questionnaire only, or writing a new one at the end,
// optionally saved to the Question bank (its section is then its category there).
const props = defineProps<{ questionnaireId: number; item?: Item; section?: string }>()
const emit = defineEmits<{ done: [] }>()

const form = ref(wordingForm(props.item))
const section = ref(props.item?.section ?? props.section ?? '')
const saveToBank = ref(false)
const error = ref('')

const uid = `editor-${props.item?.id ?? 'new'}`

function submit() {
  const wording = formWording(form.value)
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
    <WordingFields v-model="form" testid="editor">
      <template #group="{ label, input }">
        <label :class="label" class="min-w-40 flex-1">
          {{ item ? 'Section' : 'Section (the category, when saved to the bank)' }}
          <input v-model="section" data-testid="editor-section" :list="`${uid}-sections`" placeholder="None" :class="input" />
          <datalist :id="`${uid}-sections`">
            <option v-for="c in questionCategories()" :key="c" :value="c" />
          </datalist>
        </label>
      </template>
    </WordingFields>
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
