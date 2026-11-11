import { parseDate } from './bulk-import'
import { today, type Value } from './records'

/** Where an open Task's due date stands: past, today, or neither (later, none, or the Task is done). */
export type DueState = 'overdue' | 'today' | null

export function dueState(due: Value | undefined, done: unknown = false, now = today()): DueState {
  if (!due || done) return null
  return String(due) < now ? 'overdue' : String(due) === now ? 'today' : null
}

/** The due date as shown in lists: said in words when it is past or today, so it does not rest on colour. */
export function dueText(due: Value | undefined, done: unknown = false, now = today()): string {
  const state = dueState(due, done, now)
  return state === 'overdue' ? `Overdue ${due}` : state === 'today' ? 'Due today' : String(due ?? '')
}

/** A quick-add line as a Task: a last word that reads as a date (`YYYY-MM-DD` or `DD.MM.YYYY`) is its due date. */
export function parseQuickTask(text: string): { title: string; due: string | null } {
  const words = text.trim().split(/\s+/)
  const due = words.length > 1 ? parseDate(words.at(-1)!) : null
  return { title: (due ? words.slice(0, -1) : words).join(' '), due }
}
