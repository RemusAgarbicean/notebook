<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import {
  addToSet,
  createSet,
  deleteSet,
  listQuestions,
  listSets,
  moveInSet,
  moveSet,
  questionCategories,
  removeFromSet,
  renameSet,
  type QuestionSet,
} from './questionnaires'

// The Question bank dialog's Sets tab: the Question sets in order, and the chosen set's name and Questions.
const sets = computed(() => listSets())
const chosenId = ref<number | null>(null)
const chosen = computed(() => sets.value.find((s) => s.id === chosenId.value) ?? null)
const error = ref('')

const questions = computed(() => new Map(listQuestions().map((q) => [q.id, q])))
const members = computed(() => (chosen.value?.questionIds ?? []).map((id) => questions.value.get(id)!).filter(Boolean))
// The bank's Questions not yet in the chosen set, by category, for the Add picker.
const addable = computed(() => {
  const inSet = new Set(chosen.value?.questionIds)
  const free = [...questions.value.values()].filter((q) => !inSet.has(q.id))
  return questionCategories()
    .map((category) => ({ category: category || 'No category', questions: free.filter((q) => q.category === category) }))
    .filter((g) => g.questions.length)
})

function attempt(action: () => void) {
  try {
    action()
    error.value = ''
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    return false
  }
}

const newName = ref('')
function create() {
  attempt(() => {
    chosenId.value = createSet(newName.value)
    newName.value = ''
  })
}

function rename(set: QuestionSet, e: Event) {
  const input = e.target as HTMLInputElement
  // A refused name is not what is saved, so show the saved one again.
  if (!attempt(() => renameSet(set.id, input.value))) input.value = set.name
}

function add(set: QuestionSet, e: Event) {
  const select = e.target as HTMLSelectElement
  if (select.value) addToSet(set.id, Number(select.value))
  select.value = ''
}

// The set waiting for Delete to be confirmed.
const deleting = ref<QuestionSet | null>(null)
function confirmDelete() {
  const set = deleting.value!
  deleting.value = null
  if (chosenId.value === set.id) chosenId.value = null
  deleteSet(set.id)
}

const field = 'h-7 rounded-md border bg-background px-2'
const icon = 'rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-30'
</script>

<template>
  <section data-testid="bank-sets" class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
    <p class="text-muted-foreground">A Question set fills a Questionnaire in one step, with its Questions in this order.</p>
    <ul class="flex flex-col">
      <li
        v-for="(s, i) in sets"
        :key="s.id"
        data-testid="bank-set"
        class="flex items-center gap-1 rounded-md px-1 hover:bg-accent"
        :class="s.id === chosenId ? 'bg-accent' : ''"
      >
        <button
          type="button"
          data-testid="bank-set-name"
          class="h-7 flex-1 truncate px-1 text-left"
          :aria-current="s.id === chosenId ? 'true' : undefined"
          @click="chosenId = s.id"
        >
          {{ s.name }}
        </button>
        <span data-testid="bank-set-count" class="px-1 text-xs text-muted-foreground tabular-nums" :title="`${s.questionIds.length} Questions`">{{
          s.questionIds.length
        }}</span>
        <button type="button" data-testid="set-move-up" :aria-label="`Move ${s.name} up`" :disabled="i === 0" :class="icon" @click="moveSet(s.id, -1)">
          <ArrowUp class="size-4" />
        </button>
        <button
          type="button"
          data-testid="set-move-down"
          :aria-label="`Move ${s.name} down`"
          :disabled="i === sets.length - 1"
          :class="icon"
          @click="moveSet(s.id, 1)"
        >
          <ArrowDown class="size-4" />
        </button>
        <button type="button" data-testid="set-delete" :aria-label="`Delete ${s.name}`" :class="[icon, 'hover:text-destructive']" @click="deleting = s">
          <Trash2 class="size-4" />
        </button>
      </li>
    </ul>

    <form data-testid="new-set-form" class="flex items-center gap-1" @submit.prevent="create">
      <input v-model="newName" data-testid="new-set-name" aria-label="New set name" placeholder="New set name" :class="[field, 'min-w-0 flex-1']" />
      <button type="submit" class="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 font-medium hover:bg-accent">
        <Plus class="size-4" />
        New set
      </button>
    </form>
    <p v-if="error" data-testid="sets-error" role="alert" class="text-destructive">{{ error }}</p>

    <section v-if="chosen" data-testid="set-editor" class="flex flex-col gap-2 border-t pt-3">
      <input
        :key="chosen.id"
        data-testid="set-name"
        aria-label="Set name"
        :value="chosen.name"
        :class="[field, 'font-medium']"
        @change="rename(chosen, $event)"
      />
      <p v-if="!members.length" data-testid="set-empty" class="px-1 text-muted-foreground">No Questions in this set yet.</p>
      <ol class="flex flex-col">
        <li v-for="(q, i) in members" :key="q.id" data-testid="set-question" class="flex items-center gap-1 rounded-md px-1 hover:bg-accent">
          <span class="w-6 text-right text-xs text-muted-foreground tabular-nums">{{ i + 1 }}.</span>
          <span data-testid="set-question-text" class="flex-1 px-1">{{ q.text }}</span>
          <button
            type="button"
            data-testid="set-question-up"
            :aria-label="`Move ${q.text} up`"
            :disabled="i === 0"
            :class="icon"
            @click="moveInSet(chosen.id, q.id, -1)"
          >
            <ArrowUp class="size-4" />
          </button>
          <button
            type="button"
            data-testid="set-question-down"
            :aria-label="`Move ${q.text} down`"
            :disabled="i === members.length - 1"
            :class="icon"
            @click="moveInSet(chosen.id, q.id, 1)"
          >
            <ArrowDown class="size-4" />
          </button>
          <button
            type="button"
            data-testid="set-question-remove"
            :aria-label="`Take ${q.text} out of the set`"
            :class="icon"
            @click="removeFromSet(chosen.id, q.id)"
          >
            <X class="size-4" />
          </button>
        </li>
      </ol>
      <select data-testid="set-add-question" aria-label="Add a Question to the set" :class="field" @change="add(chosen, $event)">
        <option value="">Add a Question…</option>
        <optgroup v-for="g in addable" :key="g.category" :label="g.category">
          <option v-for="q in g.questions" :key="q.id" :value="q.id">{{ q.text }}</option>
        </optgroup>
      </select>
    </section>

    <ConfirmDialog
      v-if="deleting"
      :title="`Delete the set “${deleting.name}”?`"
      confirm-label="Delete"
      destructive
      @confirm="confirmDelete"
      @cancel="deleting = null"
    >
      <p class="text-muted-foreground">Its Questions stay in the bank.</p>
    </ConfirmDialog>
  </section>
</template>
