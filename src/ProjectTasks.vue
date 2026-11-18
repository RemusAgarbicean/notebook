<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RecordType } from './record-types'
import { createRecord, listRecords, transaction } from './records'
import { LABEL } from './relation-slots'
import { addRelation, isProjectTask, recordRelations } from './relations'
import TaskRow from './TaskRow.vue'

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
      <li v-for="t in tasks" :key="t.id">
        <TaskRow :id="t.id as number" data-testid="project-task" :title="String(t.title)" :due="t.due" :done="t.done" />
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
