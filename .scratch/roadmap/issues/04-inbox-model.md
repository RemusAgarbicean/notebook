# Is an Inbox a Record type, a Tag or a state?

Type: grilling
Status: resolved
Assignee: Remus

## Question

Quick capture needs somewhere to drop unsorted thoughts. Is an Inbox a new Record type, a reserved Tag, or an 'unsorted' state any Record can be in? How is an item sorted out of it? Settle the glossary term.

## Resolution

**An Inbox item is not a Record.** The **Inbox** is where unsorted thoughts wait. An **Inbox item** is one line of text, possibly containing Mentions, with no type, no Tags, no Relations and no Images. Both terms are in `GLOSSARY.md`.

Why not a Record type, a Tag or a state: each Record type is its own table, and a Record can't change type (`src/migrations.ts`). A Tag or an "unsorted" state both require choosing a type at capture, which is the friction capture exists to remove. An "Inbox item" Record type would need a type-conversion path (moving Tags, Relations and Images, and rewriting every Mention that points at it). Keeping items outside the Records means nothing can point at them, so there's nothing to convert.

- **Capture**: a global shortcut and a palette command open a single-line box without leaving the current page. You don't choose a type.
- **Sorting** is a triage pass in the Inbox, with one key per type (`t` Task, `q` Open question, `p` Person, …). It creates the Record and moves to the next item without opening the Record; Shift plus the key also opens it. The new Record keeps the capture date as its creation date. Fields like Due or whom to ask are filled in later.
- **Add to…** picks an existing Record and appends the line, with its date, to the end of that Record's notes.
- **Delete** discards the item.
- **Mentions**: the new Record's title is the line with the `[[ ]]` brackets stripped, and its notes start with the original line, so Mentions keep linking. "Add to…" appends the original line. Filling in "whom to ask" from a Mention is left to the spec as a nice-to-have.
- **Visibility**: the Today strip shows "Inbox · N, oldest X days", and the periodic Review flags items older than a week. There's no hard limit and no blocking prompt.
- **Journal-entry lines skip the Inbox**: a line turned into a Task or Open question becomes a typed Record right away, because the type is known from the action.

No ADR: the choice is reversible (Inbox items could later be migrated into a Record type) and is explained here.
