<script setup lang="ts" generic="T extends { type: string; id: number }">
import { useTemplateRef } from 'vue'
import { useWindowed } from './windowed'

// A Home card's rows: only those in view are in the page, so a card of thousands of open Tasks stays cheap.
const props = defineProps<{ rows: T[] }>()
const box = useTemplateRef('box')
// One line with py-1, as each row is styled.
const visible = useWindowed(box, () => props.rows, 28)
</script>

<template>
  <ul ref="box" class="max-h-72 overflow-y-auto">
    <li v-if="visible.before" aria-hidden="true" :style="{ height: `${visible.before}px` }" />
    <li v-for="r in visible.rows" :key="`${r.type}:${r.id}`" class="h-7">
      <slot :row="r" />
    </li>
    <li v-if="visible.after" aria-hidden="true" :style="{ height: `${visible.after}px` }" />
  </ul>
</template>
