<script setup lang="ts">
import { computed } from 'vue'
import { answerText, isAnswered, listItems, progress, progressText, type Item } from './questionnaires'
import type { RecordType } from './record-types'

// A Questionnaire's Items in order, under their section headings, with their answers. Read-only for now:
// building and answering come with the interactive page.
const props = defineProps<{ type: RecordType; id: number; record?: unknown }>()

const items = computed(() => listItems(props.id))
const done = computed(() => progress(props.id))

// A heading where the section changes from the Item before.
const headingBefore = (i: number) => {
  const section = items.value[i].section
  return section && section !== items.value[i - 1]?.section ? section : ''
}
const shownAnswer = (item: Item) =>
  isAnswered(item.answer) ? [answerText(item.answer), item.answerType === 'number' && item.unit].filter(Boolean).join(' ') : 'Not answered'
</script>

<template>
  <section data-testid="questionnaire-items" class="flex flex-col gap-1">
    <h2 class="flex h-8 items-center gap-2 text-xs font-medium text-muted-foreground">
      Items
      <span data-testid="questionnaire-progress" class="font-normal">{{ progressText(done) }}</span>
    </h2>
    <p v-if="!items.length" class="px-2 text-muted-foreground">No Items yet.</p>
    <ol class="flex flex-col gap-2">
      <li v-for="(item, i) in items" :key="item.id" class="flex flex-col">
        <h3 v-if="headingBefore(i)" data-testid="item-section" class="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ headingBefore(i) }}
        </h3>
        <div data-testid="questionnaire-item" class="flex flex-col rounded-md px-2 py-1">
          <span data-testid="item-text" class="font-medium">{{ item.text }}</span>
          <span v-if="item.help" class="text-xs text-muted-foreground">{{ item.help }}</span>
          <span
            data-testid="item-answer"
            class="whitespace-pre-wrap"
            :class="isAnswered(item.answer) ? '' : 'text-muted-foreground italic'"
            >{{ shownAnswer(item) }}</span
          >
        </div>
      </li>
    </ol>
  </section>
</template>
