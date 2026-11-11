import { computed, ref } from 'vue'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Not saved',
}

export const saveStatus = ref<SaveStatus>('saved')

/** True while the open Notebook is saved by downloading it (no File System Access API). */
export const manualSave = ref(false)

/** When (HH:MM) the open Notebook was last handed to the browser as a download, if it was. */
export const downloadedAt = ref<string | null>(null)

const MANUAL_LABELS: Record<SaveStatus, string> = {
  saved: 'Nothing new to download',
  saving: 'Downloading…',
  unsaved: 'Changes not downloaded',
}

export const saveStatusLabel = computed(() =>
  !manualSave.value
    ? SAVE_STATUS_LABELS[saveStatus.value]
    : // What happened, not "saved": the app cannot see whether the file landed.
      saveStatus.value === 'saved' && downloadedAt.value
      ? `Downloaded ${downloadedAt.value}`
      : MANUAL_LABELS[saveStatus.value],
)
