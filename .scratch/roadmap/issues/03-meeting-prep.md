# What does meeting prep gather for a Person or Team, and do answers flow back?

Type: grilling
Status: resolved
Assignee: Remus

## Question

Before a 1:1 or meeting with a Person or Team, what should the Notebook gather (Open questions whose whom-to-ask is them, shared open Tasks, past Journal entries mentioning them, related Projects)? Where is it shown, and how do answers given in the meeting flow back into Open questions and Tasks?

## Answer

Resolved 2026-11-18 by grilling. New glossary term: **Prep** (under Connections in `GLOSSARY.md`).

**Where it shows.** A **Prep panel on the meeting Journal entry**, filled from the entry's Attendees and visible while taking notes. The same lists appear as a compact Prep section on the Person page; both read from one query.

**What it gathers, per Attendee (grouped by Person):**
1. Open questions whose Ask is that Person.
2. Open Tasks related to them, by Relation or Mention.
3. The last 3 Journal entries they attended or are mentioned in.

Projects (already on the Person page) and "changed since last meeting" (the Review's job, *What does a periodic Review flag as stale or broken?*) are left out.

**Teams.** No Team-level prep yet. Attendees are People only (the slot offers only Person), so a Team meeting means listing the People who came, and Prep gathers per Attendee.

**Answers flow back inline.** Each question in the Prep panel gets an "Answer" box. Filling it:
- sets the question's status to answered, stores the answer text and the date answered;
- adds an **"answered by"** Relation from the question to the meeting Journal entry. The existing label is reused, not a new one: "answered by" means "where to find the answer", whether that's the meeting or a Record made with Make Record (`src/AnswerFlow.vue:26`). No migration.
- appends `Answered: [[Question title]]` to the meeting notes (a Mention), so the notes read as a complete record of the meeting.

**New Tasks and questions from the meeting.** Turning a line into a Record belongs to *How does a line in a Journal entry become a Task or Open question?*. The constraint from here: a Task or question made in a meeting must be linked to that meeting entry, so it shows up in the next Prep with those Attendees.

**Starting a meeting.** "Meet" on a Person page creates a meeting Journal entry titled `<date> <Person>` with that Person already an Attendee, and lands in Prep. The Today strip's "New meeting" asks whom you're meeting, then does the same. This also covers the first quick fix in audit item 4 (the default "… log" title).
