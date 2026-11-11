<script setup lang="ts">
import { computed } from 'vue'
import { dueState, dueText } from './due'
import type { Value } from './records'

// A Task's due date in a list: past and today are said in words and set in a stronger weight, not by colour alone.
const props = defineProps<{ due: Value | undefined; done?: unknown }>()
const state = computed(() => dueState(props.due, props.done))
</script>

<template>
  <span
    v-if="due"
    :data-due="state ?? undefined"
    class="text-xs tabular-nums"
    :class="
      state === 'overdue'
        ? 'font-medium text-destructive'
        : state === 'today'
          ? 'font-medium text-foreground'
          : 'text-muted-foreground'
    "
  >
    {{ dueText(due, done) }}
  </span>
</template>
