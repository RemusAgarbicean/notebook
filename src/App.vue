<script setup lang="ts">
import { House, NotebookText, Search, Tag } from 'lucide-vue-next'
import { computed, watch } from 'vue'
import { current, list } from './navigation'
import { db } from './notebook'
import RecordList from './RecordList.vue'
import RecordPage from './RecordPage.vue'
import { RECORD_TYPES } from './record-types'
import { listTags } from './records'
import { SAVE_STATUS_LABELS, saveStatus } from './save-status'
import StartScreen from './StartScreen.vue'
import type { NotebookStorage } from './storage'
import { fsaStorage } from './storage-fsa'
import OtherTabScreen from './OtherTabScreen.vue'
import SaveGuards from './SaveGuards.vue'
import { tabLock } from './tab-lock'
import ThemeSwitch from './ThemeSwitch.vue'

// A prop so tests, and later the file-input fallback, can swap the storage.
const { storage = fsaStorage } = defineProps<{ storage?: NotebookStorage }>()

const tags = computed(() => (db.value ? listTags() : []))

// Choosing something in the sidebar changes the list and closes the open page.
function show(target: typeof list.value) {
  list.value = target
  current.value = null
}
// Another Notebook has other Records behind the same ids.
watch(db, () => show('home'))

const item =
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium [&>svg]:size-4 [&>svg]:shrink-0'
</script>

<template>
  <OtherTabScreen v-if="tabLock.blocked.value" />
  <StartScreen v-else-if="!db" :storage="storage" />
  <div v-else class="flex h-screen">
    <SaveGuards />
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
          :aria-current="list === 'home' ? 'page' : undefined"
          @click="show('home')"
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
          :aria-current="list === t.type ? 'page' : undefined"
          @click="show(t.type)"
        >
          <component :is="t.icon" />
          {{ t.label }}
        </button>

        <h2 class="px-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">Tags</h2>
        <button
          v-for="t in tags"
          :key="t.id"
          type="button"
          data-testid="tag"
          :class="item"
          :aria-current="typeof list === 'object' && list.tag === t.id ? 'page' : undefined"
          @click="show({ tag: t.id })"
        >
          <Tag />
          <span class="truncate">{{ t.name }}</span>
        </button>
        <p v-if="!tags.length" class="px-2 text-muted-foreground">No Tags yet</p>
      </nav>

      <footer class="border-t border-sidebar-border px-2 py-2 text-xs text-muted-foreground">
        <ThemeSwitch />
        <div data-testid="save-status" role="status" class="px-2 pt-2">
          {{ SAVE_STATUS_LABELS[saveStatus] }}
        </div>
      </footer>
    </aside>

    <RecordList />

    <main data-testid="page-column" class="flex-1 overflow-y-auto">
      <RecordPage v-if="current" :key="`${current.type}:${current.id}`" :type="current.type" :id="current.id" />
      <p v-else class="p-4 text-muted-foreground">Select a Record to see its page.</p>
    </main>
  </div>
</template>
