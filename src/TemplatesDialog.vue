<script setup lang="ts">
import { LayoutTemplate, X } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { vDialog, vFocus } from './dialog'
import { DEFAULT_TEMPLATES, getTemplate, resetTemplate, setTemplate, TEMPLATES, type TemplateKey } from './templates'

// The sidebar's "Templates" button and the dialog it opens: the notes a new Record starts with, per type.
const open = ref(false)
const key = ref<TemplateKey>('meeting')
const text = ref('')
// Settings are not reactive, so the text is read whenever the dialog opens or another template is chosen.
watch([open, key], () => (text.value = getTemplate(key.value)))

function reset() {
  resetTemplate(key.value)
  text.value = getTemplate(key.value)
}
</script>

<template>
  <button
    type="button"
    data-testid="open-templates"
    class="mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    @click="open = true"
  >
    <LayoutTemplate class="size-4" />
    Templates
  </button>

  <div
    v-if="open"
    v-dialog
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="open = false"
    @keydown.esc="open = false"
  >
    <div
      data-testid="templates-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-title"
      class="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg"
    >
      <header class="flex items-center">
        <h2 id="templates-title" class="flex-1 font-semibold">Note templates</h2>
        <button
          v-focus
          type="button"
          data-testid="close-templates"
          aria-label="Close"
          class="rounded-md p-1 hover:bg-accent"
          @click="open = false"
        >
          <X class="size-4" />
        </button>
      </header>
      <p class="text-muted-foreground">
        A Record made with New starts with its type's template as its notes. A Journal entry takes the meeting template
        when its kind becomes meeting while its notes are still untouched.
      </p>
      <select v-model="key" data-testid="template-key" aria-label="Template for" class="h-8 rounded-md border bg-background px-2">
        <option v-for="t in TEMPLATES" :key="t.key" :value="t.key">{{ t.name }}</option>
      </select>
      <textarea
        v-model="text"
        data-testid="template-text"
        aria-label="Template"
        rows="10"
        placeholder="Empty: the notes start empty."
        class="block w-full rounded-md border bg-background p-2 font-mono"
        @input="setTemplate(key, text)"
      />
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">Saved as you type, in this Notebook.</span>
        <button
          type="button"
          data-testid="reset-template"
          :disabled="text === (DEFAULT_TEMPLATES[key] ?? '')"
          class="h-7 rounded-md border px-3 font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          @click="reset"
        >
          Reset to the original
        </button>
      </div>
    </div>
  </div>
</template>
