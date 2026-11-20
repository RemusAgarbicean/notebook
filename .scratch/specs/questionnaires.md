# Spec: Questionnaires, the Question bank and Question sets

Labels: `ready-for-agent`
Status: open (local; becomes a GitHub issue once `gh` is set up)
Decided with the user on 2026-11-20. The answers are filled in by the user in the app; export is Markdown, Copy as email text, and Print / Save as PDF. Reuse covers single Questions and saved Question sets. Answer types: short/long text, yes/no, single/multi choice, number, date, scale 1–5. An unanswered item can become an Open question.

## Problem Statement

When a stakeholder comes to me with a project, I gather the same kinds of things every time: goals and scope, requirements, who needs which accesses, what the project depends on, data, timeline and risks. Right now I write these questions from scratch into a Journal entry or a Project's notes. They're inconsistent from one project to the next, I forget some, and the answers end up as loose text I can't scan. I have no way to keep a good question and reuse it, to keep a standard intake list, or to bring in a list of questions I already have in a spreadsheet.

## Solution

A new Record type, **Questionnaire**, holds an ordered list of **Items**. Each Item is a question with an **Answer type** and an answer. A Questionnaire belongs to a Project and names its **Respondents** (People). I build one quickly from a **Question bank** of reusable Questions, grouped by category, or from a **Question set** (a saved, ordered list of Questions such as "New project intake"). I can also write a new question on the spot and save it to the bank. The app ships with a starter bank and starter sets. Questions can be bulk-imported from a CSV file or a pasted table. I fill in the answers in the app, by type: text, yes/no, choices, number, date, scale. An unanswered Item can become an Open question addressed to the Respondents with one click. A Questionnaire exports as Markdown, as plain email text, or through a print layout that the browser can save as a PDF.

## User Stories

