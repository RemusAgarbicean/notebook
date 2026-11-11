<script setup lang="ts">
import { Cylinder, Diamond, RectangleHorizontal, Square, Type } from 'lucide-vue-next'
import { SHAPE_NAMES, SHAPES, type ShapeName } from './shapes'

defineProps<{ disabled?: boolean }>()
defineEmits<{ pick: [shape: ShapeName] }>()

const ICONS = { rectangle: Square, pill: RectangleHorizontal, diamond: Diamond, cylinder: Cylinder, note: Type }
</script>

<template>
  <div class="flex items-center">
    <button
      v-for="name in SHAPE_NAMES"
      :key="name"
      type="button"
      :aria-label="`Shape: ${SHAPES[name]}`"
      :title="`Shape: ${SHAPES[name]}`"
      class="flex size-7 items-center justify-center rounded-md hover:bg-accent disabled:opacity-40"
      :disabled="disabled"
      @click="$emit('pick', name)"
    >
      <component :is="ICONS[name]" class="size-3.5" />
    </button>
  </div>
</template>
