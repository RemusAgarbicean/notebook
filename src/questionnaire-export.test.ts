import { expect, test } from 'vitest'
import { emailText, markdown, printHtml, type ExportItem, type Snapshot } from './questionnaire-export'

// Seam 3: the export renderers, from a Questionnaire snapshot to text.

const item = (text: string, more: Partial<ExportItem> = {}): ExportItem => ({
  text,
  help: '',
  answerType: 'short_text',
  options: [],
  allowOther: false,
  unit: null,
  scaleLow: null,
  scaleHigh: null,
  section: '',
  answer: null,
  ...more,
})

const INTAKE: Snapshot = {
  title: 'Coupa rollout intake',
  project: 'Coupa rollout',
  respondents: ['Mara Stan', 'Dan Ionescu'],
  date: '2026-11-20',
  items: [
    item('What problem does this project solve?', { section: 'Scope', answerType: 'long_text', help: 'In a few sentences.' }),
    item('Project sponsor', { section: 'Scope' }),
    item('Is there a hard deadline?', { section: 'Timeline', answerType: 'yes_no' }),
    item('Target go-live date', { section: 'Timeline', answerType: 'date' }),
    item('Which environments are involved?', {
      section: 'Systems',
      answerType: 'multi_choice',
      options: ['Dev', 'Test', 'Production'],
      allowOther: true,
    }),
    item('Hosting', { section: 'Systems', answerType: 'single_choice', options: ['Cloud', 'On premises'] }),
    item('How many users?', { section: 'Systems', answerType: 'number', unit: 'users' }),
    item('How critical is this to the business?', { section: 'Systems', answerType: 'scale', scaleLow: 'Low', scaleHigh: 'High' }),
  ],
}

const ANSWERED: Snapshot = {
  ...INTAKE,
  items: INTAKE.items.map((i, n) => ({
    ...i,
    answer: [
      { text: 'Purchasing runs on email.\n\n![invoice flow](image:4)' },
      { text: 'Ana' },
      { yes: true, comment: 'Contract ends in **March**.' },
      { date: '2027-03-01' },
      { choices: ['Dev', 'Production'], other: 'Sandbox' },
      { choice: 'Cloud' },
      { number: 250 },
      { scale: 4 },
    ][n] as ExportItem['answer'],
  })),
}

test('blank Markdown: the facts, the sections, numbered questions, boxes for choices and lines for text', () => {
  expect(markdown(INTAKE, { answers: false })).toBe(
    [
      '# Coupa rollout intake',
      '',
      '- **Project:** Coupa rollout',
      '- **Respondents:** Mara Stan, Dan Ionescu',
      '- **Date:** 2026-11-20',
      '',
      '## Scope',
      '',
      '**1. What problem does this project solve?**',
      '_In a few sentences._',
      '',
      '_______',
      '_______',
      '_______',
      '',
      '**2. Project sponsor**',
      '',
      '_______',
      '',
      '## Timeline',
      '',
      '**3. Is there a hard deadline?**',
      '',
      '- [ ] Yes',
      '- [ ] No',
      '',
      '**4. Target go-live date**',
      '',
      '_______ (date)',
      '',
      '## Systems',
      '',
      '**5. Which environments are involved?**',
      '',
      '- [ ] Dev',
      '- [ ] Test',
      '- [ ] Production',
      '- [ ] Other: _______',
      '',
      '**6. Hosting**',
      '',
      '- [ ] Cloud',
      '- [ ] On premises',
      '',
      '**7. How many users?**',
      '',
      '_______ users',
      '',
      '**8. How critical is this to the business?**',
      '',
      '- [ ] 1 (Low)',
      '- [ ] 2',
      '- [ ] 3',
      '- [ ] 4',
      '- [ ] 5 (High)',
      '',
    ].join('\n'),
  )
})

test('answered Markdown: ticked boxes, the answers as written, and Images as a placeholder', () => {
  expect(markdown(ANSWERED, { answers: true })).toBe(
    [
      '# Coupa rollout intake',
      '',
      '- **Project:** Coupa rollout',
      '- **Respondents:** Mara Stan, Dan Ionescu',
      '- **Date:** 2026-11-20',
      '',
      '## Scope',
      '',
      '**1. What problem does this project solve?**',
      '_In a few sentences._',
      '',
      'Purchasing runs on email.',
      '',
      '[image: invoice flow]',
      '',
      '**2. Project sponsor**',
      '',
      'Ana',
      '',
      '## Timeline',
      '',
      '**3. Is there a hard deadline?**',
      '',
      '- [x] Yes',
      '- [ ] No',
      '',
      'Contract ends in **March**.',
      '',
      '**4. Target go-live date**',
      '',
      '2027-03-01',
      '',
      '## Systems',
      '',
      '**5. Which environments are involved?**',
      '',
      '- [x] Dev',
      '- [ ] Test',
      '- [x] Production',
      '- [x] Other: Sandbox',
      '',
      '**6. Hosting**',
      '',
      '- [x] Cloud',
      '- [ ] On premises',
      '',
      '**7. How many users?**',
      '',
      '250 users',
      '',
      '**8. How critical is this to the business?**',
      '',
      '- [ ] 1 (Low)',
      '- [ ] 2',
      '- [ ] 3',
      '- [x] 4',
      '- [ ] 5 (High)',
      '',
    ].join('\n'),
  )
})

