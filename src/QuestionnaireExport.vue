<script setup lang="ts">
import { ChevronDown, Share, X } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { copyText } from './clipboard'
import { vDialog } from './dialog'
import { vImages } from './image-view'
import { emailText, markdown, printHtml, snapshot } from './questionnaire-export'
import { download } from './storage-download'

// The Questionnaire's Export menu: Markdown (copy or download, with answers or blank), email text, and print.
const props = defineProps<{ id: number }>()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menu = useTemplateRef<HTMLElement>('menu')

async function toggle() {
  if (open.value) return close()
  open.value = true
  await nextTick()
  menu.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
}
function close(refocus = false) {
  open.value = false
  if (refocus) trigger.value?.focus()
}

// ArrowDown and ArrowUp move between the items, wrapping at the ends.
function move(e: KeyboardEvent, step: number) {
  e.preventDefault()
  const items = [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next = at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length
  items[next]?.focus()
}
// Focus moving out of the menu, as with Tab, or a click elsewhere closes it.
function leave(e: FocusEvent) {
  if (open.value && e.relatedTarget && !root.value?.contains(e.relatedTarget as Node)) close()
}
function outside(e: Event) {
  if (!root.value?.contains(e.target as Node)) close()
}
watch(open, (on) => {
  if (on) document.addEventListener('pointerdown', outside, true)
  else document.removeEventListener('pointerdown', outside, true)
})

// Copy: "Copied" on the button for a moment; when the clipboard refuses, the text is shown to copy by hand.
const copied = ref(false)
const shown = ref('')
async function copy(text: string) {
  close(true)
  if (await copyText(text)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } else shown.value = text
}
const selectAll = (e: Event) => (e.target as HTMLTextAreaElement).select()

// A file name the file systems take: the title without the characters they refuse.
function save(answers: boolean) {
  close(true)
  const s = snapshot(props.id)
  const name = (s.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Questionnaire') + (answers ? '' : ' (blank)')
  download(new TextEncoder().encode(markdown(s, { answers })), `${name}.md`)
}

// Print: the print-only view goes into the page (the print stylesheet shows it alone), then the browser prints.
// It stays until the browser says it is done, since some browsers print after `print()` returns.
const printing = ref('')
const donePrinting = () => (printing.value = '')
async function print(answers: boolean) {
  close(true)
  printing.value = printHtml(snapshot(props.id), { answers })
  await nextTick()
  window.print()
}
window.addEventListener('afterprint', donePrinting)
onBeforeUnmount(() => {
  open.value = false
  window.removeEventListener('afterprint', donePrinting)
})

const item = 'rounded px-2 py-1 text-left hover:bg-accent focus:bg-accent focus:outline-none'
</script>

<template>
  <div ref="root" class="relative shrink-0" @keydown.esc.stop="close(true)" @focusout="leave">
    <button
      ref="trigger"
      type="button"
      data-testid="export-menu"
      aria-haspopup="menu"
      :aria-expanded="open"
      title="Export this Questionnaire"
      class="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
      @click="toggle"
    >
      <Share class="size-3.5" />
      <span aria-live="polite">{{ copied ? 'Copied' : 'Export' }}</span>
      <ChevronDown class="size-3.5" />
    </button>
    <div
      v-if="open"
      ref="menu"
      role="menu"
      aria-label="Export"
      class="absolute right-0 z-50 mt-1 flex w-52 flex-col rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      @keydown.down="move($event, 1)"
      @keydown.up="move($event, -1)"
    >
      <button type="button" role="menuitem" :class="item" @click="copy(markdown(snapshot(id), { answers: true }))">Copy as Markdown</button>
      <button type="button" role="menuitem" :class="item" @click="copy(markdown(snapshot(id), { answers: false }))">
        Copy blank Markdown
      </button>
      <button type="button" role="menuitem" :class="item" @click="save(true)">Download Markdown</button>
      <button type="button" role="menuitem" :class="item" @click="save(false)">Download blank Markdown</button>
      <div role="separator" class="my-1 border-t" />
      <button type="button" role="menuitem" :class="item" @click="copy(emailText(snapshot(id)))">Copy as email text</button>
      <div role="separator" class="my-1 border-t" />
      <button type="button" role="menuitem" :class="item" @click="print(true)">Print / Save as PDF</button>
      <button type="button" role="menuitem" :class="item" @click="print(false)">Print blank form</button>
    </div>

    <div
      v-if="shown"
      v-dialog
      class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
      @click.self="shown = ''"
      @keydown.esc="shown = ''"
    >
      <div
        data-testid="export-copy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-copy-title"
        class="flex max-h-full w-full max-w-lg flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
      >
        <header class="flex items-center">
          <h2 id="export-copy-title" class="flex-1 font-semibold">Copy the export</h2>
          <button type="button" aria-label="Close" class="rounded-md p-1 hover:bg-accent" @click="shown = ''">
            <X class="size-4" />
          </button>
        </header>
        <p class="text-muted-foreground">The browser can't reach the clipboard here. The text is selected: copy it yourself.</p>
        <textarea
          readonly
          rows="14"
          aria-label="The exported text"
          :value="shown"
          class="block w-full rounded-md border bg-background p-2 font-mono"
          @vue:mounted="({ el }: { el: HTMLTextAreaElement }) => (el.focus(), el.select())"
          @focus="selectAll"
        />
      </div>
    </div>

    <Teleport to="body">
      <div v-if="printing" v-images data-testid="questionnaire-print" class="questionnaire-print" v-html="printing" />
    </Teleport>
  </div>
</template>
