<script setup lang="ts">
// The sidebar header: the open Notebook's name, and a menu to switch to one
// of the Recent Notebooks, open or create another one, or close it.
import { ChevronDown, NotebookText, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { notebookName, saveNow } from './notebook'
import { manualSave, saveStatus } from './save-status'
import type { NotebookFolder, NotebookStorage, RecentNotebook } from './storage'
import { closeCurrent, openFrom, openRecentId, type OpenOutcome } from './switch-notebook'

const props = defineProps<{ storage: NotebookStorage }>()

type Item = { key: string; label: string; current?: boolean; separated?: boolean; run: () => Promise<OpenOutcome> }

const name = notebookName() ?? 'Notebook'
const open = ref(false)
const recent = ref<RecentNotebook[]>([])
const problem = ref<OpenOutcome>({ error: '' })
// The choice waiting on "Download first / Switch anyway" (download fallback only).
const pending = ref<Item | null>(null)
const button = useTemplateRef('button')
const menu = useTemplateRef('menu')

const go = (getFolder: () => Promise<NotebookFolder | null>, create = false, recent?: RecentNotebook) => () =>
  openFrom(props.storage, getFolder, { create, recent })
const close: Item = { key: 'close', label: 'Close Notebook', separated: true, run: async () => ({ error: await closeCurrent() }) }

const items = computed<Item[]>(() =>
  props.storage.blank
    ? [
        { key: 'pick', label: 'Open notebook.sqlite…', run: go(props.storage.pick) },
        { key: 'new', label: 'Create new Notebook', run: go(async () => props.storage.blank!(), true) },
        close,
      ]
    : [
        ...recent.value.map((r) => ({
          key: r.id,
          label: r.name,
          current: r.id === openRecentId.value,
          run: go(() => props.storage.reopen(r.id), false, r),
        })),
        { key: 'pick', label: 'Open another folder…', separated: recent.value.length > 0, run: go(props.storage.pick) },
        { key: 'new', label: 'Create new Notebook…', run: go(props.storage.pick, true) },
        close,
      ],
)

const menuItems = () => [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

async function show(focus: 'first' | 'last' = 'first') {
  if (!props.storage.blank) recent.value = await props.storage.recent()
  open.value = true
  document.addEventListener('pointerdown', outside)
  await nextTick()
  const all = menuItems()
  ;(focus === 'first' ? all[0] : all.at(-1))?.focus()
}

function hide(returnFocus = true) {
  open.value = false
  document.removeEventListener('pointerdown', outside)
  if (returnFocus) button.value?.focus()
}
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))

function outside(e: Event) {
  if (!menu.value?.contains(e.target as Node) && !button.value?.contains(e.target as Node)) hide(false)
}

function onButtonKey(e: KeyboardEvent) {
  if (!['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) return
  // Not also the click Enter and Space would make.
  e.preventDefault()
  void show(e.key === 'ArrowUp' ? 'last' : 'first')
}

function onMenuKey(e: KeyboardEvent) {
  const all = menuItems()
  const at = all.indexOf(document.activeElement as HTMLElement)
  const move = (to: number) => {
    e.preventDefault()
    all[(to + all.length) % all.length]?.focus()
  }
  if (e.key === 'ArrowDown') move(at + 1)
  else if (e.key === 'ArrowUp') move(at < 0 ? -1 : at - 1)
  else if (e.key === 'Home') move(0)
  else if (e.key === 'End') move(-1)
  else if (e.key === 'Escape') {
    e.preventDefault()
    // Not also the Esc of the page behind.
    e.stopPropagation()
    hide()
  } else if (e.key === 'Tab') hide(false)
}

async function choose(item: Item) {
  // The open Notebook: nothing to do.
  if (item.current) return
  hide()
  // On the download fallback the app cannot save by itself: edits not downloaded would be lost.
  if (manualSave.value && saveStatus.value !== 'saved') pending.value = item
  else await run(item)
}

async function run(item: Item) {
  problem.value = { error: '' }
  problem.value = await item.run()
}

async function decide(downloadFirst: boolean) {
  const item = pending.value!
  pending.value = null
  if (downloadFirst) await saveNow(true)
  await run(item)
}

async function forget(id: string) {
  await props.storage.forget(id)
  problem.value = { error: '' }
}

const entry =
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground aria-disabled:cursor-default aria-disabled:font-medium'
</script>

<template>
  <div class="relative px-2 pt-2 pb-1">
    <button
      ref="button"
      type="button"
      data-testid="notebook-menu"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      aria-controls="notebook-menu-list"
      :title="name"
      class="flex h-9 w-full items-center gap-2 rounded-md px-2 font-semibold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0"
      @click="open ? hide() : show()"
      @keydown="onButtonKey"
      @keyup.space.prevent
    >
      <NotebookText />
      <span class="min-w-0 flex-1 truncate text-left">{{ name }}</span>
      <ChevronDown class="text-muted-foreground" />
    </button>

    <div
      v-if="open"
      id="notebook-menu-list"
      ref="menu"
      role="menu"
      aria-label="Notebooks"
      class="absolute inset-x-2 top-full z-30 flex flex-col rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      @keydown="onMenuKey"
    >
      <template v-for="item in items" :key="item.key">
        <div v-if="item.separated" role="separator" class="-mx-1 my-1 h-px bg-border" />
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          :aria-disabled="item.current ? 'true' : undefined"
          :title="item.label"
          :class="entry"
          @click="choose(item)"
        >
          <span class="min-w-0 truncate">{{ item.current ? '✓ ' : '' }}{{ item.label }}</span>
        </button>
      </template>
    </div>

    <div
      v-if="problem.error"
      role="alert"
      class="mt-1 flex flex-col items-start gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
    >
      <div class="flex w-full items-start gap-1">
        <p class="flex-1">{{ problem.error }}</p>
        <button type="button" aria-label="Dismiss" class="shrink-0 rounded hover:bg-destructive/10" @click="problem = { error: '' }">
          <X class="size-3.5" />
        </button>
      </div>
      <button
        v-if="problem.missing"
        type="button"
        class="rounded-md border border-destructive/40 px-2 py-0.5 font-medium hover:bg-destructive/10"
        @click="forget(problem.missing)"
      >
        Remove from list
      </button>
    </div>

    <ConfirmDialog
      v-if="pending"
      title="Leave without downloading?"
      confirm-label="Download first"
      alternative-label="Switch anyway"
      @confirm="decide(true)"
      @alternative="decide(false)"
      @cancel="pending = null"
    >
      <p class="text-muted-foreground">
        The latest changes to this Notebook are not downloaded yet. Without a download they are lost.
      </p>
    </ConfirmDialog>
  </div>
</template>
