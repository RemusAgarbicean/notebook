# How does a line in a Journal entry become a Task or Open question?

Type: prototype
Status: resolved
Assignee: Remus
Blocked by: 04

## Question

While writing a Journal entry (often meeting notes), turn a line into a Task or Open question in one action. What does the trigger look like (shortcut, gutter button, `[]` syntax)? Does the line become a Mention of the new Record? Does it link back to the Journal entry with a Relation? 

## Constraint from meeting prep

From *What does meeting prep gather for a Person or Team, and do answers flow back?*: a Task or Open question made from a line in a meeting entry must be linked to that entry, by Relation or by the line's Mention, so it shows up in the next Prep with those Attendees.

## Constraint from the Inbox decision

From *Is an Inbox a Record type, a Tag or a state?*: a line turned into a Task or Open question skips the Inbox and becomes a typed Record right away. Reuse the Inbox's Mention handling: the title is the line with the `[[ ]]` brackets stripped, and the notes keep the original line.

## Resolution

**Promote from the read view (prototype variant C).** Notes are written as usual during the meeting. Nothing is created while typing, and there is no marker syntax. Afterwards, in the rendered Notes of any Journal entry, pointing at a line (or giving it the keyboard's focus) shows two buttons: **☐ Task** and **? Question**.

- **Inline form**: a button opens a small form under the line. The title is pre-filled with the line, without its list marks or the `[[ ]]` brackets (the Inbox rule), and can be edited. A Task also gets **Due**. An Open question gets the **Ask** slot, shown as Attendee chips: the Attendees named in the line are pre-selected, and in a 1:1 (one Attendee) that Person is. Create or Cancel. Enter creates.
- **The line keeps its wording** and gets a Mention added at the end: `- Ana to send the SLA draft → [[Send the SLA draft]]`. The notes stay a faithful record of the meeting, and the Mention turns the line into a link.
- **Link back**: none beyond the Mention. The new Record's "Mentioned in" lists the meeting entry, which meets the meeting-prep constraint (the next Prep with those Attendees finds it). No Relation is added.
- **The new Record's notes** start with the original line, as for Inbox items.
- **Checkbox lines**: a `- [ ]` line stays a plain checklist item unless it is promoted. Promoting it drops the box, so the Task alone holds Done. There is no automatic conversion.
- A line that already ends in `→ [[…]]`, a heading or a blank line shows no buttons.
- The buttons only appear in the read view. While editing, Notes stay a plain textarea.

Rejected: **A** (a key at the caret creates the Record at once while typing, replacing the line) and **B** (`TODO` / `Q:` markers swept into a confirm list on Done). Both replace the line with the Mention, which loses what was said.

Left to the spec: a keyboard way to reach the buttons (focusing a line, or a palette command "Promote line…"), Undo of a promotion, and whether the buttons also appear on Notes of types other than Journal entries.

Prototype: local branch `prototype/line-to-record` (`src/prototype-line-to-record/`, shown on a Journal entry with `?variant=C`). Never merge.
