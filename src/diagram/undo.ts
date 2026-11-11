/** The undo history of one open canvas: snapshots of its Nodes and Edges as text. */
export type History = { past: string[]; present: string; future: string[] }

/** How many steps back a canvas remembers. */
export const HISTORY_LIMIT = 100

export const startHistory = (present: string): History => ({ past: [], present, future: [] })

/** The history after a change to `state`; the same history when nothing changed. */
export function record(h: History, state: string, limit = HISTORY_LIMIT): History {
  if (state === h.present) return h
  return { past: [...h.past, h.present].slice(-limit), present: state, future: [] }
}

/** One step back; the same history when there is none. */
export function undo(h: History): History {
  if (!h.past.length) return h
  return { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] }
}

/** One step forward again; the same history when there is none. */
export function redo(h: History): History {
  if (!h.future.length) return h
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
}
