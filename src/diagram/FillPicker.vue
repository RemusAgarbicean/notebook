<script setup lang="ts">
import { Ban } from 'lucide-vue-next'
import { FILL_NAMES, fillVars, type FillName } from './fills'

defineProps<{ disabled?: boolean }>()
defineEmits<{ pick: [fill: FillName | null] }>()

const swatch = 'fill-swatch flex size-5 items-center justify-center rounded border disabled:opacity-40'
</script>

<template>
  <div class="flex items-center gap-1">
    <button type="button" aria-label="No fill" title="No fill" :class="swatch" :disabled="disabled" @click="$emit('pick', null)">
      <Ban class="size-3 text-muted-foreground" />
    </button>
    <button
      v-for="name in FILL_NAMES"
      :key="name"
      type="button"
      :aria-label="`Fill ${name}`"
      :title="name"
      :class="swatch"
      :style="fillVars(name)"
      :disabled="disabled"
      @click="$emit('pick', name)"
    />
  </div>
</template>

<style>
.fill-swatch {
  background: var(--fill-light, transparent);
}
.dark .fill-swatch {
  background: var(--fill-dark, transparent);
}
</style>
