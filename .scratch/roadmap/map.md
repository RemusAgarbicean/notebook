# Map: Roadmap of day-to-day improvements to the Notebook

Label: wayfinder:map

## Destination

A prioritised roadmap of 5–8 features (new or improved), each with a one-paragraph spec ready for `to-spec` / `to-tickets`, ranked by daily-use frequency, then cost to build, then compounding value.

## Notes

- Single-user, local-first. Keep the constraints: one HTML file, SQLite in a Notebook folder (File System Access), no server, no install, no AI calls. Ideas that break them go to Out of scope with a note.
- The user is moving from onboarding into day-to-day work: weigh daily-use improvements over learning aids.
- Rank by (1) daily-use frequency, (2) cost to build, (3) compounding value (makes existing Records more useful rather than a new silo). New Record types rank last unless clearly needed.
- Use `GLOSSARY.md` vocabulary; new terms (e.g. Inbox) go through the `domain-modeling` skill. Grilling tickets call `grilling` + `domain-modeling`; prototype tickets call `prototype`.
- Tracker: local markdown (see "Wayfinding operations" in the local tracker convention). Tickets live in `issues/`.

## Decisions so far

<!-- one line per resolved ticket: - [<title>](issues/NN-slug.md): <gist> -->

- [Where does day-to-day use get clunky?](issues/01-day-to-day-friction-audit.md): the worst friction is around meetings. Actions are checkboxes, not Tasks; a linked Task takes about 9 actions; a Person's open questions are buried. Also: Home Tasks can't be ticked off, the palette has no commands, nothing shows staleness. The Task cap holds.
- [What goes on a Today view, and does it extend Home?](issues/02-today-view.md): it extends Home. A Today strip above the cards holds Due now (tick in place, push to tomorrow), today's Journal entry plus New meeting, and open questions grouped by whom to ask, with how long each has waited.
- [What does meeting prep gather for a Person or Team, and do answers flow back?](issues/03-meeting-prep.md): a Prep panel on the meeting entry (and on the Person page) shows each Attendee's open questions, shared open Tasks and last 3 entries. Questions are answered in place and linked back with "answered by" plus a Mention. "Meet" starts a meeting named for the Person.
- [Is an Inbox a Record type, a Tag or a state?](issues/04-inbox-model.md): none of these. An Inbox item is a line of text, not a Record, captured without choosing a type from a global shortcut or the palette. Triage sorts it into a new Record with one key, adds it to an existing Record, or deletes it. Journal-entry lines skip the Inbox.
- [How does a line in a Journal entry become a Task or Open question?](issues/05-line-to-record.md): it's promoted afterwards, from the read view. Pointing at a line shows Task / Question buttons and a small form (title, Due or Ask pre-filled from Attendees). The line keeps its words and gets `→ [[Title]]` added, and the Mention is the only link back. `- [ ]` lines stay checklist items until promoted.
- [How do recurring Tasks and snooze work?](issues/06-recurring-tasks-snooze.md): a Recurring Task stays one Record. Ticking it moves Due to the next date in a small rule set (every N days/weeks/months, fixed schedule) and records the date. A push moves a Task's due date, from any row with a done box. Only Open questions can be snoozed (hidden from Today and the Review until a date, collapsed in Prep). The cap holds.
- [What does a periodic Review flag as stale or broken?](issues/07-review.md): it's a separate screen behind a Home button and a palette command, nudged weekly. It flags Stale Records (questions waiting over 14 days, Tasks overdue over 7, Systems, Processes, People and Teams not edited or Checked in 6 months, quiet active Projects, Inbox items over a week old) and Broken ones (dead Mentions, empty required fields; not orphans). Each has actions in place plus Skip, and "Still accurate" records a Checked date.
- [How is a Diagram generated from a Record's Relations?](issues/08-diagram-from-relations.md): a one-off snapshot. "Make Diagram" on a Record page creates an ordinary Diagram of linked Nodes, 1 or 2 Relations out, laid out by Tidy, with Edges that point the Relation's way and carry its reading. It never syncs. "Add related" on any linked Node grows a Diagram further, branch by branch. Relations only, not Mentions.
- [Score the candidates and write the roadmap](issues/09-rank-and-write-roadmap.md): 8 features, written up in [roadmap.md](roadmap.md). Next: Today strip (with Push), Promote line, Palette commands, Meeting Prep (with the quick fixes), Inbox, Recurring Tasks and snooze. Later: Review, Make Diagram. Ranked by daily use, then cost, then compounding; dependencies don't reorder.

## Not yet specified

_None: the destination is reached._

## Out of scope

- Sync, sharing, multiple users: the Notebook stays single-user and local-first.
- Server, AI (e.g. "ask my notebook"), calendar/email import, browser clipping extension: break the no-server/no-install constraints.
- Task priorities, subtasks, Kanban boards: capped to recurring Tasks + snooze to avoid becoming a to-do app (revisit only if the audit shows Tasks are a major pain).
- Diagram polish (auto-layout, PNG/SVG export): Diagrams were just reworked; only "generate from Relations" is in (see [How is a Diagram generated from a Record's Relations?](issues/08-diagram-from-relations.md)).
- Saved searches / filters: no decision needed them. The Today strip, Prep and the Review cover the recurring views, and the Review stays a fixed set of checks (see [What does a periodic Review flag as stale or broken?](issues/07-review.md)).
- New learning aids: the existing quiz stays as is.
- Journal templates for each meeting type: Prep supplies the 1:1 context, and one meeting template is enough.
- The link that replaces the list column (audit item 8): minor, more a bug than a feature.
