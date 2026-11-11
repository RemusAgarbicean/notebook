// Only one tab edits. The editing tab holds a Web Lock; where Web Locks are
// missing or refused, tabs agree over the channel alone.
import { ref } from 'vue'
import { closeNotebook, db, saveNow } from './notebook'
import { saveStatus } from './save-status'

const NAME = 'notebook'

/** The part of BroadcastChannel the lock uses. */
export interface TabChannel {
  postMessage(message: string): void
  onmessage: ((event: MessageEvent) => void) | null
}

/**
 * `stepDown` is called in the editing tab when another tab takes over: it must
 * save and close the Notebook, or resolve false to keep editing here.
 */
export function createTabLock(
  locks: LockManager | undefined,
  channel: TabChannel | undefined,
  stepDown: () => Promise<boolean>,
) {
  /** True while another tab edits: this tab must show nothing but "Use it here". */
  const blocked = ref(false)
  /** True in a blocked tab after the editing tab refused to step down because it could not save. */
  const refused = ref(false)
  let useLocks = !!locks
  let release = () => {}
  let wanting = false // Use it here was clicked and has not been granted yet
  let answered = false // an editing tab answered our take-over
  const hold = () => new Promise<void>((resolve) => (release = resolve))

  if (channel)
    channel.onmessage = async ({ data }) => {
      if (blocked.value) {
        if (data === 'cannot-save' && wanting) refused.value = true
        if (useLocks) return
        if (data === 'i-edit') answered = true
        if (data === 'released' && wanting) wanting = blocked.value = false
      } else if (data === 'who-edits') channel.postMessage('i-edit')
      else if (data === 'i-edit' && !useLocks) blocked.value = true
      else if (data === 'take-over') {
        channel.postMessage('i-edit')
        if (!(await stepDown())) return channel.postMessage('cannot-save')
        blocked.value = true
        release()
        channel.postMessage('released')
      }
    }

  // shortcut: without Web Locks, two tabs opened in the same instant both edit;
  // upgrade if a browser that has the File System Access API ever lacks Web Locks.
  const askAround = () => channel?.postMessage('who-edits')
  if (locks)
    locks
      .request(NAME, { ifAvailable: true }, (lock) => {
        if (lock) return hold()
        blocked.value = true
      })
      .catch(() => {
        useLocks = false
        askAround()
      })
  else askAround()

  /** Asks the editing tab to save and step down, then edits here. */
  function useHere() {
    refused.value = false
    channel?.postMessage('take-over')
    if (useLocks) {
      if (wanting) return
      wanting = true
      // Granted once the editing tab releases the lock, or at once if it is gone.
      void locks!.request(NAME, () => {
        wanting = blocked.value = false
        return hold()
      })
    } else {
      wanting = true
      answered = false
      // Silence means the editing tab was closed.
      setTimeout(() => {
        if (wanting && !answered) wanting = blocked.value = false
      }, 300)
    }
  }

  return { blocked, refused, useHere }
}

// Without the File System Access API each tab works on its own copy in memory,
// so there is no shared file to guard and no lock.
const shared = !!window.showDirectoryPicker
export const tabLock = createTabLock(
  shared ? navigator.locks : undefined,
  !shared || typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(NAME),
  async () => {
    await saveNow()
    // Never step down with edits that did not reach the disk.
    if (db.value && saveStatus.value !== 'saved') return false
    closeNotebook()
    return true
  },
)
