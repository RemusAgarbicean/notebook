<script setup lang="ts">
import { computed } from 'vue'
import DueDate from './DueDate.vue'
import { openRecord } from './navigation'
import Push from './Push.vue'
import { updateRecord, type Value } from './records'

// A Task as one row: done box, title with its Project in grey, due date, and Push while the Task is open.
const props = defineProps<{
  id: number
  title: string
  due?: Value
  done?: unknown
  project?: string | null
  /** Where the row is shown, added to its controls' labels when the same Task can show twice on a page. */
  where?: string
  pushTestid?: string
}>()
const name = computed(() => (props.where ? `${props.title} (${props.where})` : props.title))
</script>

<template>
  <!-- A row, not one button, so the done box and Push are not nested inside a button. -->
  <div class="flex h-7 items-center gap-2 rounded-md px-2 hover:bg-accent">
    <input
      type="checkbox"
      :checked="!!done"
      :aria-label="`Done: ${name}`"
      class="size-4 shrink-0"
      @change="updateRecord('task', id, { done: ($event.target as HTMLInputElement).checked })"
    />
    <button type="button" class="flex min-w-0 flex-1 items-baseline gap-2 text-left" @click="openRecord('task', id)">
      <span class="truncate" :class="{ 'text-muted-foreground line-through': done }">{{ title }}</span>
      <!-- No base width: the title keeps its room and the grey text gets what is left. -->
      <span v-if="project" class="w-0 min-w-8 flex-1 truncate text-xs text-muted-foreground">{{ project }}</span>
      <DueDate :due="due" :done="done" class="ml-auto shrink-0" />
    </button>
    <!-- Finished work is not rescheduled. -->
    <Push v-if="!done" :id="id" :title="name" :data-testid="pushTestid" />
    <span v-else aria-hidden="true" class="size-6 shrink-0" />
  </div>
</template>
