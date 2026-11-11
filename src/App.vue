<script setup lang="ts">
import { House, NotebookText, Search } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { db } from './notebook'
import { RECORD_TYPES, type RecordType } from './record-types'
import { SAVE_STATUS_LABELS, saveStatus } from './save-status'
import StartScreen from './StartScreen.vue'
import type { NotebookStorage } from './storage'
import { fsaStorage } from './storage-fsa'

// A prop so tests, and later the file-input fallback, can swap the storage.
const { storage = fsaStorage } = defineProps<{ storage?: NotebookStorage }>()

const selected = ref<'home' | RecordType>('home')
const selectedLabel = computed(
  () => RECORD_TYPES.find((t) => t.type === selected.value)?.label ?? 'Home',
)

const item =
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium [&>svg]:size-4 [&>svg]:shrink-0'
</script>

<template>
  <StartScreen v-if="!db" :storage="storage" />
  <div v-else class="flex h-screen">
    <aside
      data-testid="sidebar"
      class="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div class="flex h-12 items-center gap-2 px-4 font-semibold">
        <NotebookText class="size-4" />
        Notebook
      </div>

      <nav class="flex-1 overflow-y-auto px-2 pb-2">
        <button
          type="button"
          data-testid="search"
          class="mb-2 flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-2 text-muted-foreground"
        >
          <Search class="size-4" />
          <span class="flex-1 text-left">Search</span>
          <kbd class="rounded border px-1 font-sans text-xs">⌘K</kbd>
        </button>

        <button
          type="button"
          :class="item"
          :aria-current="selected === 'home' ? 'page' : undefined"
          @click="selected = 'home'"
        >
          <House />
          Home
        </button>

        <h2 class="px-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">Records</h2>
        <button
          v-for="t in RECORD_TYPES"
          :key="t.type"
          type="button"
          data-testid="record-type"
          :class="item"
          :aria-current="selected === t.type ? 'page' : undefined"
          @click="selected = t.type"
        >
          <component :is="t.icon" />
          {{ t.label }}
        </button>

        <h2 class="px-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">Tags</h2>
        <p class="px-2 text-muted-foreground">No Tags yet</p>
      </nav>

      <footer
        data-testid="save-status"
        role="status"
        class="border-t border-sidebar-border px-4 py-2 text-xs text-muted-foreground"
      >
        {{ SAVE_STATUS_LABELS[saveStatus] }}
      </footer>
    </aside>

    <section data-testid="list-column" class="w-72 shrink-0 overflow-y-auto border-r">
      <h1 class="flex h-12 items-center border-b px-4 font-semibold">{{ selectedLabel }}</h1>
      <p class="p-4 text-muted-foreground">Nothing here yet.</p>
    </section>

    <main data-testid="page-column" class="flex-1 overflow-y-auto">
      <p class="p-4 text-muted-foreground">Select a Record to see its page.</p>
    </main>
  </div>
</template>
