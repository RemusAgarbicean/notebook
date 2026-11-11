<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { renderMarkdown } from './markdown'
import { mentionFor, openMention, suggestMentions } from './mentions'
import type { Titled } from './records'
import { RECORD_FIELDS } from './record-fields'

// A markdown textarea with a rendered view, used for notes and an Open question's answer.
const props = defineProps<{ modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Empty text opens ready to type; existing text opens rendered.
const editing = ref(!props.modelValue)

// Mention autocomplete: open while the caret sits in an unclosed `[[`.
const area = useTemplateRef('area')
const options = ref<Titled[]>([])
const active = ref(0)
let from = 0 // where the `[[` being completed starts

function onInput() {
  const el = area.value!
  emit('update:modelValue', el.value)
  const open = /\[\[([^[\]\n]*)$/.exec(el.value.slice(0, el.selectionStart))
  from = open?.index ?? 0
  options.value = open ? suggestMentions(open[1]) : []
  active.value = 0
}

function pick(record: Titled) {
  const el = area.value!
  const before = el.value.slice(0, from) + mentionFor(record)
  emit('update:modelValue', before + el.value.slice(el.selectionStart))
  options.value = []
  // Once the new text is in the textarea, put the caret behind the Mention.
  nextTick(() => {
    el.focus()
    el.setSelectionRange(before.length, before.length)
  })
}

function onKeydown(e: KeyboardEvent) {
  const n = options.value.length
  if (!n) return
  if (e.key === 'ArrowDown') active.value = (active.value + 1) % n
  else if (e.key === 'ArrowUp') active.value = (active.value + n - 1) % n
  else if (e.key === 'Enter' || e.key === 'Tab') pick(options.value[active.value])
  else if (e.key === 'Escape') options.value = []
  else return
  e.preventDefault()
}
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
    <div v-if="editing" class="relative">
      <textarea
        ref="area"
        :value="modelValue"
        :aria-label="label"
        rows="8"
        placeholder="Markdown. Type [[ to mention a Record."
        class="block w-full rounded-md border bg-background p-2 font-mono"
        @input="onInput"
        @keydown="onKeydown"
        @blur="options = []"
      />
      <!-- shortcut: the list sits under the textarea, not at the caret; move it if that feels far away. -->
      <ul
        v-if="options.length"
        role="listbox"
        aria-label="Mention a Record"
        class="absolute left-0 top-full z-10 mt-1 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        <!-- mousedown, not click: a click would blur the textarea and close the list first. -->
        <li
          v-for="(o, i) in options"
          :key="`${o.type}:${o.id}`"
          role="option"
          data-testid="mention-option"
          :aria-selected="i === active"
          class="flex h-8 cursor-default items-center gap-2 rounded px-2"
          :class="i === active && 'bg-accent text-accent-foreground'"
          @mousedown.prevent="pick(o)"
        >
          <span class="truncate">{{ o.title }}</span>
          <span class="ml-auto shrink-0 text-xs text-muted-foreground">{{ RECORD_FIELDS[o.type].singular }}</span>
        </li>
      </ul>
    </div>
    <!-- renderMarkdown sanitizes its output. -->
    <div v-else data-testid="markdown-view" class="markdown" @click="openMention" v-html="renderMarkdown(modelValue)" />
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
.markdown .mention-broken {
  color: var(--destructive);
  text-decoration: underline dashed;
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
