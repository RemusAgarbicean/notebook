import type { RecordType } from './record-types'

// What a type's Records own beyond their row, Relations, Tags and Images, kept by another module: a
// Questionnaire's Items, or the Items that point at an Open question. That module registers here, and
// Duplicate, Delete, Undo delete, global search and Mentions consult the registry, so they never import it.
// The hooks join the caller's transaction (ADR 0001: the app cascades what SQLite can't).

/** Puts back what a delete took; called inside Undo delete's transaction, after the Record's row is back. */
export type Restore = () => void

export type RecordChildren = {
  /** Fields a copy starts without, so they take their default. */
  freshOnCopy?: readonly string[]
  /** Copies the children onto a duplicate. */
  copy?: (fromId: number, toId: number) => void
  /** Keeps what `remove` is about to take, for Undo delete. Called before `remove`. */
  capture?: (id: number) => Restore
  /** Deletes or unlinks the children, in the delete's transaction. */
  remove?: (id: number) => void
  /** Texts global search reads besides the fields, each with where it was found. */
  searchTexts?: (id: number) => [where: string, text: string][]
  /** Markdown texts the children hold that may Mention a Record, for every Record of the type that has some, each with how to write it back. */
  markdownTexts?: () => ChildText[]
}

/** A markdown text kept by a Record's children, and how to save it changed. */
export type ChildText = { id: number; title: string; text: string; write: (next: string) => void }

const registry = new Map<RecordType, RecordChildren[]>()

/** Registers a module's hooks for a type; a type may have several. */
export function registerChildren(type: RecordType, hooks: RecordChildren) {
  registry.set(type, [...(registry.get(type) ?? []), hooks])
}

const hooksOf = (type: RecordType) => registry.get(type) ?? []

export const freshOnCopy = (type: RecordType): string[] => hooksOf(type).flatMap((h) => h.freshOnCopy ?? [])

export const copyChildren = (type: RecordType, fromId: number, toId: number) => hooksOf(type).forEach((h) => h.copy?.(fromId, toId))

/** What Undo delete keeps of a Record's children: call before `removeChildren`. */
export function captureChildren(type: RecordType, id: number): Restore {
  const restores = hooksOf(type).flatMap((h) => (h.capture ? [h.capture(id)] : []))
  return () => restores.forEach((restore) => restore())
}

export const removeChildren = (type: RecordType, id: number) => hooksOf(type).forEach((h) => h.remove?.(id))

/** Every child markdown text of every type, with the Record it belongs to. */
export const childMarkdownTexts = (): (ChildText & { type: RecordType })[] =>
  [...registry].flatMap(([type, hooks]) => hooks.flatMap((h) => (h.markdownTexts?.() ?? []).map((t) => ({ ...t, type }))))

export const childSearchTexts =(type: RecordType, id: number): [string, string][] =>
  hooksOf(type).flatMap((h) => h.searchTexts?.(id) ?? [])
