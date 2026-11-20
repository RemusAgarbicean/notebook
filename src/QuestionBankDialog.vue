<script setup lang="ts">
import { Library, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { vDialog, vFocus } from './dialog'
import QuestionBankQuestions from './QuestionBankQuestions.vue'
import QuestionBankSets from './QuestionBankSets.vue'

// The sidebar's "Question bank" button and the dialog it opens: the Questions tab (the bank itself) and the
// Sets tab (the Question sets).
const open = ref(false)
const tab = ref<'questions' | 'sets'>('questions')
</script>

<template>
  <button
    type="button"
    data-testid="open-question-bank"
    class="mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    @click="open = true"
  >
    <Library class="size-4" />
    Question bank
  </button>

  <div
    v-if="open"
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="open = false"
    @keydown.esc="open = false"
  >
    <div
      data-testid="question-bank-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-bank-title"
      class="flex h-full max-h-[48rem] w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center gap-3">
        <h2 id="question-bank-title" class="font-semibold">Question bank</h2>
        <Tabs v-model="tab" data-testid="question-bank-tabs" aria-label="Show" class="flex-1">
          <TabsList class="h-7">
            <TabsTrigger value="questions" class="text-xs">Questions</TabsTrigger>
            <TabsTrigger value="sets" class="text-xs">Sets</TabsTrigger>
          </TabsList>
        </Tabs>
        <button
          v-focus
          type="button"
          data-testid="close-question-bank"
          aria-label="Close"
          class="rounded-md p-1 hover:bg-accent"
          @click="open = false"
        >
          <X class="size-4" />
        </button>
      </header>
      <QuestionBankQuestions v-if="tab === 'questions'" />
      <QuestionBankSets v-else />
    </div>
  </div>
</template>
