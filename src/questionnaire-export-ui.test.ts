import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { addImage, imageMarkdown } from './images'
import { openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { addQuestions, listItems, listQuestions, setAnswer } from './questionnaires'
import { createRecord, today, type RecordRef } from './records'
import { slotsOf } from './relation-slots'
import { addToSlot } from './relations'
import { memoryFolder, memoryStorage } from './storage-memory'

// Seam 1: the Questionnaire page's Export menu, from the click to the clipboard, the download and the print view.

let app: VueWrapper
let intake: RecordRef

const PROBLEM = 'What problem does this project solve?'
const DEADLINE = 'Is there a hard deadline?'

beforeEach(async () => {
  closeNotebook()
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: memoryStorage(async () => folder) },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)

  intake = { type: 'questionnaire', id: createRecord('questionnaire', 'Coupa rollout intake') }
  const slot = (name: string) => slotsOf('questionnaire').find((s) => s.name === name)!
  addToSlot(slot('Project'), intake.id, { type: 'project', id: createRecord('project', 'Coupa rollout') })
  addToSlot(slot('Respondents'), intake.id, { type: 'person', id: createRecord('person', 'Mara Stan') })
  const bank = (text: string) => listQuestions().find((q) => q.text === text)!.id
  addQuestions(intake.id, [bank(PROBLEM), bank(DEADLINE)])
  const [problem, deadline] = listItems(intake.id)
  const image = addImage(intake, { mime: 'image/webp', width: 40, height: 30, data: new Uint8Array(5) })
  setAnswer(problem.id, { text: `Purchasing runs on email.\n\n${imageMarkdown(image, 'invoice flow')}` })
  setAnswer(deadline.id, { yes: true })
  openRecord(intake.type, intake.id)
  await flushPromises()
})
afterEach(() => {
  app.unmount()
  vi.restoreAllMocks()
})

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const menuItem = (text: string) => app.findAll('[role="menuitem"]').find((b) => b.text() === text)!
async function choose(text: string) {
  await get('export-menu').trigger('click')
  await menuItem(text).trigger('click')
  await flushPromises()
}
function clipboard() {
  const written: string[] = []
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (t) => void written.push(t))
  return written
}

// happy-dom has no window.print: a stub stands in for the browser's print dialog.
function stubPrint() {
  const print = vi.fn()
  window.print = print
  return print
}

const HEAD = `# Coupa rollout intake\n\n- **Project:** Coupa rollout\n- **Respondents:** Mara Stan\n- **Date:** ${today()}\n\n`

test('Copy as Markdown puts the answered Questionnaire on the clipboard, with Images as a placeholder', async () => {
  const written = clipboard()
  await choose('Copy as Markdown')

  expect(written).toHaveLength(1)
  expect(written[0]).toContain(HEAD)
  expect(written[0]).toContain(`**1. ${PROBLEM}**`)
  expect(written[0]).toContain('Purchasing runs on email.\n\n[image: invoice flow]\n')
  expect(written[0]).toContain(`**2. ${DEADLINE}**\n_If so, what happens when it is missed?_\n\n- [x] Yes\n- [ ] No\n`)
  expect(get('export-menu').text()).toBe('Copied')
  expect(app.find('[role="menu"]').exists()).toBe(false)
})

test('Copy blank Markdown leaves the answers out', async () => {
  const written = clipboard()
  await choose('Copy blank Markdown')

  expect(written[0]).toContain('_______\n_______\n_______\n')
  expect(written[0]).toContain('- [ ] Yes\n- [ ] No\n')
  expect(written[0]).not.toContain('Purchasing')
})

