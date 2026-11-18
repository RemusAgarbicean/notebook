// The order of the Recent Notebooks, apart from where they are stored: the
// File System Access storage keeps directory handles in IndexedDB, the tests
// keep memory folders.

/** How many Recent Notebooks are remembered. */
export const RECENT_MAX = 5

/** One Recent Notebook: an id that stays the same while it is in the list (names can collide), and its folder. */
export type Remembered<H> = { id: string; handle: H }

/**
 * `list` with `handle` at the front: an entry for the same folder moves there
 * and keeps its id, a new one gets `newId()`. At most RECENT_MAX long.
 */
export async function promote<H>(
  list: readonly Remembered<H>[],
  handle: H,
  same: (a: H, b: H) => Promise<boolean>,
  newId: () => string,
): Promise<Remembered<H>[]> {
  let found: Remembered<H> | undefined
  const rest: Remembered<H>[] = []
  for (const entry of list) {
    if (!found && (await same(entry.handle, handle))) found = entry
    else rest.push(entry)
  }
  // The new handle, which holds the permission just given.
  return [{ id: found?.id ?? newId(), handle }, ...rest].slice(0, RECENT_MAX)
}

/**
 * The list as stored, or, before there was one, a list holding the one folder
 * that was remembered then (`legacy`), so it is not lost.
 */
export function recentFromStore<H>(
  stored: Remembered<H>[] | undefined,
  legacy: H | undefined,
  newId: () => string,
): Remembered<H>[] {
  if (stored) return stored
  return legacy ? [{ id: newId(), handle: legacy }] : []
}
