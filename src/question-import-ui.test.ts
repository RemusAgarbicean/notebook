import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { closeNotebook } from './notebook'
import { getQuestion, listQuestions, listSets } from './questionnaires'
import { memoryFolder, memoryStorage } from './storage-memory'

let app: VueWrapper
let folder: ReturnType<typeof memoryFolder>

beforeEach(async () => {
  closeNotebook()
  folder = memoryFolder()
  app = mount(App, {
    props: { storage: memoryStorage(async () => folder) },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
})
afterEach(() => app.unmount())

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const all = (id: string) => app.findAll(`[data-testid="${id}"]`)
const cells = () => all('question-import-row').map((r) => r.findAll('td').map((c) => c.text()))
const STARTERS = 42

const paste = async (text: string) => {
  await get('open-question-bank').trigger('click')
  await flushPromises()
  await get('bank-import').trigger('click')
  await get('question-import-text').setValue(text)
}
const save = async () => {
  await get('question-import-save').trigger('click')
  await expect.poll(() => app.find('[data-testid="question-import-dialog"]').exists()).toBe(false)
}
const imported = () => listQuestions().slice(STARTERS)

const TABLE = [
  'Question\tType\tOptions\tCategory',
  'Which region?\tchoice\tEU | US\tHosting',
  'Is there a DR site?\tyes/no\t\t',
  'Which tier?\tdropdown\tgold\tHosting',
  'Which access level is needed?\tchoice\tRead|Write\t',
].join('\n')

test('the preview shows each row with its type, its problem or that it is a duplicate, and only new rows are imported', async () => {
  await paste(TABLE)

  expect(cells()).toEqual([
    ['New', 'Which region?', 'Single choice', 'EU, US', 'Hosting'],
    ['New', 'Is there a DR site?', 'Yes/No', '', 'Imported'],
    ['Skipped: Unknown type "dropdown"', 'Which tier?', 'Short text', '', 'Hosting'],
    ['Duplicate: skipped', 'Which access level is needed?', 'Single choice', 'Read, Write', 'Imported'],
  ])
  expect(all('question-import-row')[2].classes()).toContain('text-destructive')
  expect(get('question-import-save').text()).toBe('Import 2 Questions')
  await save()

  expect(imported().map((q) => [q.text, q.answerType, q.options, q.category])).toEqual([
    ['Which region?', 'single_choice', ['EU', 'US'], 'Hosting'],
    ['Is there a DR site?', 'yes_no', [], 'Imported'],
  ])
  // The bank dialog stays open and shows them.
  expect(all('bank-category-name').map((c) => c.text())).toEqual(expect.arrayContaining(['Hosting', 'Imported']))
  expect([...folder.backups.keys()]).toEqual([expect.stringMatching(/^notebook-.*-question-import\.sqlite$/)])
})

test('rows without a category go to the category chosen for them', async () => {
  await paste('question\nWho signs off?')
  await get('question-import-category').setValue('Approvals')
  expect(cells()[0].at(-1)).toBe('Approvals')
  await save()
  expect(imported().map((q) => q.category)).toEqual(['Approvals'])
})

test('a table without a question column says so and imports nothing', async () => {
  await paste('Title,Type\nWho signs off?,text')
  expect(get('question-import-problem').text()).toBe('There is no "question" column.')
  expect(get('question-import-save').attributes('disabled')).toBeDefined()
})

test('the imported Questions, duplicates included, can go into a new Question set', async () => {
  await paste(TABLE)
  await get('question-import-set').setValue('new')
  await get('question-import-set-name').setValue('Hosting intake')
  await save()

  const set = listSets().find((s) => s.name === 'Hosting intake')!
  expect(set.questionIds.map((id) => getQuestion(id)!.text)).toEqual([
    'Which region?',
    'Is there a DR site?',
    'Which access level is needed?',
  ])
})

test('the imported Questions can be added to the end of an existing Question set', async () => {
  const [first] = listSets()
  const before = first.questionIds
  await paste('question\nWho signs off?')
  await get('question-import-set').setValue(String(first.id))
  await save()

  const after = listSets().find((s) => s.id === first.id)!.questionIds
  expect(after.slice(0, -1)).toEqual(before)
  expect(getQuestion(after.at(-1)!)!.text).toBe('Who signs off?')
})

test('a new set needs a name', async () => {
  await paste('question\nWho signs off?')
  await get('question-import-set').setValue('new')
  expect(get('question-import-save').attributes('disabled')).toBeDefined()
})

test('the example CSV downloads from the dialog', async () => {
  const saved: { name: string; blob: Blob }[] = []
  const createObjectURL = URL.createObjectURL
  URL.createObjectURL = (blob: Blob) => (saved.push({ name: '', blob }), 'blob:x')
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    saved.at(-1)!.name = this.download
  }
  try {
    await get('open-question-bank').trigger('click')
    await flushPromises()
    await get('bank-import').trigger('click')
    await get('question-import-example').trigger('click')
  } finally {
    URL.createObjectURL = createObjectURL
    HTMLAnchorElement.prototype.click = click
  }

  expect(saved.map((s) => s.name)).toEqual(['questions-example.csv'])
  const text = new TextDecoder().decode(await saved[0].blob.arrayBuffer())
  expect(text.split('\r\n')[0]).toBe('question,type,options,category,help')
})

test('nothing is imported when the Backup cannot be taken', async () => {
  folder.writeBackup = async () => {
    throw new Error('disk full')
  }
  await paste('question\nWho signs off?')
  await get('question-import-save').trigger('click')
  await expect.poll(() => app.find('[data-testid="question-import-error"]').exists()).toBe(true)
  expect(get('question-import-error').text()).toContain('disk full')
  expect(imported()).toEqual([])
})

test('a CSV file can be picked instead of pasting', async () => {
  await get('open-question-bank').trigger('click')
  await flushPromises()
  await get('bank-import').trigger('click')
  const input = get('question-import-file')
  const file = new File(['question,type\r\nWho signs off?,text\r\n'], 'q.csv', { type: 'text/csv' })
  Object.defineProperty(input.element, 'files', { value: [file] })
  await input.trigger('change')
  await expect.poll(() => cells().length).toBe(1)
  expect(cells()[0][1]).toBe('Who signs off?')
})
