<script setup lang="ts">
import { CalendarClock } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { parseDate } from './bulk-import'
import { pushDate, type PushChoice } from './due'
import { updateRecord } from './records'

// Push on a Task row: moves its due date to Tomorrow, Next week or a picked date, saved like any page edit.
const props = defineProps<{ id: number; title: string }>()

const open = ref(false)
const picking = ref(false)
// Fixed to the window, so the menu is not clipped by a scrolling list such as a Home card's rows.
const menuPos = ref({ top: 0, left: 0 })
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const menu = useTemplateRef<HTMLElement>('menu')
const picker = useTemplateRef<HTMLInputElement>('picker')

async function toggle() {
  if (open.value) return close()
  const box = trigger.value!.getBoundingClientRect()
  menuPos.value = { top: box.bottom + 4, left: Math.max(8, box.right - 160) }
  picking.value = false
  open.value = true
  await nextTick()
  menu.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
}

function close(refocus = false) {
  open.value = false
  if (refocus) trigger.value?.focus()
}

function save(due: string) {
  close(true)
  updateRecord('task', props.id, { due })
}

const choose = (choice: PushChoice) => save(pushDate(choice))

async function pick() {
  picking.value = true
  await nextTick()
  picker.value?.focus()
  picker.value?.showPicker?.()
}

// Saved on Enter or Set, not on change, which fires on every complete date while the user types one.
function savePicked() {
  const due = parseDate(picker.value?.value ?? '')
  if (due) save(due)
}

// ArrowDown and ArrowUp move between the menu items, wrapping at the ends; the date box keeps its own arrows.
function move(e: KeyboardEvent, step: number) {
  if (e.target instanceof HTMLInputElement) return
  e.preventDefault()
  const items = [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next = at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length
  items[next]?.focus()
}

// Focus moving to somewhere outside the menu, as with Tab, closes it.
function leave(e: FocusEvent) {
  if (open.value && e.relatedTarget && !root.value?.contains(e.relatedTarget as Node)) close()
}

// A click or a scroll elsewhere closes the menu.
function outside(e: Event) {
  if (!root.value?.contains(e.target as Node)) close()
}
watch(open, (on) => {
  for (const name of ['pointerdown', 'scroll'] as const) {
    if (on) document.addEventListener(name, outside, true)
    else document.removeEventListener(name, outside, true)
  }
})
onBeforeUnmount(() => (open.value = false))
</script>

<template>
  <div ref="root" class="shrink-0" @keydown.esc.stop="close(true)" @focusout="leave">
    <button
      ref="trigger"
      type="button"
      :aria-label="`Push: ${title}`"
      title="Push"
      aria-haspopup="menu"
      :aria-expanded="open"
      class="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      @click="toggle"
    >
      <CalendarClock class="size-3.5" />
    </button>
    <div
      v-if="open"
      ref="menu"
      role="menu"
      :aria-label="`Push ${title} to`"
      class="fixed z-50 flex w-40 flex-col rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      :style="{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }"
      @keydown.down="move($event, 1)"
      @keydown.up="move($event, -1)"
    >
      <button type="button" role="menuitem" class="rounded px-2 py-1 text-left hover:bg-accent" @click="choose('tomorrow')">
        Tomorrow
      </button>
      <button type="button" role="menuitem" class="rounded px-2 py-1 text-left hover:bg-accent" @click="choose('next-week')">
        Next week
      </button>
      <button v-if="!picking" type="button" role="menuitem" class="rounded px-2 py-1 text-left hover:bg-accent" @click="pick">
        Pick a date
      </button>
      <div v-else class="flex gap-1">
        <input
          ref="picker"
          type="date"
          :aria-label="`Push date: ${title}`"
          class="h-7 min-w-0 flex-1 rounded border bg-background px-1"
          @keydown.enter.prevent="savePicked"
        />
        <button
          type="button"
          :aria-label="`Set date: ${title}`"
          class="h-7 rounded border px-2 font-medium hover:bg-accent"
          @click="savePicked"
        >
          Set
        </button>
      </div>
    </div>
  </div>
</template>
