<script setup lang="ts">
// What the user sees when edits cannot reach the disk: the Not saved banner
// and the Reload/Overwrite choice.
import { ref } from 'vue'
import { vDialog } from './dialog'
import { db, overwriteDisk, reloadFromDisk, saveNow, saveProblem } from './notebook'

const error = ref('')

async function reload() {
  error.value = ''
  try {
    await reloadFromDisk()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function downloadCopy() {
  const url = URL.createObjectURL(new Blob([db.value!.export() as Uint8Array<ArrayBuffer>]))
  Object.assign(document.createElement('a'), { href: url, download: 'notebook.sqlite' }).click()
  URL.revokeObjectURL(url)
}

const button = 'h-8 rounded-md border px-3 font-medium'
const onRed = 'border-white hover:bg-white/15'
</script>

<template>
  <div
    v-if="saveProblem === 'failed'"
    data-testid="not-saved-banner"
    role="alert"
    class="fixed right-0 bottom-0 left-56 z-40 flex flex-wrap items-center justify-center gap-3 bg-red-600 px-4 py-2 text-white"
  >
    <span><strong>Not saved.</strong> Your edits are kept here until a save works.</span>
    <button type="button" :class="[button, onRed]" @click="saveNow()">Retry</button>
    <button type="button" :class="[button, onRed]" @click="downloadCopy">
      Download a copy
    </button>
  </div>

  <div
    v-if="saveProblem === 'changed'"
    v-dialog
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
  >
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="changed-title"
      class="flex w-full max-w-sm flex-col gap-3 rounded-lg border bg-background p-4 text-sm text-foreground shadow-lg"
    >
      <h2 id="changed-title" class="font-semibold">The Notebook file changed outside the app</h2>
      <p class="text-muted-foreground">
        Reload from disk drops the edits made here that are not saved yet. Overwrite replaces the
        file with what is here.
      </p>
      <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" :class="[button, 'hover:bg-accent']" @click="overwriteDisk()">Overwrite</button>
        <button
          v-focus
          type="button"
          :class="[button, 'border-primary bg-primary text-primary-foreground hover:bg-primary/90']"
          @click="reload"
        >
          Reload from disk
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// The default choice has the focus, so Enter picks it.
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
</script>
