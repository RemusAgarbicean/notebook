<script setup lang="ts">
import { onMounted, useId, useTemplateRef } from 'vue'
import { vDialog } from './dialog'

// A small modal that asks one thing: Enter confirms, Esc or a click outside cancels.
// The slot holds the message, or an input that then gets the focus.
defineProps<{ title: string; confirmLabel: string; destructive?: boolean }>()
defineEmits<{ confirm: []; cancel: [] }>()

const id = useId()
const form = useTemplateRef('form')
const ok = useTemplateRef('ok')

onMounted(() => {
  const input = form.value!.querySelector('input')
  ;(input ?? ok.value!).focus()
  input?.select()
})

const button = 'h-8 rounded-md border px-3 font-medium'
</script>

<template>
  <!-- These keys are not for the page behind (the Diagram's Delete and Esc); Ctrl+S and Ctrl+K still are. -->
  <div
    v-dialog
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="$emit('cancel')"
    @keydown.delete.stop
    @keydown.esc.stop
    @keydown.enter.stop
    @keydown.esc="$emit('cancel')"
  >
    <form
      ref="form"
      :role="destructive ? 'alertdialog' : 'dialog'"
      aria-modal="true"
      :aria-labelledby="id"
      class="flex w-full max-w-sm flex-col gap-3 rounded-lg border bg-background p-4 shadow-lg"
      @submit.prevent="$emit('confirm')"
    >
      <h2 :id="id" class="font-semibold break-words">{{ title }}</h2>
      <slot />
      <div class="flex justify-end gap-2">
        <button type="button" data-testid="dialog-cancel" :class="[button, 'hover:bg-accent']" @click="$emit('cancel')">
          Cancel
        </button>
        <button
          ref="ok"
          type="submit"
          data-testid="dialog-confirm"
          :class="[
            button,
            destructive
              ? 'border-transparent bg-red-600 text-white hover:bg-red-700'
              : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          ]"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </form>
  </div>
</template>
