<script setup lang="ts">
import { Network } from 'lucide-vue-next'
import { computed } from 'vue'
import DiagramPreview from './diagram/DiagramPreview.vue'
import { openRecord } from './navigation'
import type { RecordType } from './record-types'
import { attachedDiagrams } from './relations'

// The Diagrams attached to a Process or Project, each as a picture. A click opens the Diagram to edit it.
const props = defineProps<{ type: RecordType; id: number }>()
const diagrams = computed(() => attachedDiagrams({ type: props.type, id: props.id }))
</script>

<template>
  <section v-if="diagrams.length" data-testid="attached-diagrams" class="flex flex-col gap-3">
    <figure v-for="d in diagrams" :key="d.id" data-testid="attached-diagram" class="relative h-72 overflow-hidden rounded-md border">
      <figcaption class="flex h-8 items-center gap-2 border-b px-2 text-xs font-medium text-muted-foreground">
        <Network class="size-4 shrink-0" />
        <span data-testid="attached-diagram-title" class="truncate">{{ d.title }}</span>
      </figcaption>
      <div class="h-[calc(100%-2rem)]">
        <DiagramPreview :id="d.id" :flow-id="`diagram-preview-${type}-${id}-${d.id}`" />
      </div>
      <!-- Over the whole figure: the picture is a way into the Diagram, not a place to work on it. -->
      <button
        type="button"
        :aria-label="`Open Diagram ${d.title}`"
        :title="`Open ${d.title}`"
        class="absolute inset-0 rounded-md hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-ring"
        @click="openRecord('diagram', d.id)"
      />
    </figure>
  </section>
</template>
