# Sample Notebook

A made-up Notebook (a fictional company, Kestrel & Pine) that uses every feature, to see how the app looks with real content.

## Open it

1. `npm run build`
2. Open `dist/notebook.html` in Chrome or Edge.
3. **Pick folder** and choose this `sample-notebook` folder. In a browser without folder access, use **Open notebook.sqlite** instead.

From Windows, copy this folder out of `\\wsl.localhost\...` to a normal Windows folder first: that is the safest.

The app writes a `backups/` folder here; it is not committed.

## Rebuild it

`npm run sample` rewrites `notebook.sqlite` through the app's own modules (`scripts/sample/generate.ts`). Run it after a schema change.

Dates are relative to the day the file was generated, so the overdue and due-today markers on Tasks only look right on that day. Regenerate to refresh them.
