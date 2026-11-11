<script setup lang="ts">
import { Undo2, X } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { current, openRecord } from './navigation'
import { shortcut } from './platform'
import type { Titled } from './records'
import { lastDeleted, undoDelete } from './undo-delete'

// The "Deleted … Undo" notice after a delete, and Ctrl/Cmd+Z, which keeps working after the notice has gone.
const SHOWN_MS = 20_000

const notice = ref<Titled | null>(null)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let undoing = false

function hide() {
  clearTimeout(timer)
  notice.value = null
  error.value = ''
}

// A new delete shows the notice; an Undo uncovering the delete before it does not.
watch(lastDeleted, (now) => {
  if (undoing) return
  hide()
  if (!now) return
  notice.value = now
  timer = setTimeout(hide, SHOWN_MS)
})

async function undo() {
  const last = lastDeleted()
  if (!last) return
  undoing = true
  const was = current.value
  try {
    // An open Diagram saves its canvas as it closes: that must not land on top of the Nodes linked again.
    current.value = null
    await nextTick()
    const back = undoDelete()
    hide()
    if (back) openRecord(back.type, back.id)
    await nextTick()
  } catch (e) {
    // Nothing came back: the user stays where they were and the notice says why, until dismissed.
    current.value = was
    clearTimeout(timer)
    notice.value = last
    error.value = `Can't undo: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    undoing = false
  }
}

function onKey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z' || !lastDeleted()) return
  // Typing and a Diagram have an Undo of their own.
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .diagram-canvas')) return
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
  e.preventDefault()
  void undo()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(timer)
})
</script>

<template>
  <div
    v-if="notice"
    data-testid="undo-notice"
    role="status"
    class="fixed bottom-4 left-1/2 z-20 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-lg border bg-popover py-1.5 pr-1.5 pl-3 text-sm text-popover-foreground shadow-lg"
  >
    <span class="min-w-0 truncate" :title="error || notice.title">{{ error || `Deleted ${notice.title}.` }}</span>
    <button
      type="button"
      data-testid="undo-delete"
      :title="`Put it back (${shortcut('Z')})`"
      class="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
      @click="undo"
    >
      <Undo2 class="size-3.5" />
      Undo
    </button>
    <button type="button" aria-label="Dismiss" class="shrink-0 rounded-md p-1 hover:bg-accent" @click="hide">
      <X class="size-3.5" />
    </button>
  </div>
</template>