1. As a Notebook user, I want a Questionnaires entry in the sidebar, so that I can find all my questionnaires in one list.
2. As a Notebook user, I want to create a Questionnaire like any other Record (New, the palette's Create, Ctrl+K), so that it works like everything else.
3. As a Notebook user, I want a Questionnaire to have a title, notes, Tags, Relations and Mentions like other Records, so that it fits into my Notebook.
4. As a Notebook user, I want a Project slot on a Questionnaire, so that I can see which project it gathers information for.
5. As a Notebook user, I want a Questionnaires section on a Project page, so that I can see and open a project's questionnaires from the project.
6. As a Notebook user, I want a Respondents slot (People) on a Questionnaire, so that I know whom it is for.
7. As a Notebook user, I want a status (draft, in progress, done) on a Questionnaire, so that I know where it stands.
8. As a Notebook user, I want a Questionnaire page to show its Items in order, each with its question, help text and answer control, so that I can work through it top to bottom.
9. As a Notebook user, I want to add Questions from the Question bank through a searchable picker filtered by category, so that I can build a questionnaire in seconds.
10. As a Notebook user, I want to add a whole category from the picker in one go, so that I can pull in, say, every Access question at once.
11. As a Notebook user, I want to add a Question set to a Questionnaire in one click, so that a standard intake is ready immediately.
12. As a Notebook user, I want Questions already on the Questionnaire marked in the picker, and not added twice, so that I don't get duplicates.
13. As a Notebook user, I want to write a new question directly on the Questionnaire, with its Answer type and options, so that I'm not limited to the bank.
14. As a Notebook user, I want a "Save to bank" choice when I write a new question, so that a good question can be reused later.
15. As a Notebook user, I want to change an Item's wording, help text, type or options on one Questionnaire without changing the bank, so that I can tailor a question for this stakeholder.
16. As a Notebook user, I want editing a Question in the bank to leave existing Questionnaires as they are, so that past questionnaires keep the exact wording that was asked.
17. As a Notebook user, I want to reorder Items (move up/down, and with the keyboard), so that the questions flow logically.
18. As a Notebook user, I want to remove an Item, with Undo, so that I can drop questions that don't apply.
19. As a Notebook user, I want optional section headings between Items (the Question's category by default), so that a long questionnaire is easy to scan.
20. As a Notebook user, I want a short text answer for one-line answers, so that names and short facts are quick to enter.
21. As a Notebook user, I want a long text answer (Markdown, with Mentions) for detailed answers, so that I can capture explanations and link Records.
22. As a Notebook user, I want a Yes/No answer with an optional comment, so that I can record true/false questions plus a caveat.
23. As a Notebook user, I want a single choice answer from listed options, so that I can capture one of a known set of values.
24. As a Notebook user, I want a multiple choice answer, so that I can capture several values, such as the environments a project touches.
25. As a Notebook user, I want an "Other" option on choice questions that takes free text, when the Question allows it, so that unexpected answers still fit.
26. As a Notebook user, I want a number answer, with an optional unit shown next to it (users, €, GB), so that quantities stay numeric.
27. As a Notebook user, I want a date answer, so that deadlines and go-live dates are real dates.
28. As a Notebook user, I want a scale 1–5 answer with labels at both ends, so that I can record priority, confidence or satisfaction.
29. As a Notebook user, I want to clear any answer, so that I can undo a wrong entry.
30. As a Notebook user, I want answers saved as I type or click, like every other edit, so that I never lose them.
31. As a Notebook user, I want a progress count ("7 of 12 answered") on the Questionnaire page and in the list, so that I see how complete it is.
32. As a Notebook user, I want to filter the Items to "Unanswered only", so that I can focus on the gaps in a follow-up meeting.
33. As a Notebook user, I want a **Follow up** button on an unanswered Item that creates an Open question with the Item's text, asked of the Questionnaire's Respondents, so that the gap shows in the Today strip's Ask column.
34. As a Notebook user, I want the Open question's notes to mention the Questionnaire, and the Item to show a link to its Open question, so that I can move between them.
35. As a Notebook user, I want answering that Open question to show its answer on the Item, and fill in a text Item's answer, so that the questionnaire completes itself.
36. As a Notebook user, I want an Item that has a follow-up to say "Following up: <Open question>" until it is answered, so that I don't follow it up twice.
37. As a Notebook user, I want a Question bank screen, opened from the sidebar, that lists every Question grouped by category, with search, so that I can manage my reusable questions.
38. As a Notebook user, I want to create, edit and delete Questions in the bank (text, help, Answer type, options, allow Other, unit, scale labels, category), so that the bank stays accurate.
39. As a Notebook user, I want to rename a category and see it change on all its Questions, so that I can reorganise the bank.
40. As a Notebook user, I want the bank to ship with about 40 starter Questions across Goals and scope, Stakeholders, Requirements, Access, Dependencies, Data, Timeline and budget, Risks, and Non-functional, so that I can build a useful questionnaire on day one.
41. As a Notebook user, I want starter Question sets ("New project intake", "Access request", "Integration / dependency check"), so that the common intakes are one click.
42. As a Notebook user, I want to create, rename, reorder and delete Question sets, and add or remove Questions in them, so that I can keep my own standard lists.
43. As a Notebook user, I want to save a Questionnaire's current Items as a new Question set, so that a questionnaire I polished can become a standard.
44. As a Notebook user, I want deleting a Question from the bank to remove it from its sets but leave existing Questionnaires as they are, so that history is safe.
45. As a Notebook user, I want to import Questions from a CSV file or a pasted table (Excel/Sheets copy), so that I can bring in lists I already have.
46. As a Notebook user, I want the import to take the columns question, type, options, category, help (in any order, case-insensitive, and only question is required), so that the format is easy to prepare.
47. As a Notebook user, I want the import to accept friendly type names (text, long text, yes/no, true/false, choice, multiple choice, number, date, scale) and options separated by `|` or `;`, so that I don't need exact codes.
48. As a Notebook user, I want an import preview that shows each row, its parsed type and any problem (unknown type, choice without options), with duplicates of existing Questions skipped, so that I import cleanly.
49. As a Notebook user, I want to choose a category for rows without one, and optionally add all imported Questions to a new or existing Question set, so that an imported list becomes usable at once.
50. As a Notebook user, I want a downloadable example CSV in the import dialog, so that I know the format.
51. As a Notebook user, I want a Backup taken before an import, like Record import, so that a bad import can be undone.
52. As a Notebook user, I want to export a Questionnaire as Markdown (copy or download), blank or with answers, so that I can keep or share it as text.
53. As a Notebook user, I want "Copy as email text": plain text, numbered, with choices listed under each question and a reply hint, so that I can paste it into an email or chat to send ahead of a meeting.
54. As a Notebook user, I want "Print / Save as PDF" with a clean print layout (title, Project, Respondents, date, sections, answer lines, ☐ boxes for Yes/No and choices, blank or with answers), so that I can hand out or send a PDF.
55. As a Notebook user, I want global search to find a Questionnaire by an Item's question or answer text, so that I can find "who said we need VPN access".
56. As a Notebook user, I want Questionnaires included in Backups, Restore, Duplicate and Delete/Undo like other Records, so that they're as safe as everything else.
57. As a keyboard user, I want every control (picker, answer controls, reorder, follow up, export) usable without a mouse, so that I can fill in a questionnaire while talking.
58. As a screen-reader user, I want each answer control labelled with its question, so that I know what I'm answering.

## Implementation Decisions

- **Glossary first.** Add to `GLOSSARY.md`, in a new section "Questionnaires", each entry with an `_Avoid_:` line:
  - **Questionnaire**: a Record holding an ordered list of Items to put to Respondents. _Avoid_: survey, form.
  - **Item**: one question on one Questionnaire, with its own copy of the wording, its Answer type and its answer. _Avoid_: field, entry.
  - **Question**: a reusable question in the Question bank. _Avoid_: template question. Not to be confused with an **Open question**.
  - **Question bank**: every Question in the Notebook, grouped by category.
  - **Question set**: a named, ordered list of Questions that fills a Questionnaire in one step. _Avoid_: template, checklist.
  - **Answer type**: what kind of answer an Item takes (short text, long text, yes/no, single choice, multiple choice, number, date, scale 1–5).
  - **Respondent**: a Person a Questionnaire is for.
  - **Follow up**: turning an unanswered Item into an Open question.
- **Schema (one new migration, append-only, as `src/migrations.ts` requires):**
  - A Record table `questionnaire` built with the shared `record()` columns, plus `status text not null default 'draft' check (status in ('draft','in progress','done'))`.
  - `question` (bank): id, text, help, answer_type, options (JSON array), allow_other (int), unit, scale_low, scale_high, category, position, created_at, updated_at.
  - `question_set`: id, name, position. `question_set_item`: set_id, question_id, position; deleting a Question deletes its rows here.
  - `questionnaire_item`: id, questionnaire_id, position, question_id (nullable origin, used only for "already added"; never followed for wording), section, text, help, answer_type, options, allow_other, unit, scale_low, scale_high, answer (JSON or null), follow_up_id (nullable `open_question` id).
  - Seed the starter bank and starter sets in this same migration, so existing Notebooks get them on upgrade (a pre-upgrade Backup already happens).
  - New protected Relation label for Respondents, added by insert with an id that `LABEL` names (`respondent`, forward "responds to", reverse "has respondent"). The Project slot reuses `LABEL.partOf`, with the questionnaire as the `from` end, as Task → Project does.
- **Answer values** are stored as JSON in `answer`. The shapes come from a prototype-free decision:
  ```ts
  type AnswerType = 'short_text' | 'long_text' | 'yes_no' | 'single_choice' | 'multi_choice' | 'number' | 'date' | 'scale'
  type Answer =
    | { text: string }                              // short_text, long_text
    | { yes: boolean; comment?: string }            // yes_no
    | { choice: string; other?: string }            // single_choice ("Other" → choice '' + other)
    | { choices: string[]; other?: string }         // multi_choice
    | { number: number }                            // number
    | { date: string }                             // date, YYYY-MM-DD
    | { scale: 1 | 2 | 3 | 4 | 5 }                  // scale
  ```
  An Item counts as answered when `answer` isn't null and isn't an empty text or empty choice list.
- **Record type plumbing.** Add `questionnaire` to `RECORD_TYPES` (after Projects, with a ClipboardList-style icon), to `RECORD_FIELDS` (status as a choice; key `status`), to `RELATION_SLOTS` (Project and Respondents), and to `templates`/CSV export/global search wherever every type is listed. The list column's key line shows "status · n of m answered".
- **Domain module (the main seam).** A new questionnaire module that owns all reads and writes of the four new tables, so the Vue components never write SQL:
  - Items: list, add from Questions, add a set, add new (optionally saving to the bank), update wording/type/options, set or clear the answer, move, remove (and restore it for Undo), progress, and follow up.
  - Bank: list/search, create/update/delete Question, rename category.
  - Sets: CRUD, set membership and order, and save Items as a set.
  - Each write goes through the existing `transaction`/`markDirty` path and touches the Questionnaire's `updated_at`, so Recently edited, search and saving all work as for other Records.
- **Duplicate and Delete.** Duplicating a Questionnaire copies its Items without answers or follow-ups. Deleting one deletes its Items, and Undo delete restores them, which means extending the existing capture/restore in the undo-delete module.
- **Follow up.** Creates an `open_question` titled with the Item's text, with notes `From [[<Questionnaire title>]]` plus the help text. It adds an `askAbout` Relation from each Respondent Person, stores `follow_up_id`, and uses one transaction. On render, an Item with a follow-up reads the Open question's status and answer. While the Open question is open, the Item shows "Following up". Once it is answered, the Item shows the answer. For a text Item that is still unanswered, the Open question's answer is copied in once, at render, and saved. Other types show the answer as a hint, and the user picks the value.
- **Global search.** A Questionnaire's search texts also include its Items' text and answer text (labelled "Question" and "Answer" in the "where" hint). This happens in the search cache's `entry()`, so it keeps its update-on-write behaviour.
- **Question bank screen.** A sidebar footer entry, "Question bank", opens a dialog in the same pattern as `TemplatesDialog`/`LabelsSettings`. It has two tabs, Questions and Sets, with search, a category filter and group-by-category, an editor for one Question, and Import… on the Questions tab.
- **Import.** Reuse `parseTable`/`detectSeparator` from the bulk-import module for CSV/TSV and pasted tables. A pure planner maps rows to Questions and problems (unknown type, a choice type without options, empty text) and marks duplicates by folded text, using the existing `foldTitle`. Running the import takes a Backup ("question import"), inserts the Questions in one transaction, and optionally creates or extends a set. The example CSV is generated in the app and downloaded through the existing download helper.
- **Export.** Pure renderers from a Questionnaire snapshot (title, Project, Respondents, date, Items) to:
  - Markdown, blank or answered: `- [ ]` boxes for choices and Yes/No, and `_______` lines for text.
  - Email text: numbered, with indented options and a closing line inviting replies inline.
  - A print view: a dedicated print-only layout rendered into the page with a `@media print` stylesheet, which hides the app chrome, then `window.print()`.

  Markdown supports copy and download (reuse `clipboard` and `storage-download`'s `download`); email text supports copy.
- **Starter content.** About 40 Questions, written plainly, each with a sensible Answer type. Examples: "What problem does this project solve?" (long text); "Is there a hard deadline?" (yes/no); "Which environments are involved?" (multi choice: Dev | Test | Acceptance | Production); "Who needs access, and to which systems?" (long text); "Does it need VPN or remote access?" (yes/no); "Which systems does it depend on?" (long text); "How many users?" (number, unit users); "Target go-live date" (date); "How critical is this to the business?" (scale, Low–High); "Does it handle personal data (GDPR)?" (yes/no). Three starter sets reference them.
- **No ADR needed**: everything here follows existing patterns. The one hard-to-reverse part is the migration, and it is additive.

## Testing Decisions

- A good test drives the public surface and checks what the user sees or what is stored. It never inspects component internals.
- **Seam 1, App-mounted UI tests** (copy the setup in `src/due-ui.test.ts`, with `memoryStorage`). Cover:
  - building from the bank, a category and a set
  - a new question with Save to bank
  - answering each Answer type and clearing it
  - progress and the Unanswered filter
  - reorder and remove with Undo
  - Follow up into the Today strip's Ask column and back
  - the bank dialog: CRUD, sets and category rename
  - the import dialog: preview, problems, duplicates, set option
  - export menu actions (clipboard contents, download contents, the print view present with `window.print` stubbed)
- **Seam 2, the questionnaire domain module, tested against an in-memory Notebook** (prior art: `src/records.test.ts`, `src/relations.test.ts`). Cover:
  - the snapshot semantics (editing or deleting a bank Question leaves Items unchanged)
  - the answered rules for every type
  - Duplicate without answers
  - delete plus Undo restoring Items
  - the migration's seed counts (prior art: `src/migrations.test.ts`)
- **Seam 3, pure functions**: the import planner (type aliases, option separators, problems, duplicates) and the three export renderers (blank and answered). Prior art: `src/bulk-import.test.ts` and `src/record-markdown.test.ts`.
- Run `npm test` and `npm run build`, and check `npm run sample` and `npm run perf-notebooks` still pass (the sample and perf configs may list Record types).

## Out of Scope

- A stakeholder filling the questionnaire in themselves: no fillable HTML form file, no Word export, and no CSV answer import.
- Branching or conditional questions, required questions, scoring or weighting.
- Answer types beyond the eight listed (no file upload, no Person/Record picker as an answer type).
- Sending email from the app.
- Versioning of Question sets.

## Further Notes

- Constraints hold: single user, local-first, one HTML file, SQLite in a Notebook folder, no server, no AI calls.
- The tickets are in `.scratch/specs/questionnaires-tickets/`.
