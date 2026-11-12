import base from './vite.config'

// `npm run perf-notebooks`: builds the large Notebooks in perf-notebooks/, which `npm test` leaves out.
export default { ...base, test: { ...base.test, include: ['scripts/perf/generate.ts'], setupFiles: [] } }
