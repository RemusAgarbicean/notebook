import base from './vite.config'

// `npm run sample`: runs only the sample Notebook generator, which `npm test` leaves out.
export default { ...base, test: { ...base.test, include: ['scripts/sample/generate.ts'], setupFiles: [] } }
