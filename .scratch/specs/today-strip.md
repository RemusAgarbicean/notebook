# Spec: Today strip on Home

Labels: `ready-for-agent`
Status: open (local; becomes a GitHub issue once `gh` is set up)
Source: roadmap rank 1 (`.scratch/roadmap/roadmap.md`), tickets `02-today-view.md` and `06-recurring-tasks-snooze.md` (Push); prototype branch `prototype/today-view`, variant A (local only, never merge).

## Problem Statement

When I open my Notebook in the morning, Home shows me lists, not what to do now. Overdue and due-today Tasks are mixed into the full Open Tasks card, and I can't tick one off or move it without opening its page. Starting today's Journal entry is a small button inside the Journal card, and there's no quick way to start a meeting entry. Open questions are one alphabetical list. It doesn't say whom to ask or how long a question has waited, so before talking to someone I have to open questions one by one to see whether any are for them. A Task I can't do today stays overdue unless I open it and edit its due date by hand.

## Solution

Home gets a **Today strip** above its existing cards, with three columns:

- **Due now**: open Tasks that are overdue or due today. Each has a done box and a **Push** action (Tomorrow / Next week / Pick a date) that moves its due date.
- **Journal**: opens or starts today's log entry, and has a **New meeting** button that starts a meeting entry dated today.
- **Ask**: open questions grouped by the Person to ask. Each question shows how many days it has waited. Questions with no one to ask get their own group.

The cards below stay. The strip is "act now" and the Open Tasks card is still the full list. Push also comes to every other row with a done box: the rows of Home's Open Tasks card, which get a done box too, and the rows of a Project's Tasks checklist. Push gives a due date to a Task that has none.

## User Stories

1. As a Notebook user, I want a Today strip at the top of Home, so that I can see what needs my attention today as soon as I open the Notebook.
2. As a Notebook user, I want Home's existing cards to stay below the strip, so that I lose none of the overview I have now.
3. As a Notebook user, I want the Due now column to list every open Task that is overdue or due today, so that I don't miss anything time-bound.
4. As a Notebook user, I want overdue Tasks to come first in Due now, oldest due date first, then the Tasks due today, so that the most pressing ones are at the top.
5. As a Notebook user, I want each Due now row to say "Overdue <date>" or "Due today" in words, so that its state doesn't depend on colour alone.
6. As a Notebook user, I want done Tasks, Tasks due later, and Tasks without a due date left out of Due now, so that the column stays short.
7. As a Notebook user, I want a done box on each Due now row, so that I can tick a Task off without opening it.
8. As a Notebook user, I want a ticked Task to leave Due now at once, so that the column shows only what is still left.
9. As a Notebook user, I want to click a Due now row's title to open the Task, so that I can see or edit its details.
10. As a Notebook user, I want the Project a Task belongs to shown in grey next to its title in Due now, as in the Open Tasks card, so that I know its context.
11. As a Notebook user, I want a Push action on each Due now row, so that I can move a Task I won't do today without opening it.
12. As a Notebook user, I want Push to offer Tomorrow, Next week and Pick a date, so that the common moves are one click and any other date is still possible.
13. As a Notebook user, I want Tomorrow to set the due date to the day after today, so that the move is predictable however overdue the Task is.
14. As a Notebook user, I want Next week to set the due date to 7 days after today, so that the Task comes back on the same weekday next week.
15. As a Notebook user, I want Pick a date to let me choose any date, so that I can push a Task exactly where it belongs.
16. As a Notebook user, I want a pushed Task to leave Due now when its new date is after today, so that the strip reflects my decision.
17. As a Notebook user, I want an empty Due now to say "Nothing due today." so that an empty column reads as good news, not a fault.
18. As a Notebook user, I want each row of Home's Open Tasks card to have a done box and Push too, so that I can act on any open Task from Home.
19. As a Notebook user, I want each row of a Project's Tasks checklist to have Push, so that I can reschedule a Project's work in place.
20. As a Notebook user, I want Push to give a due date to a Task that has none, so that I can schedule an undated Task in one step.
21. As a Notebook user, I want Push left off done Tasks in a Project's checklist, so that I don't reschedule finished work.
22. As a Notebook user, I want Home's Open Tasks card to keep listing every open Task, including those also in Due now, so that it stays the complete list.
23. As a Notebook user, I want the Journal column to open today's log entry, or start it if there is none, so that I can write my daily log in one click.
24. As a Notebook user, I want the Journal column to show whether today's log already exists (Open today's log or Start today's log), so that I know whether I've written today.
25. As a Notebook user, I want a New meeting button in the Journal column, so that I can start meeting notes in one click when a meeting begins.
26. As a Notebook user, I want New meeting to create a Journal entry of kind meeting dated today and open it, so that I can add Attendees and write at once.
27. As a Notebook user, I want each New meeting click to create a new entry, so that several meetings on one day each get their own notes.
28. As a Notebook user, I want the Ask column to group open questions by the Person to ask, so that before talking to someone I can see everything I want to ask them.
29. As a Notebook user, I want each Ask group headed by the Person's name, which opens their page when clicked, so that I can get to them quickly.
30. As a Notebook user, I want each question to show how long it has waited ("today", "1 day", "N days") since it was created, so that I notice questions that have waited too long.
31. As a Notebook user, I want the questions in a group ordered longest-waiting first, so that the oldest ones get asked first.
32. As a Notebook user, I want Person groups ordered by name, so that I can find a Person quickly.
33. As a Notebook user, I want questions with no one to ask in a last group, "No one to ask", so that they aren't lost and I'm reminded to pick someone.
34. As a Notebook user, I want a question with several People to ask shown under each of them, so that I see it whomever I meet.
35. As a Notebook user, I want to click a question to open it, so that I can read it or record the answer.
36. As a Notebook user, I want answered or closed questions left out of Ask, so that the column holds only what is still open.
37. As a Notebook user, I want an empty Ask column to say "Nothing waiting for an answer." so that an empty state is clear.
38. As a Notebook user, I want the strip to update as soon as I change a Task or question elsewhere and come back to Home, so that it is never stale.
39. As a Notebook user, I want the three columns side by side on a wide window and stacked on a narrow one, so that the strip works at any window size.
40. As a keyboard user, I want every done box, Push action, button and row in the strip reachable with Tab and usable with Enter or Space, so that I can work without a mouse.
41. As a screen-reader user, I want done boxes labelled "Done: <title>" and Push labelled "Push: <title>", so that I know which Task each control acts on.
42. As a Notebook user, I want the strip to read the date from my computer's local clock, so that "today" matches my calendar and not UTC.
43. As a Notebook user, I want a Push or a done tick from the strip saved like any other edit (Undo history, save status, Backups), so that strip actions are as safe as editing the page.

