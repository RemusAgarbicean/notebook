import { ref } from 'vue'
import { foldTitle, type Value } from './records'

/** Whether the Tasks and Open questions lists leave out done and answered ones. Lasts until the page is closed. */
export const hideClosed = ref(false)

/** The list rows whose title or key field contains `text`, ignoring case; without the closed ones if asked. */
export function filterList<T extends { title: string; sub?: Value; closed: boolean }>(
  rows: T[],
  text: string,
  hideClosed = false,
): T[] {
  const q = foldTitle(text)
  return rows.filter(
    (r) => !(hideClosed && r.closed) && (!q || foldTitle(r.title).includes(q) || foldTitle(String(r.sub ?? '')).includes(q)),
  )
}
