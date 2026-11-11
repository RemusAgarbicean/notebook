<script setup lang="ts">
import { Bold, Brackets, Code, Heading, Italic, Link, List, ListChecks, ListOrdered } from 'lucide-vue-next'
import { shortcut } from './platform'

// The row of formatting buttons above a markdown textarea. It only says which button was pressed.
export type FormatAction = 'bold' | 'italic' | 'code' | 'link' | 'bullet' | 'number' | 'task' | 'heading' | 'mention'
defineEmits<{ run: [action: FormatAction] }>()

const BUTTONS: { action: FormatAction; name: string; icon: typeof Bold; key?: string }[] = [
  { action: 'bold', name: 'Bold', icon: Bold, key: 'B' },
  { action: 'italic', name: 'Italic', icon: Italic, key: 'I' },
  { action: 'code', name: 'Code', icon: Code, key: 'E' },
  { action: 'link', name: 'Link', icon: Link },
  { action: 'heading', name: 'Heading', icon: Heading },
  { action: 'bullet', name: 'Bulleted list', icon: List },
  { action: 'number', name: 'Numbered list', icon: ListOrdered },
  { action: 'task', name: 'Task list', icon: ListChecks },
  { action: 'mention', name: 'Mention a Record', icon: Brackets },
]

// The bar is one Tab stop; the arrow keys move between its buttons.
function move(e: KeyboardEvent, by: number) {
  const all = [...(e.currentTarget as HTMLElement).querySelectorAll('button')]
  all[(all.indexOf(document.activeElement as HTMLButtonElement) + by + all.length) % all.length].focus()
}
</script>

<template>
  <div
    role="toolbar"
    aria-label="Formatting"
    data-testid="format-bar"
    class="mb-1 flex gap-0.5 print:hidden"
    @keydown.left.prevent="move($event, -1)"
    @keydown.right.prevent="move($event, 1)"
  >
    <!-- mousedown is cancelled so a click leaves the focus, and the selection, in the textarea. -->
    <button
      v-for="(b, i) in BUTTONS"
      :key="b.action"
      type="button"
      :tabindex="i ? -1 : 0"
      :data-testid="`format-${b.action}`"
      :aria-label="b.name"
      :title="b.key ? `${b.name} (${shortcut(b.key)})` : b.name"
      class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      @mousedown.prevent
      @click="$emit('run', b.action)"
    >
      <component :is="b.icon" class="size-4" />
    </button>
  </div>
</template>