## Implementation Decisions

- **Placement**: the strip is a new section at the top of the Home component, under the search box and above the card grid. Home's card list and its queries don't change, apart from the Open Tasks card's rows gaining a done box and Push.
- **Strip component**: a new Today strip component that Home renders. It owns three column parts (Due now, Journal, Ask). Each column reads the database through the existing query helpers (`rows` / `textRows`), as Home's cards do, so it updates whenever the shared database version changes.
- **Due now query**: open Tasks (`done = 0`) with `due <= today()`, ordered by due date then title, with the same "part of Project" grey text that the Open Tasks card works out (Project by the `partOf` label id, not by its reading). The due state and its words come from the existing due module (`dueState` / `dueText`) through the existing due-date display component.
- **Push date rule** (new, pure, in the due module): a function that takes a choice (`tomorrow` | `next-week`) and a "now" date string (defaults to `today()`) and returns the new ISO date: today + 1 or today + 7 days. It always counts from today, never from the current due date, so pushing an overdue Task never leaves it in the past. Pick a date uses the picked date as is. It may be today or earlier; we don't stop that, as with the Due field on a Task page.
- **Push control**: one shared, reusable component that takes a Task's id and title. It opens a small menu with Tomorrow, Next week and Pick a date (Pick a date shows a native date input) and saves through the existing record update path (`updateRecord('task', id, { due })`). Edits go through the same path as a page edit, so Undo, the save status and Backups cover them with no extra work. It is used in three places: the Due now rows, the Open Tasks card rows, and a Project's Tasks checklist rows (open Tasks only).
- **Done box**: same behaviour as the Project checklist's checkbox (`updateRecord('task', id, { done })`). In the Open Tasks card and in Due now, a ticked Task leaves the list on the next render. There is no strike-through stay, because these lists show open Tasks only.
- **Home rows**: the card rows are a single button today. The Open Tasks card's rows become a row with a done box, a title button and Push, so that the controls aren't nested inside a button. The other cards' rows don't change.
- **Journal column**: the existing `todaysLog()` (find or create today's log entry) drives the log button, which moves into the strip. The Journal card's "Today's log" button is removed, because the strip replaces it. The label depends on whether a log entry for today exists (a cheap existence query). **New meeting** calls `createRecord('journal_entry', '', { kind: 'meeting' })`, which already defaults the date to today and the title to `<date> meeting`, then opens it. Whom you're meeting (Meeting Prep, rank 4) is not part of this spec.
- **Ask query**: open questions (`status = 'open'`) left-joined to the Person at the other end of the `askAbout` Relation (label id 3; the question is the `to` end and the Person the `from` end, matching the Ask slot). Days waited = whole days between the question's `created_at` (as a local date) and `today()`. Groups: Persons ordered by title (case-insensitive), then "No one to ask". Inside a group: oldest `created_at` first. A question with several Persons appears once per Person.
- **Waiting text**: a small pure helper (next to the Push rule, or in the Ask column) turns a day count into "today", "1 day" or "N days".
- **Test ids**: follow the existing `data-testid` habits: `today-strip`, `today-due` (rows), `today-push`, `today-log`, `today-new-meeting`, `today-ask-group`, `today-ask` (rows), `today-ask-waited`. Keep the existing `todays-log` id on the new log button so existing tests and muscle memory carry over, and update tests that looked for it inside the Journal card.
- **No schema change, no migration, no ADR**: everything uses existing columns (`task.due`, `task.done`, `open_question.status`, `created_at`, `journal_entry.kind`) and existing labels.
- **Glossary**: use "Today strip", "Due now", "Push", "Open question", "Journal entry" as `GLOSSARY.md` defines them. If "Today strip" isn't in the glossary yet, add it under Records/Capture with one line: "The act-now section at the top of Home: Due now, Journal, Ask."

## Testing Decisions

- A good test drives the app as the user does and checks what they'd see. It mounts the whole App on an in-memory Notebook folder, seeds Records with `createRecord` / `addRelation`, clicks and types through the DOM, and checks visible text and the stored Records (via `listRecords`). It never reaches into component internals or SQL.
- **Seam 1, App-mounted UI tests** (main seam): a new `today-strip-ui.test.ts`, set up the same way as `due-ui.test.ts` and `palette-home-ui.test.ts` (mount App with a memory folder, click "Create new Notebook", poll for the sidebar). It covers:
  - Due now lists overdue then due-today open Tasks, with words, and leaves out later, undated and done Tasks; shows the Project grey text; shows the empty text.
  - Ticking a done box in Due now marks the Task done and removes the row; the Open Tasks card loses it too.
  - Push Tomorrow / Next week / Pick a date writes the expected `due` and removes the row from Due now; Push on an undated Task in the Open Tasks card gives it a date; Push in a Project checklist works and isn't offered on done Tasks.
  - The Journal column: start today's log when none exists, open the same one on a second click; New meeting twice gives two meeting entries dated today, each opened.
  - Ask groups by Person in name order with "No one to ask" last, orders by waiting time, shows the waiting text, lists a question under each of its Persons, leaves out non-open questions, and opens the question / Person on click.
  - Dates: build "today" relative values from the app's `today()` helper (as `due-ui.test.ts` does), or use `vi.useFakeTimers` + `vi.setSystemTime` (prior art: `backups.test.ts`) where the waiting-day count needs a fixed clock.
- **Seam 2, pure unit test** of the Push date rule and the waiting-text helper in `due.test.ts` (prior art: the existing `dueState` / `dueText` / `parseQuickTask` tests): Tomorrow and Next week from a fixed "now", across month and year ends and the end of February in a leap year; day counts 0, 1 and many.
- Update the existing tests that click `todays-log` inside the Journal card, and the `due-ui.test.ts` Home case if the Open Tasks card's row text changes because of the added controls.
- Run the full suite and `vue-tsc` (`npm run build`) before calling it done.

## Out of Scope

- Inbox count in the strip (comes with Inbox capture and triage, rank 5).
- Snooze, hiding snoozed questions, ↻ markers and pushing one occurrence of a Recurring Task (rank 6).
- New meeting asking whom you're meeting, and Prep (rank 4).
- Palette commands such as Go Home, Today's log and New meeting, and the `g h` chord (rank 3).
- Answering a question from the Ask column (that's Prep's Answer box, rank 4).
- Changing the Open questions, Recently edited, Pinned, Needs attention or Active Projects cards.
- A separate Today screen, an agenda grouped by date, or a mixed ranked stream (variants B and C, rejected).
- Task priorities, subtasks, boards and dependencies (the cap holds).

## Further Notes

- The prototype for variant A is on the local branch `prototype/today-view` (`src/prototype-today/`, open `/?variant=A`). Use it for layout reference only. Don't merge it.
- Constraints still hold: single user, local-first, one HTML file, SQLite in a Notebook folder, no server, no AI calls.
- Push counting from today, and Next week meaning +7 days, are decisions made in this spec, not in the earlier tickets. Both are cheap to change.
- Once `gh` is set up: `gh issue create --title "Today strip on Home" --label ready-for-agent --body-file .scratch/specs/today-strip.md`.
