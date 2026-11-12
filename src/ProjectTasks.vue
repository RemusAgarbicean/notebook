<script setup lang="ts">
import { computed, ref } from 'vue'
import DueDate from './DueDate.vue'
import { openRecord } from './navigation'
import type { RecordType } from './record-types'
import { createRecord, listRecords, transaction, updateRecord } from './records'
import { LABEL } from './relation-slots'
import { addRelation, isProjectTask, recordRelations } from './relations'

// The Tasks checklist of a Project page, with the "+ Task" box.
const props = defineProps<{ type: RecordType; id: number; record?: unknown }>()

// listRecords gives the order: open first, then by due date.
const tasks = computed(() => {
  const ids = new Set(recordRelations(props).filter(isProjectTask).map((e) => e.other.id))
  return listRecords('task', { texts: false }).filter((t) => ids.has(t.id as number))
})

const title = ref('')
function add() {
  if (!title.value.trim()) return
  // Both or neither: no Task is left behind outside its Project.
  transaction(() => {
    const id = createRecord('task', title.value)
    addRelation({ type: 'task', id }, LABEL.partOf, props)
  })
  title.value = ''
}
</script>

<template>
  <section data-testid="project-tasks" class="flex flex-col">
    <h2 class="flex h-8 items-center text-xs font-medium text-muted-foreground">Tasks</h2>
    <ul>
      <li v-for="t in tasks" :key="t.id" data-testid="project-task" class="flex min-h-8 items-center gap-2 px-2">
        <input
          type="checkbox"
          :checked="!!t.done"
          :aria-label="`Done: ${t.title}`"
          class="size-4 shrink-0"
          @change="updateRecord('task', t.id as number, { done: ($event.target as HTMLInputElement).checked })"
        />
        <button
          type="button"
          class="min-w-0 flex-1 truncate rounded-md px-1 text-left hover:bg-accent"
          :class="{ 'text-muted-foreground line-through': t.done }"
          @click="openRecord('task', t.id as number)"
        >
          {{ t.title }}
        </button>
        <DueDate :due="t.due" :done="t.done" class="shrink-0" />
      </li>
    </ul>
    <form class="px-2 pt-1" @submit.prevent="add">
      <input
        v-model="title"
        data-testid="new-project-task"
        aria-label="New Task"
        placeholder="+ Task"
        class="h-7 w-full rounded-md border bg-background px-2"
      />
    </form>
  </section>
</template>
