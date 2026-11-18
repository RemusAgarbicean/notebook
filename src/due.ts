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

/** A Push choice that moves a Task's due date without picking one. */
export type PushChoice = 'tomorrow' | 'next-week'

/** The new due date for a Push: counted from today, never from the old due date, so an overdue Task never stays in the past. */
export function pushDate(choice: PushChoice, now = today()): string {
  // Counted on the date alone, in UTC, so a daylight-saving change cannot shift the day.
  const date = new Date(`${now}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + (choice === 'tomorrow' ? 1 : 7))
  return date.toISOString().slice(0, 10)
}

// A YYYY-MM-DD date as a day number, so two dates subtract to whole days whatever the time zone does in between.
const dayNumber = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000

/** Whole days from the local date of a `created_at` timestamp to today. */
export const waitedDays = (createdAt: string, now = today()): number =>
  dayNumber(now) - dayNumber(new Date(createdAt).toLocaleDateString('sv'))

/** How long an Open question has waited, in words: "today", "1 day" or "N days". */
export const waitedText = (days: number): string => (days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`)
