<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { openRecord } from './navigation'
import { followUpOf, takeFollowUpAnswer, type Item } from './questionnaires'

// An Item's follow-up under its answer: "Following up" while the Open question is open, then its answer.
// A text Item takes that answer once; the other types only show it, and the user picks the value.
const props = defineProps<{ item: Item }>()

const asked = computed(() => followUpOf(props.item))
watchEffect(() => {
  if (asked.value?.status === 'answered' && !props.item.answer) takeFollowUpAnswer(props.item.id)
})
const answerShown = computed(() => {
  const a = asked.value
  if (a?.status !== 'answered' || !a.answer) return null
  const own = props.item.answer as { text?: unknown } | null
  return own?.text === a.answer ? null : a.answer
})

const link = 'rounded-sm font-medium text-foreground underline-offset-2 hover:underline'
</script>

<template>
  <p v-if="asked?.status === 'open'" data-testid="item-following-up" class="text-xs text-muted-foreground">
    Following up:
    <button :id="`follow-up-${item.id}`" type="button" :class="link" @click="openRecord('open_question', asked.id)">{{ asked.title }}</button>
  </p>
  <p v-else-if="answerShown" data-testid="item-follow-up-answer" class="text-xs text-muted-foreground">
    <button :id="`follow-up-${item.id}`" type="button" :class="link" @click="openRecord('open_question', asked!.id)">
      Follow-up answer</button
    >: {{ answerShown }}
  </p>
</template>
