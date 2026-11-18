# Score the candidates and write the roadmap

Type: grilling
Status: resolved
Assignee: Remus
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08

## Question

Using the resolved tickets and the audit, score each candidate feature on the map's ranking criteria, pick the 5–8 that make the roadmap, and write each one's one-paragraph spec. This reaches the destination.

## Resolution

Resolved 2026-11-18 by grilling. The roadmap is in [`roadmap.md`](../roadmap.md): a ranked table plus a one-paragraph spec for each feature, ready for `to-spec` / `to-tickets`.

- **Scoring**: 1–3 per criterion (daily use, cost with 3 = cheapest, compounding value), ranked by the criteria in that order. Dependencies are noted but don't change the order: each spec ships on its own, with "When X ships" lines for what it gains later.
- **Ranking** ("next" for 1–6, "later" for 7–8): 1 Today strip · 2 Promote a Journal line to a Task or Open question · 3 Palette commands · 4 Meeting Prep · 5 Inbox capture and triage · 6 Recurring Tasks and snooze · 7 Review · 8 Make Diagram from Relations.
- **Push** moves from Recurring Tasks into the Today strip, so rank 1 doesn't wait on rank 6.
- **Quick fixes** (a meeting's title follows its kind; the palette's Create applies the template) fold into Meeting Prep and can ship ahead of it.
- **Home's Open Tasks card** keeps every open Task, with done boxes and Push. The strip is "act now", the card is the full list.
- **Promote line**: Journal entries only in the first version. A palette command "Promote line…" gives keyboard access, and an Undo toast deletes the Record and removes the `→ [[…]]`.
- **Palette commands**: Go Home, Today's log, New meeting, plus `g h` (the first two-key chord). Capture, Review, Make Diagram and Promote line… arrive with their features.
- **Left out**: Journal templates for each meeting type, and the link that replaces the list column (audit item 8).
