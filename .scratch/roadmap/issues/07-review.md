# What does a periodic Review flag as stale or broken?

Type: grilling
Status: resolved
Assignee: Remus
Blocked by: 01

## Question

Define a periodic Review: which Records count as stale (e.g. Systems not updated in N months, Open questions unanswered for weeks, overdue Tasks), what counts as broken (dead Mentions, orphan Records, Bookmarks without URL), how often it's prompted, and what actions it offers on each item.

## Input from the Inbox decision

From *Is an Inbox a Record type, a Tag or a state?*: the Review flags Inbox items older than a week. Its actions on them should match the Inbox's (sort, Add to…, Delete).

## Input from recurring Tasks and snooze

From *How do recurring Tasks and snooze work?*: snoozed Open questions are hidden from the Review until their date. Overdue Tasks can be **pushed** (their due date moved) from the Review, the same way as from the Today strip.

## Resolution

Resolved 2026-11-18 by grilling. New glossary section **Upkeep** in `GLOSSARY.md`: **Review**, **Stale**, **Checked**, **Broken**.

**Where and when.** The Review is its own screen, opened from a Home button that shows how many items are waiting and from a palette command, "Review". The Home "Needs attention" card moves into it. The prompt is a weekly nudge: the Home button is highlighted when the last finished Review is more than 7 days old. There is no modal and no fixed weekday.

**Stale** (fixed thresholds, not settings):
- Open questions unanswered for more than 14 days. Snoozed ones are hidden until their date.
- Tasks overdue by more than 7 days. Anything overdue for less is already on the Today strip.
- Systems, Processes, People and Teams whose last edit and last Checked date are both more than 6 months old.
- **Active** Projects with no open Tasks and no edits for 30 days ("gone quiet"). Projects on hold or done are never flagged.
- Inbox items older than 7 days.
- Never stale: Journal entries, Acronyms, Bookmarks, Diagrams, done Tasks, answered questions.

**Broken**: dead Mentions (a `[[Title]]` that matches no Record) and empty required fields (today's `incompleteRecords`, which covers Bookmarks without a URL). Orphan Records are **not** flagged: orphan Acronyms and Bookmarks are normal, so the list would be noise.

**Actions in place**, one row per item:
- Stale Open question: Answer (existing `AnswerFlow`), Snooze, Open.
- Overdue Task: Done, Push, Open.
- Stale System, Process, Person or Team: **Still accurate**, which records a Checked date and does not bump `updated_at`. The footer shows "Checked …" next to "Updated …". Also Open.
- Quiet Project: Add Task (quick-add, linked to the Project), set status to on hold or done, Open.
- Old Inbox item: sort by type key, Add to…, Delete.
- Dead Mention: Create a Record with that title (pick the type), or Open the Record whose notes contain it, to fix the text.
- Empty required field: Open.
- Every item: **Skip**, which hides it until the next Review.

**Finishing.** Items leave the list as you handle them. **Finish Review** records the date and resets the nudge, even if items remain; anything left comes back next time. There are no streaks and no score.

**Saved searches**: not absorbed. The Review is a fixed set of checks. Saved searches move to Out of scope on the map.

Implementation notes for the spec: a Checked column on the four types (or one shared table keyed by type and id), a stored date for the last finished Review, and per-Review Skip state, which can stay in memory or be stored until Finish.
