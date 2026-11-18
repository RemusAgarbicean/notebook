# T2: Push and the done box on the Open Tasks card and the Project checklist

Spec: `.scratch/specs/today-strip.md`. Labels: `ready-for-agent`. Blocked by: none.

Add the pure Push date rule to the due module (unit-tested in `due.test.ts`) and a reusable Push component (Tomorrow / Next week / Pick a date). Use it on the open Tasks in a Project's Tasks checklist. Give Home's Open Tasks card rows a done box plus Push, so the controls aren't nested inside a button.

Covers user stories 11–15, 18–22, 41 (Push label), 43, plus the Push / Done box / Home rows parts of Implementation Decisions. Don't touch the Today strip (T1/T3).

Done when the UI tests for Push on the card and the checklist pass (in `src/today-strip-ui.test.ts` or a `push-ui.test.ts`), existing tests are updated and pass, and `npm run build` is clean.
