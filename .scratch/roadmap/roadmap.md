# Roadmap: day-to-day improvements to the Notebook

Written 2026-11-18. It closes the wayfinder map (`map.md`) and its last ticket, [Score the candidates and write the roadmap](issues/09-rank-and-write-roadmap.md). Each paragraph below is the input for `to-spec` / `to-tickets`. The linked ticket has the full detail of the decision.

Constraints kept throughout: single user, local-first, one HTML file, SQLite in a Notebook folder, no server, no install, no AI calls.

## Ranking

Each feature is scored 1–3 on each criterion: daily use, cost (3 = cheapest) and compounding value (whether it makes existing Records more useful). Features are ranked by the criteria in that order. Dependencies don't change the rank: each spec ships on its own, and "When … ships" lines say what it gains later.

| Rank | Feature | Daily use | Cost | Compounding | Tier |
|---|---|---|---|---|---|
| 1 | Today strip | 3 | 2 | 3 | next |
| 2 | Promote a Journal line to a Task or Open question | 3 | 2 | 3 | next |
| 3 | Palette commands | 3 | 3 | 1 | next |
| 4 | Meeting Prep | 2 | 2 | 3 | next |
| 5 | Inbox capture and triage | 2 | 1 | 2 | next |
| 6 | Recurring Tasks and snooze | 2 | 2 | 2 | next |
| 7 | Review | 1 | 1 | 3 | later |
| 8 | Make Diagram from Relations | 1 | 2 | 2 | later |

Palette commands rank above Meeting Prep because they're cheaper, even though they compound the least. That follows from ranking by the criteria in order.

## 1. Today strip

Home gets a Today strip above its existing cards, which stay. It has three columns. **Due now** lists open Tasks overdue or due today, each with a done box in place and a **Push** (Tomorrow / Next week / Pick a date) that moves the due date and gives one to a Task without it. Push also comes to every other row with a done box: Home's Open Tasks card and a Project's checklist. **Journal** opens or starts today's entry and has a **New meeting** button, which until Meeting Prep ships opens a meeting-kind entry. **Ask** groups open questions by the Person to ask, each showing how many days it has waited, with a group for questions with no one to ask. Home's Open Tasks card keeps every open Task: the strip is "act now", the card is the full list. Recently edited stays a card. *When Inbox ships:* the strip shows "Inbox · N, oldest X days". *When Recurring Tasks and snooze ship:* snoozed questions are hidden until their date, recurring rows show ↻, and a push on one moves only that occurrence. *When Meeting Prep ships:* New meeting asks whom you're meeting. Sources: [Today view](issues/02-today-view.md), [Push](issues/06-recurring-tasks-snooze.md); prototype branch `prototype/today-view` (variant A).

## 2. Promote a Journal line to a Task or Open question

In the read view of a Journal entry's Notes, pointing at a line (or focusing it) shows **☐ Task** and **? Question** buttons. A button opens a small form under the line. The title is pre-filled with the line, without list marks or `[[ ]]`, and can be edited. A Task gets Due. A question gets the Ask slot as Attendee chips, with the Attendees named in the line pre-selected, or the sole Attendee in a 1:1. Creating the Record leaves the line's wording as it is and appends `→ [[Title]]`. That Mention is the only link back, and it is what lets Prep find the Record later. The new Record's notes start with the original line. A promoted `- [ ]` line loses its box. Lines that are headings or blank, or that already end in `→ [[…]]`, show no buttons. Nothing happens while editing, and there's no marker syntax. Keyboard: a palette command **Promote line…** picks a line of the current entry. **Undo** is a toast that deletes the new Record and removes the added `→ [[…]]`. First version: Journal entries only. Other types' Notes are a later extension. Sources: [Line to record](issues/05-line-to-record.md); prototype branch `prototype/line-to-record` (variant C).

## 3. Palette commands

⌘K learns to run commands as well as search and create: **Go Home**, **Today's log**, **New meeting**, plus one global key chord for Home, `g h`. It is the first two-key chord, because `src/shortcuts.ts` has only single keys, and `g` is free. Each later feature adds its command when it ships: **Capture** (Inbox), **Review**, **Make Diagram**, **Promote line…** (already part of rank 2). Commands appear only once their feature exists. Commands and Records share the result list, and commands come first when the query matches their name. Source: map fog item "Palette commands and global shortcuts"; [friction audit](issues/01-day-to-day-friction-audit.md) item 6.

## 4. Meeting Prep

