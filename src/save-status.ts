import { ref } from 'vue'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Not saved',
}

export const saveStatus = ref<SaveStatus>('saved')
