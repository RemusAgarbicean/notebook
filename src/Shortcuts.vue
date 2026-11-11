<script setup lang="ts">
import { Keyboard, X } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { vDialog, vFocus } from './dialog'
import { shortcut } from './platform'
import { shortcutAction, type ShortcutAction } from './shortcuts'

// The sidebar's "Shortcuts" button, the dialog that lists them, and the single-key shortcuts themselves.
const open = ref(false)

const ROWS: { keys: string[]; does: string }[] = [
  { keys: [shortcut('K')], does: 'Search the Notebook' },
  { keys: [shortcut('S')], does: 'Save now' },
  { keys: [shortcut('Z')], does: 'Undo the last delete of a Record' },
  { keys: ['/'], does: 'Filter the list' },
  { keys: ['N'], does: 'New Record of the type shown' },
  { keys: ['J', 'K'], does: 'Next and previous Record in the list; Enter opens it' },
  { keys: ['↓', '↑'], does: 'The same, from inside the list' },
  { keys: ['E'], does: 'Edit the notes of the open Record' },
  { keys: [shortcut('B'), shortcut('I'), shortcut('E')], does: 'Bold, italic and code while editing notes' },
  { keys: ['Tab', 'Shift Tab'], does: 'Indent and outdent a list item while editing notes; Esc ends editing' },
  { keys: ['?'], does: 'Show these shortcuts' },
]

const DIAGRAM_ROWS: typeof ROWS = [
  { keys: [shortcut('Z'), shortcut('Shift Z')], does: 'Undo and redo' },
  { keys: ['Double-click'], does: 'On the canvas: a new Node. On a Node or Edge: its text or options' },
  { keys: ['Tab'], does: 'A connected Node after the selected one' },
  { keys: ['Enter', 'F2'], does: 'Edit the selected Node, Frame or Edge; Shift Enter breaks the line' },
  { keys: [shortcut('D')], does: 'Duplicate the selection' },
  { keys: [shortcut('C'), shortcut('X'), shortcut('V')], does: 'Copy, cut and paste, also into another Diagram' },
  { keys: ['←↑↓→'], does: 'Nudge the selection; with Shift, further' },
  { keys: ['Delete'], does: 'Remove the selection' },
  { keys: ['Shift F10'], does: 'The menu of the selected Node or Edge, like a right-click' },
  { keys: ['Esc'], does: 'Deselect the Node in focus; leave full screen' },
]

const find = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)

// Each shortcut presses the control a mouse would, so the two can't drift apart.
const ACTIONS: Record<ShortcutAction, () => void> = {
  help: () => (open.value = true),
  filter() {
    const box = find<HTMLInputElement>('[data-testid="list-filter"]')
    box?.focus()
    box?.select()
  },
  new: () => find('[data-testid="new-record"]')?.click(),
  edit() {
    const notes = find('[data-testid="notes"]')
    const area = notes?.querySelector('textarea')
    if (area) area.focus()
    else notes?.querySelector('button')?.click()
  },
  next: () => move(1),
  previous: () => move(-1),
}

// From the focused row, else the open Record's row, else the top.
function move(by: number) {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-testid="list-row"]')]
  const at = rows.findIndex((r) => r === document.activeElement)
  const from = at >= 0 ? at : rows.findIndex((r) => r.getAttribute('aria-current'))
  rows[Math.min(Math.max(from + by, 0), rows.length - 1)]?.focus()
}

function onKey(e: KeyboardEvent) {
  const action = shortcutAction(e)
  if (!action) return
  // The key is spent: it must not be typed into the box that just got the focus.
  e.preventDefault()
  ACTIONS[action]()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const kbd = 'rounded border bg-muted px-1.5 py-0.5 font-sans text-xs'
</script>

<template>
  <button
    type="button"
    data-testid="open-shortcuts"
    class="mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    @click="open = true"
  >
    <Keyboard class="size-4" />
    Shortcuts
    <kbd class="ml-auto rounded border px-1 font-sans">?</kbd>
  </button>

  <div
    v-if="open"
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="open = false"
    @keydown.esc="open = false"
  >
    <div
      data-testid="shortcuts-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      class="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center">
        <h2 id="shortcuts-title" class="flex-1 font-semibold">Keyboard shortcuts</h2>
        <button
          v-focus
          type="button"
          data-testid="close-shortcuts"
          aria-label="Close"
          class="rounded-md p-1 hover:bg-accent"
          @click="open = false"
        >
          <X class="size-4" />
        </button>
      </header>
      <dl class="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
        <template v-for="r in ROWS" :key="r.does">
          <dt data-testid="shortcut-keys" class="flex gap-1">
            <kbd v-for="k in r.keys" :key="k" :class="kbd">{{ k }}</kbd>
          </dt>
          <dd>{{ r.does }}</dd>
        </template>
      </dl>
      <h3 class="pt-1 text-xs font-medium text-muted-foreground">In a Diagram</h3>
      <dl class="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
        <template v-for="r in DIAGRAM_ROWS" :key="r.does">
          <dt data-testid="shortcut-keys" class="flex flex-wrap gap-1">
            <kbd v-for="k in r.keys" :key="k" :class="kbd">{{ k }}</kbd>
          </dt>
          <dd>{{ r.does }}</dd>
        </template>
      </dl>
      <p class="text-muted-foreground">
        The single keys work when you are not typing in a field or working in a Diagram. The browser's Back and Forward move between the places
        you have been.
      </p>
    </div>
  </div>
</template>
