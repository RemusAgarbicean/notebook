<script setup lang="ts">
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Undo2, X } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { vFocus } from './dialog'
import ItemAnswer from './ItemAnswer.vue'
import ItemEditor from './ItemEditor.vue'
import QuestionPicker from './QuestionPicker.vue'
import { isAnswered, listItems, moveItem, progress, progressText, removeItem, restoreItem, type Item, type RemovedItem } from './questionnaires'
import type { RecordType } from './record-types'

// A Questionnaire's Items in order, under their section headings: building the list and answering it.
const props = defineProps<{ type: RecordType; id: number; record?: unknown }>()

const all = computed(() => listItems(props.id))
const done = computed(() => progress(props.id))
const picking = ref(false)

// Unanswered only. An Item answered while the filter is on stays in view (it would vanish at the first key otherwise),
// until the filter is turned on again.
const unansweredOnly = ref(false)
const kept = ref(new Set<number>())
watch(unansweredOnly, () => (kept.value = new Set()))
const keep = (id: number) => unansweredOnly.value && kept.value.add(id)
const items = computed(() =>
  unansweredOnly.value ? all.value.filter((i) => !isAnswered(i.answer) || kept.value.has(i.id)) : all.value,
)

// A heading where the section changes from the Item shown before.
const headingBefore = (i: number) => {
  const section = items.value[i].section
  return section && section !== items.value[i - 1]?.section ? section : ''
}

// Moving re-orders the list, which takes the focus away: it goes back to the control that had it.
async function move(item: Item, offset: number) {
  const had = document.activeElement as HTMLElement | null
  moveItem(item.id, offset)
  await nextTick()
  if (had?.isConnected && had !== document.activeElement) had.focus()
}
function onKey(item: Item, e: KeyboardEvent) {
  if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
  e.preventDefault()
  void move(item, e.key === 'ArrowUp' ? -1 : 1)
}

// The wording editor, open on one Item or for a new question; closing it gives the focus back to the button that opened it.
const editing = ref<number | 'new' | null>(null)
async function stopEditing() {
  const was = editing.value
  editing.value = null
  await nextTick()
  document.getElementById(was === 'new' ? `new-question-${props.id}` : `edit-item-${was}`)?.focus()
}

// Remove, with an Undo that puts the Item back in its place, answer included.
const removed = ref<{ item: RemovedItem; text: string } | null>(null)
function remove(item: Item) {
  removed.value = { item: removeItem(item.id), text: item.text }
}
function undoRemove() {
  if (removed.value) restoreItem(removed.value.item)
  removed.value = null
}

const icon = 'shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40'
const button =
  'flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50'
</script>

<template>
  <section data-testid="questionnaire-items" aria-labelledby="items-heading" class="flex flex-col gap-2">
    <header class="flex flex-wrap items-center gap-2">
      <h2 id="items-heading" class="text-xs font-medium text-muted-foreground">Items</h2>
      <span data-testid="questionnaire-progress" class="text-xs text-muted-foreground">{{ progressText(done) }}</span>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <label class="flex h-7 items-center gap-1 text-xs">
          <input v-model="unansweredOnly" type="checkbox" data-testid="unanswered-only" />
          Unanswered only
        </label>
        <button
          :id="`new-question-${id}`"
          type="button"
          data-testid="new-question"
          :class="button"
          @click="editing = 'new'"
        >
          <Pencil class="size-3.5" />
          New question
        </button>
        <button type="button" data-testid="add-questions" :class="button" @click="picking = true">
          <Plus class="size-3.5" />
          Add from bank
        </button>
      </div>
    </header>
    <div
      v-if="removed"
      data-testid="item-removed"
      role="status"
      class="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-2 text-xs"
    >
      <span class="min-w-0 flex-1 truncate">Removed "{{ removed.text }}".</span>
      <button v-focus type="button" data-testid="undo-remove" :class="button" @click="undoRemove">
        <Undo2 class="size-3.5" />
        Undo
      </button>
      <button type="button" aria-label="Dismiss" :class="icon" @click="removed = null"><X class="size-3.5" /></button>
    </div>
    <p v-if="!items.length" data-testid="items-empty" class="px-2 text-muted-foreground">
      {{ all.length ? 'Every Item is answered.' : 'No Items yet. Add Questions from the bank, or write a new one.' }}
    </p>
    <ol class="flex flex-col gap-2">
      <li v-for="(item, i) in items" :key="item.id" class="flex flex-col">
        <h3 v-if="headingBefore(i)" data-testid="item-section" class="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ headingBefore(i) }}
        </h3>
        <div
          data-testid="questionnaire-item"
          class="flex flex-col rounded-md px-2 py-1"
          @input="keep(item.id)"
          @change="keep(item.id)"
          @keydown="onKey(item, $event)"
        >
          <ItemEditor v-if="editing === item.id" :questionnaire-id="id" :item="item" @done="stopEditing" />
          <template v-else>
          <div class="flex items-start gap-1">
            <span :id="`item-${item.id}-text`" data-testid="item-text" class="min-w-0 flex-1 pt-0.5 font-medium">{{ item.text }}</span>
            <!-- Q3's "Save Items as a set" is in the header; per-Item actions (Q6's Follow up) can join this row. -->
            <button
              :id="`edit-item-${item.id}`"
              type="button"
              data-testid="item-edit"
              :aria-label="`Edit: ${item.text}`"
              title="Edit the wording on this Questionnaire"
              :class="icon"
              @click="editing = item.id"
            >
              <Pencil class="size-4" />
            </button>
            <button
              type="button"
              data-testid="item-move-up"
              :aria-label="`Move up: ${item.text}`"
              title="Move up (Alt+↑)"
              :disabled="item.id === all[0]?.id"
              :class="icon"
              @click="move(item, -1)"
            >
              <ArrowUp class="size-4" />
            </button>
            <button
              type="button"
              data-testid="item-move-down"
              :aria-label="`Move down: ${item.text}`"
              title="Move down (Alt+↓)"
              :disabled="item.id === all.at(-1)?.id"
              :class="icon"
              @click="move(item, 1)"
            >
              <ArrowDown class="size-4" />
            </button>
            <button type="button" data-testid="item-remove" :aria-label="`Remove: ${item.text}`" title="Remove" :class="icon" @click="remove(item)">
              <Trash2 class="size-4" />
            </button>
          </div>
          <span v-if="item.help" class="text-xs text-muted-foreground">{{ item.help }}</span>
          <ItemAnswer :item="item" class="mt-1" />
          </template>
        </div>
      </li>
    </ol>
    <ItemEditor v-if="editing === 'new'" :questionnaire-id="id" :section="all.at(-1)?.section" @done="stopEditing" />
    <QuestionPicker v-if="picking" :questionnaire-id="id" @close="picking = false" />
  </section>
</template>
