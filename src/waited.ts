import { today } from './records'

// How long an Open question has waited for an answer.

// A YYYY-MM-DD date as a day number, so two dates subtract to whole days whatever the time zone does in between.
function dayNumber(date: string): number {
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000
}

/** Whole days from the local date of a `created_at` timestamp to today. */
export function waitedDays(createdAt: string, now = today()): number {
  return dayNumber(now) - dayNumber(new Date(createdAt).toLocaleDateString('sv'))
}

/** How long an Open question has waited, in words: "today", "1 day" or "N days". */
export function waitedText(days: number): string {
  return days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`
}
