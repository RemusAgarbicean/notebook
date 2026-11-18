# Where does day-to-day use get clunky?

Type: task
Status: resolved

## Question

Audit the app (code and UX, driving it with the sample Notebook) for friction in day-to-day use: how many steps common actions take (log a meeting, add a Task from a meeting, find a Person's open questions, see what's due), dead ends, missing shortcuts, slow paths. AFK. Output: a ranked friction list with file references, which stands in for the user's own pain points and feeds the Task, Review and ranking tickets.

## Answer

Audit done 2026-11-18 by reading the code and profiling the sample Notebook (`sample-notebook/notebook.sqlite`). There was no browser in the session, so step counts come from the components, not from clicking through the app. "Actions" counts clicks, picks and typed fields.

### Ranked friction list

1. **Meeting actions never become Tasks (a second to-do silo).** The meeting template ends in `## Actions` with `- [ ] ` (`src/templates.ts:14`). Those lines are markdown checkboxes, so they are not Tasks: they never reach Home's Open Tasks, have no due date and belong to no Project. In the sample, 6 action checkboxes sit in 3 meeting entries, and **0** Tasks are linked to any Journal entry, by Relation or by Mention. Feeds *How does a line in a Journal entry become a Task or Open question?* (05).
2. **Adding a real Task from a meeting takes about 9 actions and leaves the meeting.** The steps: ⌘K, type the title, pick "Create Task" (`src/CommandPalette.vue:52`), which opens the Task page and leaves the notes. Then set Due, then use the Project slot picker. Linking back to the meeting takes "+ Relation", picking a reading from about 20 (`src/RelationsSection.vue:52`), then searching for the Journal entry. Home's quick-add (`src/QuickTask.vue`) is faster but sets only title and due: no Project, no link to the meeting. `[[` autocomplete offers only Records that already exist (`src/mentions.ts:39`), so typing `[[New task]]` gives a broken Mention, not a Record. Feeds 05 and *Is an Inbox a Record type, a Tag or a state?* (04).
3. **A Person's open questions can't be seen at a glance.** The "Ask" slot (`src/relation-slots.ts:34`) shows on the Person page only as a generic Relations group, "ask about" (`src/relations.ts:171`). Answered and open questions show the same way, with no status. The Open questions list filters only on title or status (`src/list-filter.ts`), not on whom to ask. Home's Open questions card is alphabetical and doesn't show whom to ask (`src/Home.vue:58`). Asking 1:1 questions means opening each question. Feeds *What does meeting prep gather for a Person or Team, and do answers flow back?* (03) and *What goes on a Today view, and does it extend Home?* (02).
4. **Starting a meeting entry is clunky.** Journal → New creates kind `log` with the title `<date> log` (`src/records.ts:199`, `src/RecordList.vue:82`). Switching Kind to meeting brings in the template (`src/RecordPage.vue:46`) but doesn't rename the entry, so every meeting is titled "… log" until renamed by hand. That's about 5 actions plus 2 per attendee, and no Home button starts a meeting the way "Today's log" starts a log. A Journal entry made from the palette gets no template at all, because only the list's New applies templates (`src/RecordList.vue:79`). The same gap hits every type. Feeds 03.
5. **What's due is visible but can't be acted on in place.** Home's Open Tasks card sorts by due date with overdue and today markers (`src/Home.vue:44`, `src/due.ts`), which is good. But its rows are plain buttons with no done box (`src/Home.vue:133`), unlike a Project's checklist (`src/ProjectTasks.vue:36`). Ticking off a Task takes 3 actions (open, tick, Back), and rescheduling means opening the page too. The Tasks list's "Hide done" resets on every reload (`src/list-filter.ts:5`). Feeds 02 and *How do recurring Tasks and snooze work?* (06).
6. **The palette searches and creates but runs no commands.** You can't reach "Today's log", "New meeting", "Go Home" or "Hide done" from ⌘K (`src/CommandPalette.vue`). The single-key shortcuts (`src/shortcuts.ts:3`) only filter, create, edit and move in the current list: there is no key for Home or for a new Task from anywhere. Most visible to someone who works from the keyboard.
7. **Nothing shows staleness.** Records show their age only in the page footer (`src/RecordPage.vue:271`). Nothing lists Open questions by how long they've waited, or Systems not touched in months. "Needs attention" covers only empty required fields (`src/records.ts:272`). Broken Mentions show only where they're rendered (`src/mentions.ts:157`). Feeds *What does a periodic Review flag as stale or broken?* (07).
8. **Following a link swaps the list column.** `openRecord` sets the list to the target's type (`src/navigation.ts:12`), so following a Mention or Relation drops the filtered list you were working in. Back restores it. Minor.

### Quick fixes (bugs rather than roadmap features)

- A meeting's title should follow its kind while it is still the default `<date> log` (item 4).
- The palette's "Create …" should apply the type's template the way New does (item 4).

### For the cap on Tasks (06)

Nothing in the code or the sample calls for priorities, subtasks or boards. The sample has 10 Tasks, 7 of them in Projects. The pain is getting Tasks *in* (items 1 and 2) and acting on them in place (item 5), not organising them. The cap holds.