test('Download Markdown saves a .md file named after the Questionnaire, blank or with answers', async () => {
  const saved: { name: string; blob: Blob }[] = []
  const createObjectURL = URL.createObjectURL
  URL.createObjectURL = (blob: Blob) => (saved.push({ name: '', blob }), 'blob:x')
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    saved.at(-1)!.name = this.download
  }
  try {
    await choose('Download Markdown')
    await choose('Download blank Markdown')
  } finally {
    URL.createObjectURL = createObjectURL
    HTMLAnchorElement.prototype.click = click
  }

  expect(saved.map((s) => s.name)).toEqual(['Coupa rollout intake.md', 'Coupa rollout intake (blank).md'])
  const [answered, blank] = await Promise.all(saved.map((s) => s.blob.text()))
  expect(answered).toContain(HEAD)
  expect(answered).toContain('- [x] Yes')
  expect(blank).toContain('- [ ] Yes\n- [ ] No')
})

test('Copy as email text puts the plain, numbered questions and a reply hint on the clipboard', async () => {
  const written = clipboard()
  await choose('Copy as email text')

  expect(written).toHaveLength(1)
  expect(written[0].startsWith(`Coupa rollout intake\nProject: Coupa rollout\nRespondents: Mara Stan\nDate: ${today()}\n`)).toBe(true)
  expect(written[0]).toContain(`1. ${PROBLEM}\n`)
  expect(written[0]).toContain(`2. ${DEADLINE}\n   If so, what happens when it is missed?\n   - Yes\n   - No\n`)
  expect(written[0].endsWith('Please reply inline: write your answer under each question.\n')).toBe(true)
  expect(written[0]).not.toContain('Purchasing')
})

test('when the clipboard refuses, the text is shown, selected, to copy by hand', async () => {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'))
  await choose('Copy as email text')

  const area = get('export-copy-dialog').get('textarea').element as HTMLTextAreaElement
  expect(area.value.startsWith('Coupa rollout intake\n')).toBe(true)
  expect(document.activeElement).toBe(area)
  await get('export-copy-dialog').trigger('keydown', { key: 'Escape' })
  expect(app.find('[data-testid="export-copy-dialog"]').exists()).toBe(false)
})

test('Print / Save as PDF puts the print view with the answers and Images in the page, then prints', async () => {
  const print = stubPrint()
  await choose('Print / Save as PDF')

  expect(print).toHaveBeenCalledOnce()
  const view = document.querySelector('[data-testid="questionnaire-print"]')!
  expect(view.querySelector('h1')!.textContent).toBe('Coupa rollout intake')
  expect([...view.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['Coupa rollout', 'Mara Stan', today()])
  expect(view.querySelector('img[data-image]')!.getAttribute('src')).toMatch(/^blob:/)
  expect([...view.querySelectorAll('.print-boxes li')].map((l) => l.textContent!.trim())).toEqual(['☑ Yes', '☐ No'])

  // Once the browser is done printing, the view goes.
  window.dispatchEvent(new Event('afterprint'))
  await flushPromises()
  expect(document.querySelector('[data-testid="questionnaire-print"]')).toBeNull()
})

test('Print blank form prints the questions without the answers', async () => {
  const print = stubPrint()
  await choose('Print blank form')

  expect(print).toHaveBeenCalledOnce()
  const view = document.querySelector('[data-testid="questionnaire-print"]')!
  expect(view.textContent).not.toContain('Purchasing')
  expect(view.querySelectorAll('.print-line')).toHaveLength(3)
  expect([...view.querySelectorAll('.print-boxes li')].map((l) => l.textContent!.trim())).toEqual(['☐ Yes', '☐ No'])
})

test('the Export menu works from the keyboard: arrows move, Escape closes and gives the focus back', async () => {
  await get('export-menu').trigger('click')
  expect(document.activeElement!.textContent!.trim()).toBe('Copy as Markdown')
  await app.get('[role="menu"]').trigger('keydown', { key: 'ArrowUp' })
  expect(document.activeElement!.textContent!.trim()).toBe('Print blank form')
  await app.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
  expect(app.find('[role="menu"]').exists()).toBe(false)
  expect(document.activeElement).toBe(get('export-menu').element)
})
