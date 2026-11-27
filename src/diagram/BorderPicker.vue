<script setup lang="ts">
import { BORDER_NAMES, type BorderName } from './borders'

defineProps<{ disabled?: boolean }>()
defineEmits<{ pick: [border: BorderName] }>()

// Each swatch shows its border; "none" shows a faint one struck through.
const swatch = 'border-swatch flex size-5 items-center justify-center rounded disabled:opacity-40'
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      v-for="name in BORDER_NAMES"
      :key="name"
      type="button"
      :aria-label="`Border ${name}`"
      :title="`Border: ${name}`"
      :class="[swatch, `swatch-${name}`]"
      :disabled="disabled"
      @click="$emit('pick', name)"
    />
  </div>
</template>

<style>
.border-swatch {
  border: 1.5px solid currentColor;
  color: var(--muted-foreground);
}
.border-swatch.swatch-dashed {
  border-style: dashed;
}
.border-swatch.swatch-dotted {
  border-style: dotted;
}
.border-swatch.swatch-none {
  border-color: transparent;
  background: linear-gradient(to top right, transparent calc(50% - 0.75px), currentColor, transparent calc(50% + 0.75px));
  outline: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  outline-offset: -1px;
}
</style>
