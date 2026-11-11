<script setup lang="ts">
// The only way a Notebook opened without the File System Access API reaches the disk.
import { Download } from 'lucide-vue-next'
import { saveNow } from './notebook'
import { shortcut } from './platform'
import { manualSave, saveStatus } from './save-status'
</script>

<template>
  <button
    v-if="manualSave"
    type="button"
    :title="`Download notebook.sqlite (${shortcut('S')})`"
    class="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-md border px-2 text-sm font-medium"
    :class="
      saveStatus === 'saved'
        ? 'border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent'
        : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
    "
    @click="saveNow(true)"
  >
    <Download class="size-4" />
    Download Notebook
  </button>
</template>
