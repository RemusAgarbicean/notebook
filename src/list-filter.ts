import { ref } from 'vue'
import { foldTitle, type Value } from './records'

/** Whether the Tasks and Open questions lists leave out done and answered ones. Lasts until the page is closed. */
export const hideClosed = ref(false)

/**
 * The list rows whose title or key field contains `text`, ignoring case; without the closed ones if asked.
 * A word starting with `#` asks for a Tag instead: `#fin` keeps the rows with a Tag whose name contains "fin".
 */
export function filterList<T extends { title: string; sub?: Value; closed: boolean; tags?: readonly string[] }>(
  rows: T[],
  text: string,
  hideClosed = false,
): T[] {
  const words = foldTitle(text).split(/\s+/)
  // A lone `#` is a Tag not typed yet.
  const tags = words.filter((w) => w.startsWith('#')).map((w) => w.slice(1)).filter(Boolean)
  const q = words.filter((w) => !w.startsWith('#')).join(' ')
  return rows.filter(
    (r) =>
      !(hideClosed && r.closed) &&
      tags.every((t) => r.tags?.some((name) => foldTitle(name).includes(t))) &&
      (!q || foldTitle(r.title).includes(q) || foldTitle(String(r.sub ?? '')).includes(q)),
  )
}
