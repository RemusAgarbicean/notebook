<script setup lang="ts">
import { ref } from 'vue'
import { renderMarkdown } from './markdown'

// A markdown textarea with a rendered view, used for notes and an Open question's answer.
const props = defineProps<{ modelValue: string; label: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

// Empty text opens ready to type; existing text opens rendered.
const editing = ref(!props.modelValue)
</script>

<template>
  <section>
    <div class="flex h-8 items-center justify-between">
      <h2 class="text-xs font-medium text-muted-foreground">{{ label }}</h2>
      <button
        type="button"
        class="rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        @click="editing = !editing"
      >
        {{ editing ? 'Done' : 'Edit' }}
      </button>
    </div>
    <textarea
      v-if="editing"
      :value="modelValue"
      :aria-label="label"
      rows="8"
      placeholder="Markdown"
      class="w-full rounded-md border bg-background p-2 font-mono"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <!-- renderMarkdown sanitizes its output. -->
    <div v-else data-testid="markdown-view" class="markdown" v-html="renderMarkdown(modelValue)" />
  </section>
</template>

<style>
/* Tailwind's reset strips these; rendered markdown needs them back. */
.markdown :is(p, ul, ol, pre, blockquote, table, h1, h2, h3, h4) {
  margin-bottom: 0.5rem;
}
.markdown :is(h1, h2, h3, h4) {
  font-weight: 600;
}
.markdown h1 {
  font-size: 1.25rem;
}
.markdown h2 {
  font-size: 1.1rem;
}
.markdown ul {
  list-style: disc;
  padding-left: 1.25rem;
}
.markdown ol {
  list-style: decimal;
  padding-left: 1.25rem;
}
.markdown a {
  text-decoration: underline;
}
.markdown :is(code, pre) {
  font-family: ui-monospace, monospace;
  background: var(--muted);
  border-radius: 0.25rem;
}
.markdown code {
  padding: 0 0.2rem;
}
.markdown pre {
  padding: 0.5rem;
  overflow-x: auto;
}
.markdown blockquote {
  border-left: 2px solid var(--border);
  padding-left: 0.75rem;
  color: var(--muted-foreground);
}
.markdown :is(th, td) {
  border: 1px solid var(--border);
  padding: 0.15rem 0.5rem;
}
</style>
