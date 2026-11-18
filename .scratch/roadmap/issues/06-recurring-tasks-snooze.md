# How do recurring Tasks and snooze work?

Type: grilling
Status: resolved
Assignee: Remus
Blocked by: 01

## Question

Define recurring Tasks (rule shape, what happens on done: new Task vs. moved due date, history) and snooze (hide until a date, for Tasks and maybe Open questions). Confirm against the audit that the cap (no priorities/subtasks/Kanban) still holds.

## Resolution

**Recurring Tasks roll forward. A push moves a due date. Only Open questions snooze.** The three terms (Recurring Task, Push, Snooze) are in `GLOSSARY.md`.

**Recurring Task**
- Ticking one keeps the same Task open and moves its due date to the next date in the rule, so Mentions, Relations, the Project and Prep keep pointing at one Record. It doesn't create done copies.
- Completion history: each tick records its date. The Task page shows the last 10 ("Done on …").
- Rules: every N days, every N weeks (on the due date's weekday) or every N months (on the due date's day, or the month's last day). There's no "first Monday", no list of several weekdays and no end date.
- Fixed schedule: the next date counts from the due date, not the day it was ticked. A Task several cycles behind jumps to the first date after today; overdue copies don't stack up.
- A **Repeats** field sits next to Due. Choosing a rule when Due is empty sets Due to today. Quick-add doesn't parse rules.
- Ending one: clear Repeats, then tick once more. There's no prompt on tick.

**Push (Tasks)**: there is no "hidden until" state for Tasks. A push moves the due date: *Tomorrow / Next week / Pick a date*. A Task with no due date gets one. On a Recurring Task, a push moves only this occurrence and leaves the schedule as it is. Push is on every row with a done box (the Today strip, Home's Open Tasks card, a Project's checklist), and recurring rows show ↻. This settles the Today strip's "push to tomorrow".

**Snooze (Open questions)**: the choices are *Tomorrow / Next week / Pick a date*, with no "until I next meet <Person>". Until its date, a snoozed question is hidden from the Today strip and the Review. In Prep it sits under a collapsed "Snoozed (n)", and in the Open questions list it carries a "snoozed until …" marker. Its waiting time keeps counting from when it was created. Inbox items can't be snoozed: their triage stays sort / Add to… / Delete.

**Cap**: it holds, as the audit found. No priorities, subtasks, boards or Task dependencies.

No ADR: everything here is cheap to reverse.
