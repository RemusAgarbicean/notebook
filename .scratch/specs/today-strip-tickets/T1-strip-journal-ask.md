# T1: Today strip with Journal and Ask columns

Spec: `.scratch/specs/today-strip.md`. Labels: `ready-for-agent`. Blocked by: none.

Build the Today strip component at the top of Home (between the search box and the card grid) with three column slots. Fill in **Journal** and **Ask**. Leave a placeholder Due now column that T3 fills; it can render nothing or the empty text for now.

Covers user stories 1, 2, 23–37, 39, 40, 42, plus the Journal/Ask parts of Implementation Decisions (move the `todays-log` button out of the Journal card into the strip, keeping the test id; New meeting; the Ask query and grouping; the waiting-text helper, unit-tested in `due.test.ts`).

Done when the UI tests in `src/today-strip-ui.test.ts` for Journal and Ask pass, existing tests are updated and pass, and `npm run build` is clean.
