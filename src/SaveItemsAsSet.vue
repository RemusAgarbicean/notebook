<script setup lang="ts">
import { ListPlus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { listItems, saveItemsAsSet } from './questionnaires'
import { getRecord } from './records'
import type { RecordType } from './record-types'

// "Save Items as a set" on a Questionnaire page: its Items, in order, become a new Question set.
// Items written on the Questionnaire are saved to the bank on the way (see saveItemsAsSet).
const props = defineProps<{ type: RecordType; id: number; record?: unknown }>()

const hasItems = computed(() => listItems(props.id).length > 0)
const asking = ref(false)
const name = ref('')
const error = ref('')
const saved = ref('')

function ask() {
  name.value = String(getRecord('questionnaire', props.id)?.title ?? '')
  error.value = saved.value = ''
  asking.value = true
}

function save() {
  try {
    saveItemsAsSet(props.id, name.value)
    saved.value = name.value.trim()
    asking.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="flex items-center gap-2 text-xs">
    <button
      type="button"
      data-testid="save-items-as-set"
      :disabled="!hasItems"
      :title="hasItems ? 'Save these Items, in this order, as a new Question set' : 'Add Items first'"
      class="flex h-7 items-center gap-1 rounded-md border px-2 font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      @click="ask"
    >
      <ListPlus class="size-4" />
      Save Items as a set
    </button>
    <span v-if="saved" data-testid="saved-as-set" role="status" class="text-muted-foreground">Saved as the Question set “{{ saved }}”.</span>

    <ConfirmDialog v-if="asking" title="Save Items as a set" confirm-label="Save set" @confirm="save" @cancel="asking = false">
      <label class="flex flex-col gap-1">
        Set name
        <input v-model="name" data-testid="set-name-input" class="h-8 rounded-md border bg-background px-2" />
      </label>
      <p class="text-muted-foreground">Items written here are also saved to the Question bank, under their section.</p>
      <p v-if="error" data-testid="save-set-error" role="alert" class="text-destructive">{{ error }}</p>
    </ConfirmDialog>
  </div>
</template>
