<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { caretSpot, placePopup } from './caret'
import { copyText } from './clipboard'
import {
  applyEdit,
  continueList,
  indentLines,
  insertLink,
  pasteLink,
  pasteTable,
  startMention,
  toggleLines,
  toggleWrap,
  type Edit,
} from './editing'
import FormatBar, { type FormatAction } from './FormatBar.vue'
import { renderMarkdown, toggleTask } from './markdown'
import { mentionFor, openMention, suggestMentions } from './mentions'
import { isMac, shortcut } from './platform'
import { untouched } from './templates'
import type { Titled } from './records'
import { RECORD_FIELDS } from './record-fields'

// A markdown textarea with a rendered view, used for notes and an Open question's answer.
const props = defineProps<{ modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Empty text, or a template nobody filled in yet, opens ready to type; existing text opens rendered.
const editing = ref(untouched(props.modelValue))

// Mention autocomplete: open while the caret sits in an unclosed `[[`.
const area = useTemplateRef('area')
const options = ref<Titled[]>([])
const active = ref(0)
let from = 0 // where the `[[` being completed starts
// The list opens at the caret. Its size is known without measuring: w-72, and h-8 rows inside p-1 and a border.
const WIDTH = 288
const spot = ref({ left: '0px', top: '0px' })
function place(el: HTMLTextAreaElement) {
  const size = { width: WIDTH, height: options.value.length * 32 + 10 }
  const box = el.getBoundingClientRect()
  // Not past the textarea's right side either: there the page column would grow a scrollbar.
  const room = { width: Math.min(innerWidth, box.right), height: innerHeight }
  const at = placePopup(caretSpot(el, el.selectionStart), size, room)
  // The list is positioned in the textarea's wrapper, which starts where the textarea does.
  spot.value = { left: `${at.left - box.left}px`, top: `${at.top - box.top}px` }
}

// Edit puts the caret in the text; Done leaves the focus on the button, so the keyboard can go on from there.
const toggler = useTemplateRef('toggler')
function toggle() {
  editing.value = !editing.value
  nextTick(() => (editing.value ? area.value : toggler.value)?.focus())
}

/** Runs a transform from `editing.ts` on the textarea; false when it had nothing to do. */
function edit(change: (e: Edit) => Edit | null) {
  const el = area.value!
  const next = change({ text: el.value, start: el.selectionStart, end: el.selectionEnd })
  if (next) applyEdit(el, next)
  return !!next
}

// What each button of the formatting bar does; three of them have a key too.
const FORMAT: Record<FormatAction, (e: Edit) => Edit> = {
  bold: (s) => toggleWrap(s, '**'),
  italic: (s) => toggleWrap(s, '*'),
  code: (s) => toggleWrap(s, '`'),
  link: insertLink,
  heading: (s) => toggleLines(s, 'heading'),
  bullet: (s) => toggleLines(s, 'bullet'),
  number: (s) => toggleLines(s, 'number'),
  task: (s) => toggleLines(s, 'task'),
  // The `[[` arrives as typing does, which opens the Mention list.
  mention: startMention,
}
const KEYS: Record<string, FormatAction> = { b: 'bold', i: 'italic', e: 'code' }
// ⌘ on a Mac, where Ctrl+B and Ctrl+E already move the caret; Ctrl everywhere else.
const withMod = (e: KeyboardEvent) => (isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey

/** The editing keys. False leaves the key to the browser: Tab outside a list still moves the focus. */
function editorKey(e: KeyboardEvent): boolean {
  if (e.isComposing) return false
  const key = e.key.toLowerCase()
  if (withMod(e)) return !e.shiftKey && key in KEYS && edit(FORMAT[KEYS[key]])
  if (e.ctrlKey || e.metaKey || e.altKey) return false
  if (e.key === 'Enter') return !e.shiftKey && edit(continueList)
  if (e.key === 'Tab') return edit((s) => indentLines(s, e.shiftKey))
  if (e.key === 'Escape') toggle()
  return e.key === 'Escape'
}

// Ticking a task item in the rendered view rewrites its line and saves, without entering edit mode.
const view = useTemplateRef('view')
function onTick(e: Event) {
  const n = (e.target as HTMLElement).dataset.task
  if (n === undefined) return
  emit('update:modelValue', toggleTask(props.modelValue, Number(n)))
  // The view is rendered anew, so the focus goes back to the box for the keyboard to go on.
  nextTick(() => view.value?.querySelector<HTMLElement>(`[data-task="${n}"]`)?.focus())
}

// A click in the rendered view: a code block's Copy button, else maybe a Mention.
async function onViewClick(e: MouseEvent) {
  const button = (e.target as Element).closest?.('[data-copy]')
  if (!button) return openMention(e)
  const code = button.parentElement!.querySelector('pre')!
  if (await copyText((code.textContent ?? '').replace(/\n$/, ''))) button.textContent = 'Copied'
  else {
    // The clipboard refused: select the code, so the copy key finishes the job.
    getSelection()?.selectAllChildren(code)
    button.textContent = `Press ${shortcut('C')}`
  }
  setTimeout(() => (button.textContent = 'Copy'), 2000)
}

function onPaste(e: ClipboardEvent) {
  const pasted = e.clipboardData?.getData('text/plain') ?? ''
  if (pasted && edit((s) => pasteLink(s, pasted) ?? pasteTable(s, pasted))) e.preventDefault()
}

function onInput() {
  const el = area.value!
  emit('update:modelValue', el.value)
  const open = /\[\[([^[\]\n]*)$/.exec(el.value.slice(0, el.selectionStart))
  from = open?.index ?? 0
  options.value = open ? suggestMentions(open[1]) : []
  active.value = 0
  if (options.value.length) place(el)
}

function pick(record: Titled) {
  const el = area.value!
  const before = el.value.slice(0, from) + mentionFor(record)
  // The caret goes behind the Mention.
  applyEdit(el, { text: before + el.value.slice(el.selectionStart), start: before.length, end: before.length })
  options.value = []
}

function onKeydown(e: KeyboardEvent) {
  const n = options.value.length
  // While the Mention list is open its keys come first.
  if (!n) {
    if (editorKey(e)) e.preventDefault()
    return
  }
  if (e.key === 'ArrowDown') active.value = (active.value + 1) % n
  else if (e.key === 'ArrowUp') active.value = (active.value + n - 1) % n
  else if (e.key === 'Enter' || e.key === 'Tab') pick(options.value[active.value])
  else if (e.key === 'Escape') options.value = []
  else return
  e.preventDefault()
}
</script>

<template>
  <section class="min-w-0">
    <div class="flex h-8 items-center justify-between">
      <h2 class="text-xs font-medium text-muted-foreground">{{ label }}</h2>
      <button
        ref="toggler"
        type="button"
        :aria-label="`${editing ? 'Done editing' : 'Edit'} ${label}`"
        class="h-6 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        @click="toggle"
      >
        {{ editing ? 'Done' : 'Edit' }}
      </button>
    </div>
    <FormatBar v-if="editing" @run="edit(FORMAT[$event])" />
    <div v-if="editing" class="relative">
      <textarea
        ref="area"
        :value="modelValue"
        :aria-label="label"
        rows="8"
        placeholder="Markdown. Type [[ to mention a Record."
        class="block max-h-[70vh] min-h-40 w-full rounded-md border bg-background p-2 font-mono [field-sizing:content]"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
        @blur="options = []"
      />
      <ul
        v-if="options.length"
        role="listbox"
        aria-label="Mention a Record"
        data-testid="mention-list"
        :style="spot"
        class="absolute z-10 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
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
    <div
      v-else
      ref="view"
      data-testid="markdown-view"
      class="markdown min-w-0"
      @click="onViewClick"
      @change="onTick"
      v-html="renderMarkdown(modelValue)"
    />
  </section>
</template>

<style>
/* Tailwind's reset strips these; rendered markdown needs them back. */
.markdown :is(p, ul, ol, pre, blockquote, table, h1, h2, h3, h4, h5, h6, .code-block) {
  margin-bottom: 0.5rem;
}
/* A calm, compact scale: the page title above is 1.5rem and the text 0.875rem. */
.markdown :is(h1, h2, h3, h4, h5, h6) {
  font-weight: 600;
  line-height: 1.3;
}
.markdown > :is(h1, h2, h3, h4, h5, h6):not(:first-child) {
  margin-top: 1rem;
}
.markdown h3 {
  font-size: 1rem;
}
.markdown :is(h5, h6) {
  color: var(--muted-foreground);
}
.markdown .code-block {
  position: relative;
}
.markdown .code-block pre {
  margin-bottom: 0;
}
/* Shown when the block is pointed at or the button has the keyboard's focus. */
.markdown .copy-code {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  opacity: 0;
}
.markdown .code-block:hover .copy-code,
.markdown .copy-code:focus-visible {
  opacity: 1;
}
@media (hover: none) {
  .markdown .copy-code {
    opacity: 1;
  }
}
@media print {
  .markdown .copy-code {
    display: none;
  }
}
/* Long words, wide tables and code scroll or wrap inside the notes instead of widening the page. */
.markdown {
  overflow-wrap: anywhere;
}
.markdown table {
  display: block;
  max-width: 100%;
  width: max-content;
  overflow-x: auto;
}
.markdown :is(th, td) {
  overflow-wrap: normal;
}
.markdown img {
  max-width: 100%;
  height: auto;
}
.markdown h1 {
  font-size: 1.25rem;
}
.markdown h2 {
  font-size: 1.1rem;
}
.markdown hr {
  margin: 0.75rem 0;
}
.markdown > :last-child {
  margin-bottom: 0;
}
.markdown ul {
  list-style: disc;
  padding-left: 1.25rem;
}
.markdown ol {
  list-style: decimal;
  padding-left: 1.25rem;
}
/* A task item's box takes the place of its bullet; in a numbered list it follows the number. */
.markdown ul > li:has(> input[type='checkbox'], > p > input[type='checkbox']) {
  list-style: none;
}
.markdown li input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  margin-right: 0.25rem;
  vertical-align: -0.15em;
}
.markdown ul > li :is(input[type='checkbox']) {
  margin-left: -1.25rem;
}
.markdown li input[type='checkbox']:not(:disabled) {
  cursor: pointer;
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
