<script setup lang="ts">
import { ref } from 'vue'
import { parseQuickTask } from './due'
import { createRecord } from './records'

// Home's quick-add box: a Task from one line, without leaving Home.
const text = ref('')
function add() {
  const { title, due } = parseQuickTask(text.value)
  if (!title) return
  createRecord('task', title, { due })
  text.value = ''
}
</script>

<template>
  <form class="px-2 pt-2" @submit.prevent="add">
    <input
      v-model="text"
      data-testid="quick-task"
      aria-label="New Task, optionally ending in a due date"
      title="End with a due date to set it: 2026-12-31 or 31.12.2026"
      placeholder="+ Task, then a due date if it has one"
      class="h-7 w-full rounded-md border bg-background px-2"
    />
  </form>
</template>
