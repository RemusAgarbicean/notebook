import { onBeforeUnmount, watch, watchEffect } from 'vue'
import { current, list } from './navigation'
import { db, notebookName } from './notebook'
import { RECORD_FIELDS } from './record-fields'
import { recordType } from './record-types'
import { getRecord, listTags } from './records'
import { decodePlace, encodePlace, type Place } from './route'

// A place as far as it still exists: a deleted Record leaves its list, a deleted Tag leaves the Record or Home.
function existing({ list, current }: Place): Place {
  if (current && !getRecord(current.type, current.id)) current = null
  const tag = typeof list === 'object' ? list.tag : null
  if (tag !== null && !listTags().some((t) => t.id === tag)) list = current?.type ?? 'home'
  return { list, current }
}

const OWNER = 'notebook-hash-owner'

/**
 * Keeps the place (Home, a list, a Record) in the URL hash, so the browser's
 * Back and Forward work and a reload returns to it once the Notebook is open
 * again (the same Notebook: another one starts at Home). Also names the tab
 * after the place. Call it in the app's setup.
 */
export function useHistory() {
  const here = () => encodePlace({ list: list.value, current: current.value })

  function go(place: Place) {
    list.value = place.list
    current.value = place.current
  }

  // Back, Forward or a hand-edited hash: go where it says, and correct it if that is gone.
  function follow() {
    // Our own navigation also lands here, with nothing left to do.
    if (!db.value || location.hash === here()) return
    // A field being typed in saves when it loses the focus; leaving the page must not skip that.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    go(existing(decodePlace(location.hash)))
    if (here() !== location.hash) location.replace(here())
  }
  window.addEventListener('hashchange', follow)
  onBeforeUnmount(() => window.removeEventListener('hashchange', follow))

  watch(db, (now, before) => {
    // Which Notebook the hash belongs to; sessionStorage outlives a reload of this tab.
    let owner: string | null = null
    try {
      owner = sessionStorage.getItem(OWNER)
      if (now) sessionStorage.setItem(OWNER, notebookName() ?? '')
    } catch {
      // Storage blocked: the hash is never followed after a reload.
    }
    // The first open after a page load returns to the place in the hash, if it was this Notebook's.
    if (now && !before && owner === notebookName()) follow()
    else {
      // Another Notebook has other Records behind the same ids.
      go({ list: 'home', current: null })
      if (now && location.hash !== here()) location.replace(here())
    }
  })

  // Going somewhere in the app adds a history entry. `location.hash`, not pushState, which file:// pages may refuse.
  watch(here, (hash) => {
    if (hash !== encodePlace(decodePlace(location.hash))) location.hash = hash
  })

  watchEffect(() => {
    const record = db.value && current.value && getRecord(current.value.type, current.value.id)
    const l = list.value
    const where = !db.value
      ? ''
      : record
        ? record.title || RECORD_FIELDS[current.value!.type].singular
        : typeof l === 'object'
          ? `#${listTags().find((t) => t.id === l.tag)?.name ?? ''}`
          : l === 'home'
            ? ''
            : recordType(l).label
    document.title = where ? `${where} - Notebook` : 'Notebook'
  })
}
