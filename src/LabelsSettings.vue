<script setup lang="ts">
import { Tags, Trash2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { vDialog, vFocus } from './dialog'
import { addLabel, deleteLabel, listLabels, renameLabel, type Label } from './relations'

// The sidebar's "Labels" button and the settings screen it opens.
const open = ref(false)
const labels = computed(() => (open.value ? listLabels() : []))
const error = ref('')
const forward = ref('')
const reverse = ref('')

function attempt(action: () => void) {
  try {
    action()
    error.value = ''
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    return false
  }
}

function rename(label: Label, side: 'forward' | 'reverse', e: Event) {
  const input = e.target as HTMLInputElement
  const next = { ...label, [side]: input.value }
  // A refused reading is not what is saved, so show the saved one again.
  if (!attempt(() => renameLabel(label.id, next.forward, next.reverse))) input.value = label[side]
}

function add() {
  if (attempt(() => addLabel(forward.value, reverse.value))) forward.value = reverse.value = ''
}

const whyNot = (l: Label) =>
  l.protected
    ? 'The app relies on this label, so it can only be renamed'
    : l.uses
      ? 'In use: remove its Relations first'
      : `Delete the label ${l.forward}`

const input = 'h-7 w-full rounded-md border bg-background px-2'
</script>

<template>
  <button
    type="button"
    data-testid="open-labels"
    class="mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    @click="((open = true), (error = ''))"
  >
    <Tags class="size-4" />
    Labels
  </button>

  <div
    v-if="open"
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="open = false"
    @keydown.esc="open = false"
  >
    <div
      data-testid="labels-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="labels-title"
      class="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center">
        <h2 id="labels-title" class="flex-1 font-semibold">Relation labels</h2>
        <button
          v-focus
          type="button"
          data-testid="close-labels"
          aria-label="Close"
          class="rounded-md p-1 hover:bg-accent"
          @click="open = false"
        >
          <X class="size-4" />
        </button>
      </header>
      <p class="text-muted-foreground">
        Each label reads one way from one Record and the other way from the other. Renaming a label renames it on every
        Record.
      </p>

      <table class="w-full">
        <thead class="text-left text-xs text-muted-foreground">
          <tr>
            <th class="font-medium">Forward</th>
            <th class="font-medium">Reverse</th>
            <th class="px-2 text-right font-medium">Relations</th>
            <th><span class="sr-only">Delete</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in labels" :key="l.id" data-testid="label-row">
            <td class="py-0.5 pr-1">
              <input
                data-testid="label-forward"
                :aria-label="`Forward reading of ${l.forward}`"
                :value="l.forward"
                :class="input"
                @change="rename(l, 'forward', $event)"
              />
            </td>
            <td class="py-0.5 pr-1">
              <input
                data-testid="label-reverse"
                :aria-label="`Reverse reading of ${l.forward}`"
                :value="l.reverse"
                :class="input"
                @change="rename(l, 'reverse', $event)"
              />
            </td>
            <td data-testid="label-uses" class="px-2 text-right tabular-nums">{{ l.uses }}</td>
            <td>
              <button
                type="button"
                data-testid="label-delete"
                :disabled="!l.deletable"
                :title="whyNot(l)"
                :aria-label="whyNot(l)"
                class="rounded-md p-1 hover:bg-accent hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                @click="attempt(() => deleteLabel(l.id))"
              >
                <Trash2 class="size-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>

      <form data-testid="add-label" class="flex items-center gap-1 border-t pt-3" @submit.prevent="add">
        <input
          v-model="forward"
          data-testid="new-label-forward"
          aria-label="New label, forward reading"
          placeholder="reports to"
          :class="input"
        />
        <input
          v-model="reverse"
          data-testid="new-label-reverse"
          aria-label="New label, reverse reading"
          placeholder="manages"
          :class="input"
        />
        <button type="submit" class="h-7 shrink-0 rounded-md border px-3 font-medium hover:bg-accent">Add label</button>
      </form>
    </div>
  </div>
</template>
