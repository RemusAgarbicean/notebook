# How is a Diagram generated from a Record's Relations?

Type: prototype
Status: resolved
Assignee: Remus

## Question

From a Record (e.g. a Process or Project), generate a Diagram whose Nodes are linked to it and its related Records, laid out automatically. How many hops? Which Relation labels become Edges' text? Is it a one-off snapshot Diagram the user then edits, or does it stay in sync? Prototype on the sample Notebook.

## Resolution

Resolved 2026-11-18 by prototype. The user asked for the agent's recommendation, so this is it: **variant A (Snapshot) plus variant C's growing as "Add related"**. Variant B (a live map section that is not a Diagram) is dropped: it repeats the Relations section and isn't a Diagram you can draw on.

- **Make Diagram** (a button on any Record page except a Diagram, and a palette command) creates a new Diagram titled `<Record title> map` and opens it. Its Nodes are linked to the Record and to the Records 1 Relation away. A picker offers 1 or 2; there's no 3. In the sample Notebook, 1 step out gives 4–9 Nodes, 2 gives about 9–20, and 3 gives 19–32, which is most of the Notebook.
- **Layout** uses the existing Tidy (dagre, left to right), so it matches what Tidy does afterwards.
- **Edges**: one per Relation between two Records on the Diagram, including Relations between two related Records, not only those touching the root. The arrow points from → to, as the Relation is saved, and the Edge's text is the label's forward reading (e.g. "part of"). Text is always on; the user can clear it per Edge.
- **Snapshot, never in sync.** The result is an ordinary Diagram. Later Relations don't appear and deleting an Edge doesn't remove the Relation (an Edge is never a Relation, see `GLOSSARY.md`). Node titles stay current because the Nodes are linked (the existing `withLiveTitles`). Running Make Diagram again makes a second Diagram.
- **Add related** (from variant C) is an action on a linked Node in any Diagram, generated or hand-drawn. It adds the Records related to that Node's Record that aren't on the Diagram yet, placed with `childPosition`, plus Edges for every Relation among the Nodes now on it. The action shows how many it would add ("Add related (5)") and is disabled at 0. This is how a Diagram goes further out than 2 steps, branch by branch.
- **Only Relations count, not Mentions.** Mentions are prose and would flood the Diagram.

No new glossary terms. "Make Diagram" and "Add related" are actions, not domain concepts.

Prototype (primary source): local branch `prototype/diagram-from-relations`, `src/prototype-diagram-from-relations/` (never merged). The prototype only type-checked; the user didn't react to the variants before delegating the choice.