test('answered Markdown leaves an unanswered Item blank, and the blank one ignores answers', () => {
  const mixed: Snapshot = { ...INTAKE, items: [ANSWERED.items[1], INTAKE.items[2]] }
  expect(markdown(mixed, { answers: true })).toContain('**2. Is there a hard deadline?**\n\n- [ ] Yes\n- [ ] No\n')
  expect(markdown(ANSWERED, { answers: false })).toBe(markdown(INTAKE, { answers: false }))
})

test('facts with nothing in them are left out, and Items without a section get no heading', () => {
  const bare: Snapshot = { title: 'Quick check', project: '', respondents: [], date: '2026-11-20', items: [item('Anything else?')] }
  expect(markdown(bare, { answers: false })).toBe('# Quick check\n\n- **Date:** 2026-11-20\n\n**1. Anything else?**\n\n_______\n')
})

test('email text: plain, numbered, options indented under each question, and a closing reply hint', () => {
  expect(emailText(ANSWERED)).toBe(
    [
      'Coupa rollout intake',
      'Project: Coupa rollout',
      'Respondents: Mara Stan, Dan Ionescu',
      'Date: 2026-11-20',
      '',
      'SCOPE',
      '',
      '1. What problem does this project solve?',
      '   In a few sentences.',
      '',
      '2. Project sponsor',
      '',
      'TIMELINE',
      '',
      '3. Is there a hard deadline?',
      '   - Yes',
      '   - No',
      '',
      '4. Target go-live date (date)',
      '',
      'SYSTEMS',
      '',
      '5. Which environments are involved? (pick any)',
      '   - Dev',
      '   - Test',
      '   - Production',
      '   - Other: ...',
      '',
      '6. Hosting (pick one)',
      '   - Cloud',
      '   - On premises',
      '',
      '7. How many users? (users)',
      '',
      '8. How critical is this to the business? (1 = Low, 5 = High)',
      '',
      'Please reply inline: write your answer under each question.',
      '',
    ].join('\n'),
  )
})

// The print view, read as a reader of the page would: its headings, questions, boxes and lines.
const view = (html: string) => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}
const texts = (el: Element, selector: string) => [...el.querySelectorAll(selector)].map((e) => e.textContent!.trim())

test('blank print view: title, facts, sections, numbered questions, ☐ boxes and answer lines', () => {
  const el = view(printHtml(INTAKE, { answers: false }))
  expect(texts(el, 'h1')).toEqual(['Coupa rollout intake'])
  expect(texts(el, 'dt')).toEqual(['Project', 'Respondents', 'Date'])
  expect(texts(el, 'dd')).toEqual(['Coupa rollout', 'Mara Stan, Dan Ionescu', '2026-11-20'])
  expect(texts(el, 'h2')).toEqual(['Scope', 'Timeline', 'Systems'])
  expect(texts(el, '.print-question')).toEqual(INTAKE.items.map((i, n) => `${n + 1}. ${i.text}`))
  expect(texts(el, '.print-help')).toEqual(['In a few sentences.'])
  const items = [...el.querySelectorAll('.print-item')]
  expect(items[0].querySelectorAll('.print-line')).toHaveLength(3)
  expect(texts(items[2], '.print-boxes li')).toEqual(['☐ Yes', '☐ No'])
  expect(texts(items[4], '.print-boxes li')).toEqual(['☐ Dev', '☐ Test', '☐ Production', '☐ Other: _______'])
  expect(texts(items[6], '.print-line')).toEqual(['users'])
  expect(texts(items[7], '.print-boxes li')).toEqual(['☐ 1 (Low)', '☐ 2', '☐ 3', '☐ 4', '☐ 5 (High)'])
  expect(el.querySelectorAll('.print-answer')).toHaveLength(0)
})

test('answered print view: ☑ boxes, the answers, and markdown rendered with its Images', () => {
  const el = view(printHtml(ANSWERED, { answers: true }))
  const items = [...el.querySelectorAll('.print-item')]
  // Rendered as notes are; with no Notebook open, Image 4 is a missing one (Seam 1 shows a real Image printed).
  expect(texts(items[0], '.print-answer')).toEqual(['Purchasing runs on email.\nMissing image: invoice flow'])
  expect(texts(items[1], '.print-answer')).toEqual(['Ana'])
  expect(texts(items[2], '.print-boxes li')).toEqual(['☑ Yes', '☐ No'])
  expect(items[2].querySelector('.print-answer strong')!.textContent).toBe('March')
  expect(texts(items[4], '.print-boxes li')).toEqual(['☑ Dev', '☐ Test', '☑ Production', '☑ Other: Sandbox'])
  expect(texts(items[6], '.print-answer')).toEqual(['250 users'])
  expect(texts(items[7], '.print-boxes li')).toEqual(['☐ 1 (Low)', '☐ 2', '☐ 3', '☑ 4', '☐ 5 (High)'])
  expect(el.querySelectorAll('.print-line')).toHaveLength(0)
})

test('the print view escapes what the user wrote', () => {
  const el = view(
    printHtml({ ...INTAKE, title: '<b>Intake</b>', items: [item('Is 2 < 3?', { answer: { text: '<i>yes</i>' } })] }, { answers: true }),
  )
  expect(texts(el, 'h1')).toEqual(['<b>Intake</b>'])
  expect(texts(el, '.print-question')).toEqual(['1. Is 2 < 3?'])
  expect(texts(el, '.print-answer')).toEqual(['<i>yes</i>'])
  expect(el.querySelector('b, i')).toBeNull()
})
