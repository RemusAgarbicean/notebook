<script setup lang="ts">
import { Download, X } from 'lucide-vue-next'
import { onBeforeUnmount } from 'vue'
import { formatSize } from './backups'
import { vDialog, vFocus } from './dialog'
import { imageUrl } from './image-view'
import { altFor, imageData, imageInfo } from './images'
import { download } from './storage-download'

// An Image at full size, opened by a click on it in rendered notes. Esc or a click outside closes it.
const props = defineProps<{ id: number; alt: string }>()
defineEmits<{ close: [] }>()

const info = imageInfo(props.id)
const url = imageUrl(props.id)
onBeforeUnmount(() => url && URL.revokeObjectURL(url))

const kind = info?.mime.replace('image/', '') ?? ''
/** Saves the bytes as they are stored. */
function save() {
  const data = imageData(props.id)
  const name = altFor(props.alt).replace(/[^\p{L}\p{N} ._-]+/gu, '').trim() || 'image'
  if (data) download(data, `${name}-${props.id}.${kind === 'jpeg' ? 'jpg' : kind}`)
}
const button = 'flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 font-medium hover:bg-accent'
</script>

<template>
  <!-- These keys are not for the page behind. -->
  <div
    v-dialog
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 text-sm text-foreground"
    @click.self="$emit('close')"
    @keydown.esc.stop="$emit('close')"
    @keydown.delete.stop
  >
    <div
      data-testid="image-viewer"
      role="dialog"
      aria-modal="true"
      :aria-label="alt || 'Image'"
      class="flex max-h-full max-w-full flex-col gap-2 rounded-lg border bg-background p-3 shadow-lg"
    >
      <header class="flex items-center gap-2">
        <p class="min-w-0 flex-1 truncate">
          <span class="font-medium">{{ alt || 'Image' }}</span>
          <span v-if="info" data-testid="image-facts" class="ml-2 text-xs text-muted-foreground">
            {{ info.width }} × {{ info.height }} · {{ kind.toUpperCase() }} · {{ formatSize(info.bytes) }}
          </span>
        </p>
        <button type="button" data-testid="download-image" :class="button" @click="save">
          <Download class="size-3.5" />
          Download
        </button>
        <button v-focus type="button" data-testid="close-image" aria-label="Close" class="rounded-md p-1 hover:bg-accent" @click="$emit('close')">
          <X class="size-4" />
        </button>
      </header>
      <!-- Scrolls when the Image is larger than the window: full size means its own pixels. -->
      <div class="min-h-0 overflow-auto">
        <img v-if="url" :src="url" :alt="alt" :width="info?.width" :height="info?.height" class="max-w-none" />
        <p v-else class="text-muted-foreground">This Image is no longer in the Notebook.</p>
      </div>
    </div>
  </div>
</template>