A **Prep** panel on a meeting Journal entry, filled from its Attendees and visible while taking notes, shows for each Attendee: their open questions (where Ask is that Person), open Tasks related to them by Relation or Mention, and the last 3 Journal entries they attended or are mentioned in. The Person page gets the same lists as a compact Prep section, from the same query. Each question in Prep has an **Answer** box. Filling it marks the question answered, with its text and date, adds an "answered by" Relation to the meeting entry (an existing label, no migration) and appends `Answered: [[Question title]]` to the notes. **Meet** on a Person page creates a meeting entry titled `<date> <Person>` with them as Attendee and lands in Prep. The Today strip's New meeting asks whom you're meeting, then does the same. Attendees are People only, so there is no Team-level Prep. Two quick fixes from the audit go with this feature and can ship ahead of it on their own: a meeting entry's title follows its kind while it's still the default `<date> log`, and the palette's **Create …** applies the type's template the way the list's New does. *When Recurring Tasks and snooze ship:* snoozed questions sit under a collapsed "Snoozed (n)". Sources: [Meeting prep](issues/03-meeting-prep.md); glossary term **Prep**.

## 5. Inbox capture and triage

A global shortcut and a **Capture** palette command open a single-line box without leaving the page. The line becomes an **Inbox item**: text that may contain Mentions, with no type, Tags, Relations or Images. Inbox items are kept apart from Records, which needs new storage. That is why this feature is the most expensive of the "next" tier. The Inbox screen is a triage pass. One key per type (`t` Task, `q` Open question, `p` Person, …) creates the Record and moves to the next item, and Shift plus the key also opens it. The Record's title is the line without `[[ ]]`, its notes start with the original line, and its creation date is the capture date. **Add to…** appends the dated line to an existing Record's notes. **Delete** discards the item. There's no limit and no blocking prompt. Journal lines skip the Inbox (rank 2). Filling in "whom to ask" from a Mention is a nice-to-have. *When the Review ships:* items older than 7 days are flagged there. Sources: [Inbox model](issues/04-inbox-model.md); glossary terms **Inbox**, **Inbox item**.

## 6. Recurring Tasks and snooze

A **Repeats** field next to Due takes every N days, every N weeks (on the due date's weekday) or every N months (on the due date's day, or the month's last day). There's no end date and no more complex rules. Choosing a rule with Due empty sets Due to today. Ticking a Recurring Task keeps the one Record open and moves Due to the next date on a fixed schedule, counted from the due date. A Task several cycles behind jumps to the first date after today. Each tick's date is recorded, and the Task page shows the last 10. To end one, clear Repeats and tick it. **Snooze** applies only to Open questions (Tomorrow / Next week / Pick a date). Until that date, a snoozed question is hidden from the Today strip and the Review, collapsed in Prep, and marked "snoozed until …" in its list. Its waiting time keeps counting from creation. Push is already part of rank 1. The cap holds: no priorities, subtasks, boards or dependencies. Sources: [Recurring Tasks and snooze](issues/06-recurring-tasks-snooze.md); glossary terms **Recurring Task**, **Push**, **Snooze**.

## 7. Review (later)

A Review screen opened from a Home button that shows how many items are waiting, and from a **Review** palette command. It absorbs the "Needs attention" card. A weekly nudge highlights the button when the last finished Review is more than 7 days old. **Stale**: questions unanswered over 14 days, Tasks overdue over 7 days, Systems, Processes, People and Teams neither edited nor Checked in 6 months, and active Projects with no open Tasks and no edits for 30 days. **Broken**: dead Mentions and empty required fields. Orphan Records are not flagged. Each row has its actions in place: Answer, Snooze or Open for a question; Done, Push or Open for a Task; **Still accurate** (which records a Checked date without changing Updated) for the four reference types; Add Task or a status change for a quiet Project; Create a Record or Open the containing Record for a dead Mention. Every row also has **Skip**. **Finish Review** records the date and resets the nudge. There are no streaks and no score. Needs a Checked date on four types, a stored last-Review date, and Skip state for each Review. *When Inbox ships:* Inbox items over 7 days are flagged, with triage actions. *Before Recurring Tasks and snooze ship:* the Snooze action is missing. Sources: [Review](issues/07-review.md); glossary section **Upkeep**.

## 8. Make Diagram from Relations (later)

**Make Diagram**, a button on any Record page except a Diagram and a palette command, creates an ordinary Diagram titled `<Record title> map`. Its Nodes are linked to the Record and to the Records 1 or 2 Relations away (a picker; no 3), and the existing Tidy lays it out. There is one Edge per Relation among the Nodes, pointing the Relation's way and carrying its forward reading as text. It is a snapshot and never syncs, though linked Node titles stay current. **Add related (n)** on any linked Node, in any Diagram, adds that Record's related Records that aren't on it yet, plus Edges for every Relation among them, so a Diagram grows branch by branch. Only Relations count, not Mentions. Sources: [Diagram from Relations](issues/08-diagram-from-relations.md); prototype branch `prototype/diagram-from-relations`.

## Left out

Journal templates for each meeting type (Prep supplies the context), the link that replaces the list column (audit item 8; minor), saved searches, Diagram polish, Task priorities/subtasks/boards, sync/sharing, server/AI/import features, and new learning aids. See the map's Out of scope for why.
