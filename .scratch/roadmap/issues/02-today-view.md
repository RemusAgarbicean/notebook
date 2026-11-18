# What goes on a Today view, and does it extend Home?

Type: prototype
Status: resolved
Assignee: Remus

## Question

Decide the contents and placement of a daily view: due/overdue Tasks, today's Journal entry, recently touched Records, unanswered Open questions grouped by whom to ask, possibly snoozed items returning. Does it extend `Home.vue` or become its own screen? Prototype a rough layout to react to.

## Answer

Resolved 2026-11-18 by prototype. The user picked **variant A, Home + Today strip**.

**Today extends Home; it is not a separate screen.** A Today strip sits at the top of `Home.vue`, above the existing cards, which stay as they are. It has three columns:

- **Due now**: open Tasks overdue or due today, each with a done box in place (fixes audit item 5) and a hover action to push it to tomorrow (its exact form waits on *How do recurring Tasks and snooze work?*).
- **Journal**: open or start today's entry, plus a "New meeting" button (the meeting start itself is shaped by *What does meeting prep gather for a Person or Team, and do answers flow back?* and audit item 4).
- **Ask**: open questions grouped by the Person to ask, each showing how many days it has waited (fixes audit item 3 on Home). Questions with no one to ask get their own group.

**Not chosen:** an agenda that replaces Home with Tasks grouped by date (B), and one ranked stream mixing all types (C). The user kept Home's cards rather than trading them for a single to-do list.

**For the spec (ticket 09):** the strip's Due now repeats the top of the Open Tasks card. The spec should decide whether that card drops overdue and due-today Tasks or stays as is. Recently edited stays a Home card, not part of the strip.

**Prototype:** branch `prototype/today-view` (commit d97f0ea, local only, never merge). Files are in `src/prototype-today/`; run `npm run dev` and open `/?variant=A`.
