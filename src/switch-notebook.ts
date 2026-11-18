// Opening a Notebook, from the start screen or in place of the open one, and
// closing it. Everything that must hold whichever way the user goes: the open
// Notebook is saved before it is left, and stays open when the new one fails.
import { ref } from 'vue'
import { fullScreen } from './diagram/full-screen'
import { closeNotebook, db, isOpen, openNotebook, saveNow, saveProblem } from './notebook'
import { paletteOpen } from './palette'
import type { NotebookFolder, NotebookStorage } from './storage'

/** The open Notebook's id among the Recent Notebooks; null when it is not in the list. */
export const openRecentId = ref<string | null>(null)

/**
 * Goes up each time a Notebook is opened in place of another or closed: the
 * app's screen is keyed on it, so dialogs and other state of the last
 * Notebook do not carry over.
 */
export const notebookGeneration = ref(0)

/** What happened, for the user: an empty `error` when it opened or was cancelled. */
export type OpenOutcome = {
  error: string
  /** The Recent Notebook whose notebook.sqlite is gone: the message offers to take it off the list. */
  missing?: string
}

const refusedMessage = (name: string) =>
  `The browser did not give permission to open "${name}". Try again and allow it, or pick the folder again.`

/**
 * Saves the open Notebook before it is left. Returns why it can't be left
 * (its edits would be lost), or '' when it can or none is open.
 */
export async function leaveCurrent(): Promise<string> {
  if (!db.value) return ''
  await saveNow()
  if (saveProblem.value === 'failed')
    return 'The open Notebook could not be saved, so it stays open. Retry the save, or download a copy, first.'
  if (saveProblem.value === 'changed')
    return "The open Notebook's file was changed outside the app, so it stays open. Choose Reload from disk or Overwrite first."
  return ''
}

/**
 * Opens the folder that `getFolder` gives (null: the user cancelled), in place
 * of the open Notebook if there is one. With `recent`, the folder is that
 * Recent Notebook and a null means the browser refused permission.
 */
export async function openFrom(
  storage: NotebookStorage,
  getFolder: () => Promise<NotebookFolder | null>,
  { create = false, recent }: { create?: boolean; recent?: { id: string; name: string } } = {},
): Promise<OpenOutcome> {
  // First, while the click still counts: the picker and the permission prompt need one.
  const folder = await getFolder()
  if (!folder) return { error: recent ? refusedMessage(recent.name) : '' }
  const switching = !!db.value
  if (switching) {
    if (await isOpen(folder)) return { error: '' }
    const blocked = await leaveCurrent()
    if (blocked) return { error: blocked }
  }
  try {
    if (!(await openNotebook(folder, create)))
      // Not reached on the fallback: a picked file always has bytes.
      return {
        error: `Can't find it: there is no notebook.sqlite in the folder "${folder.name}".`,
        missing: recent?.id,
      }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  if (switching) startOver()
  openRecentId.value = await storage.remember(folder).catch(() => null)
  return { error: '' }
}

/** Closes the open Notebook, after saving it, back to the start screen. Returns why it can't, or ''. */
export async function closeCurrent(): Promise<string> {
  const blocked = await leaveCurrent()
  if (blocked) return blocked
  closeNotebook()
  startOver()
  openRecentId.value = null
  return ''
}

// What belongs to the Notebook that was open. Home and the Undo delete stack follow the database by themselves.
function startOver() {
  paletteOpen.value = false
  fullScreen.value = false
  notebookGeneration.value++
}
