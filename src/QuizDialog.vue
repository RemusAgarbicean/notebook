<script setup lang="ts">
import { GraduationCap, X } from 'lucide-vue-next'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { vDialog } from './dialog'
import { renderMarkdown } from './markdown'
import { answerCard, quizCards, quizProgress, startQuiz, type Quiz } from './quiz'

// The Acronyms list's Quiz button and its flashcards. One sitting; nothing is saved.
const usable = computed(() => quizCards().length)
const quiz = ref<Quiz | null>(null)
const revealed = ref(false)
const card = computed(() => quiz.value?.queue[0])
const panel = useTemplateRef('panel')

// The keys below are read on the panel, so it keeps the focus as the buttons come and go.
const refocus = () => nextTick(() => panel.value?.focus())

function start() {
  quiz.value = startQuiz(quizCards())
  revealed.value = false
  refocus()
}
function reveal() {
  if (card.value) revealed.value = true
  refocus()
}
function answer(knew: boolean) {
  if (!quiz.value || !revealed.value) return
  quiz.value = answerCard(quiz.value, knew)
  revealed.value = false
  refocus()
}
const close = () => (quiz.value = null)

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const act =
    e.key === ' ' || e.key === 'Enter'
      ? card.value
        ? reveal
        : null
      : e.key === 'ArrowRight' || e.key === '1'
        ? () => answer(true)
        : e.key === 'ArrowLeft' || e.key === '2'
          ? () => answer(false)
          : null
  // On a button, Space and Enter press it as usual (Close, Again).
  if (!act || (act === reveal && (revealed.value || (e.target as Element).closest('button')))) return
  e.preventDefault()
  act()
}

const kbd = 'rounded border bg-muted px-1 font-sans text-xs text-muted-foreground'
const button = 'flex h-8 items-center gap-2 rounded-md border px-3 font-medium hover:bg-accent hover:text-accent-foreground'
</script>

<template>
  <button
    v-if="usable >= 2"
    type="button"
    data-testid="quiz-open"
    aria-label="Quiz"
    title="Quiz: flashcards of your Acronyms"
    class="flex size-7 shrink-0 items-center justify-center rounded-md border hover:bg-accent hover:text-accent-foreground"
    @click="start"
  >
    <GraduationCap class="size-3.5" />
  </button>

  <div
    v-if="quiz"
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="close"
    @keydown.esc="close"
  >
    <div
      ref="panel"
      data-testid="quiz-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-title"
      tabindex="-1"
      class="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg outline-none"
      @keydown="onKey"
    >
      <header class="flex items-center gap-2">
        <h2 id="quiz-title" class="font-semibold">Acronym quiz</h2>
        <span data-testid="quiz-progress" role="status" class="flex-1 text-xs text-muted-foreground tabular-nums">
          {{ quizProgress(quiz) }}
        </span>
        <button type="button" aria-label="Close" class="rounded-md p-1 hover:bg-accent" @click="close">
          <X class="size-4" />
        </button>
      </header>

      <template v-if="card">
        <div class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-4 text-center">
          <p data-testid="quiz-acronym" class="text-3xl font-semibold break-all">{{ card.title }}</p>
          <template v-if="revealed">
            <p data-testid="quiz-expansion" class="text-base">{{ card.expansion }}</p>
            <div
              v-if="card.notes.trim()"
              data-testid="quiz-notes"
              class="markdown w-full min-w-0 border-t pt-3 text-left text-muted-foreground"
              v-html="renderMarkdown(card.notes)"
            />
          </template>
        </div>

        <div v-if="revealed" class="grid grid-cols-2 gap-2">
          <button type="button" data-testid="quiz-unknown" :class="[button, 'justify-center']" @click="answer(false)">
            Didn't know <kbd :class="kbd">2</kbd>
          </button>
          <button type="button" data-testid="quiz-known" :class="[button, 'justify-center']" @click="answer(true)">
            Knew it <kbd :class="kbd">1</kbd>
          </button>
        </div>
        <button v-else type="button" data-testid="quiz-reveal" :class="[button, 'justify-center']" @click="reveal">
          Reveal <kbd :class="kbd">Space</kbd>
        </button>
        <p class="text-xs text-muted-foreground">
          Space reveals. Then 1 or → for Knew it, 2 or ← for Didn't know; those cards come back. Esc closes.
        </p>
      </template>

      <template v-else>
        <p data-testid="quiz-done" class="py-6 text-center text-base">All {{ quiz.total }} known.</p>
        <div class="flex justify-end gap-2">
          <button type="button" data-testid="quiz-again" :class="button" @click="start">Again</button>
          <button type="button" :class="button" @click="close">Close</button>
        </div>
      </template>
    </div>
  </div>
</template>
