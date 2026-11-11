# Notebook

A personal, single-user information center for onboarding into a procurement analytics job: what each system does, who does what, what acronyms mean, and how it all connects.

## Records

**Record**:
Any typed entry the user keeps: a System, Acronym, Person, Diagram, Bookmark, Open question, Task, Journal entry, Team, Process or Project.
_Avoid_: Item, entity, object

**System**:
A software tool or platform used at work (e.g. Coupa, SAP, Tableau), with what it does and who owns it.
_Avoid_: Tool, app, platform

**Acronym**:
An abbreviation and its expansion, with context on where it is used (e.g. PO, S2P).
_Avoid_: Abbreviation, term

**Person**:
A colleague or contact, with their role, team and what to go to them for.
_Avoid_: Contact, colleague, user

**Team**:
A group of People, such as a department or a brand's team.
_Avoid_: Group, department

**Process**:
A named business procedure (e.g. Source-to-Pay) involving Systems and People.
_Avoid_: Workflow, flow

**Project**:
A piece of work the user is involved in, with an outcome, that Tasks, People, Teams and other Records can be part of.
_Avoid_: Initiative, workstream, engagement

**Bookmark**:
A saved URL, such as a dashboard or a documentation page.
_Avoid_: Link

**Open question**:
Something the user doesn't understand yet, with whom to ask and, eventually, its answer.
_Avoid_: Question, doubt

**Task**:
Something the user needs to get done; it is either open or done.
_Avoid_: To-do, action item

**Journal entry**:
A dated note, covering both meeting/1:1 notes and the daily learning log.
_Avoid_: Meeting note, log, diary

**Tag**:
A free-text label attachable to any Record.
_Avoid_: Label, category

## Connections

**Relation**:
A deliberate, directed, labelled connection from one Record to another (e.g. Maria owns Coupa), seen from both ends.
_Avoid_: Link, reference

**Relation label**:
The pair of readings on a Relation, one from each end (e.g. owns / owned by).
_Avoid_: Label on its own in UI text, Tag

**Mention**:
A `[[Record]]` reference inside a Record's notes; it is part of the text, not a Relation.
_Avoid_: Wiki link, backlink

**Relation slot**:
A named picker on a Record type (e.g. a System's Owner) that adds and removes Relations with a fixed label.
_Avoid_: Reference field, foreign key

**Diagram**:
A canvas of Nodes and Edges, used for mind maps and system diagrams.
_Avoid_: Mind map, chart, canvas

**Node**:
A box on a Diagram; free text, or linked to a Record of any type (another Diagram included), in which case it shows that Record's title.
_Avoid_: Shape, box

**Edge**:
A line connecting two Nodes on a Diagram; it is part of the drawing and never a Relation, even between linked Nodes.
_Avoid_: Link, arrow, connector

## Storage

**Backup**:
A dated copy of the whole Notebook, taken automatically once a day and before upgrades, imports and restores, or by hand, and kept next to it. Restoring a Backup replaces the Notebook with that copy.
_Avoid_: Snapshot, version
