<script setup lang="ts">
import { ClipboardCopy, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { copyText } from './clipboard'
import { vDialog } from './dialog'
import { recordMarkdown } from './record-markdown'
import type { RecordType } from './record-types'

// The Record page's "Copy as Markdown" button. When the clipboard refuses, the text is shown to copy by hand.
const props = defineProps<{ type: RecordType; id: number }>()

const copied = ref(false)
const shown = ref('')

async function copy() {
  const text = recordMarkdown(props.type, props.id)
  if (await copyText(text)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } else shown.value = text
}
const selectAll = (e: Event) => (e.target as HTMLTextAreaElement).select()
</script>

<template>
  <button
    type="button"
    data-testid="copy-markdown"
    title="Copy this Record as Markdown text"
    class="flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent hover:text-accent-foreground"
    @click="copy"
  >
    <ClipboardCopy class="size-3.5" />
    <span aria-live="polite">{{ copied ? 'Copied' : 'Copy as Markdown' }}</span>
  </button>

  <div
    v-if="shown"
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="shown = ''"
    @keydown.esc="shown = ''"
  >
    <div
      data-testid="copy-markdown-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-markdown-title"
      class="flex max-h-full w-full max-w-lg flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center">
        <h2 id="copy-markdown-title" class="flex-1 font-semibold">Copy as Markdown</h2>
        <button type="button" aria-label="Close" class="rounded-md p-1 hover:bg-accent" @click="shown = ''">
          <X class="size-4" />
        </button>
      </header>
      <p class="text-muted-foreground">The browser can't reach the clipboard here. The text is selected: copy it yourself.</p>
      <textarea
        readonly
        rows="14"
        aria-label="This Record as Markdown"
        :value="shown"
        class="block w-full rounded-md border bg-background p-2 font-mono"
        @vue:mounted="({ el }: { el: HTMLTextAreaElement }) => (el.focus(), el.select())"
        @focus="selectAll"
      />
    </div>
  </div>
</template>
