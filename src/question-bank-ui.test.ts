import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { addNewItem, addQuestions, listItems, listQuestions, listSets } from './questionnaires'
import { createRecord } from './records'
import { memoryFolder, memoryStorage } from './storage-memory'

let app: VueWrapper

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
})
afterEach(() => app.unmount())

const get = (id: string) => app.get(`[data-testid="${id}"]`)
const all = (id: string) => app.findAll(`[data-testid="${id}"]`)
const texts = (id: string) => all(id).map((e) => e.text())

const openBank = async () => {
  await get('open-question-bank').trigger('click')
  await flushPromises()
}

test('the sidebar opens the Question bank, which lists every Question grouped by category', async () => {
  await openBank()

  expect(get('question-bank-dialog').attributes('role')).toBe('dialog')
  expect(texts('bank-category-name')).toEqual([
    'Goals and scope',
    'Stakeholders',
    'Requirements',
    'Access',
    'Dependencies',
    'Data',
    'Timeline and budget',
    'Risks',
    'Non-functional',
  ])
  expect(all('bank-question')).toHaveLength(42)
  const access = all('bank-group')[3]
  expect(access.findAll('[data-testid="bank-question-text"]').map((q) => q.text())).toEqual([
    'Who needs access, and to which systems?',
    'Which access level is needed?',
    'Does it need VPN or remote access?',
    'Are service accounts or API keys needed?',
    'Who approves the access?',
    'Until when is the access needed?',
  ])
  expect(access.findAll('[data-testid="bank-question-type"]').map((q) => q.text())).toEqual([
    'Long text',
    'Single choice',
    'Yes/No',
    'Yes/No',
    'Short text',
    'Date',
  ])

  await get('close-question-bank').trigger('click')
  expect(app.find('[data-testid="question-bank-dialog"]').exists()).toBe(false)
})

test('search and the category filter narrow the list', async () => {
  await openBank()

  await get('bank-search').setValue('access')
  expect(texts('bank-question-text')).toEqual([
    'Who needs access, and to which systems?',
    'Which access level is needed?',
    'Does it need VPN or remote access?',
    'Who approves the access?',
    'Until when is the access needed?',
  ])

  await get('bank-search').setValue('')
  await get('bank-category').setValue('Risks')
  expect(texts('bank-category-name')).toEqual(['Risks'])
  expect(texts('bank-question-text')).toEqual(listQuestions({ category: 'Risks' }).map((q) => q.text))

  await get('bank-search').setValue('nothing like this')
  expect(all('bank-question')).toHaveLength(0)
  expect(get('bank-empty').text()).toBe('No Questions match.')
})

const question = (text: string) => listQuestions().find((q) => q.text === text)
const row = (text: string) => all('bank-question').find((q) => q.get('[data-testid="bank-question-text"]').text() === text)!

test('New question adds a Question with every field to the end of the bank, in its category', async () => {
  await openBank()
  await get('bank-new-question').trigger('click')

  expect(app.find('[data-testid="question-options"]').exists()).toBe(false)
  await get('question-text').setValue('  Which regions roll out first?  ')
  await get('question-help').setValue('The first wave only.')
  await get('question-type').setValue('multi_choice')
  await get('question-options').setValue('EMEA\nAPAC\n\nAmericas\nEMEA')
  await get('question-allow-other').setValue(true)
  await get('question-category').setValue('Rollout')
  await get('question-form').trigger('submit')

  expect(question('Which regions roll out first?')).toMatchObject({
    help: 'The first wave only.',
    answerType: 'multi_choice',
    options: ['EMEA', 'APAC', 'Americas'],
    allowOther: true,
    category: 'Rollout',
  })
  expect(app.find('[data-testid="question-form"]').exists()).toBe(false)
  expect(texts('bank-category-name').at(-1)).toBe('Rollout')
  expect(all('bank-group').at(-1)!.findAll('[data-testid="bank-question-text"]').map((q) => q.text())).toEqual([
    'Which regions roll out first?',
  ])
})

test('the editor shows the unit for a number and the end labels for a scale', async () => {
  await openBank()
  await get('bank-new-question').trigger('click')
  await get('question-text').setValue('How many sites?')
  await get('question-type').setValue('number')
  expect(app.find('[data-testid="question-scale-low"]').exists()).toBe(false)
  await get('question-unit').setValue('sites')
  await get('question-category').setValue('Non-functional')
  await get('question-form').trigger('submit')
  expect(question('How many sites?')).toMatchObject({ answerType: 'number', unit: 'sites', category: 'Non-functional' })

  await get('bank-new-question').trigger('click')
  await get('question-text').setValue('How urgent is it?')
  await get('question-type').setValue('scale')
  expect(app.find('[data-testid="question-unit"]').exists()).toBe(false)
  await get('question-scale-low').setValue('Can wait')
  await get('question-scale-high').setValue('Today')
  await get('question-form').trigger('submit')
  expect(question('How urgent is it?')).toMatchObject({ answerType: 'scale', scaleLow: 'Can wait', scaleHigh: 'Today', category: '' })
  expect(texts('bank-category-name').at(-1)).toBe('No category')
})

test('a Question that does not validate stays in the editor with the reason', async () => {
  await openBank()
  await get('bank-new-question').trigger('click')
  await get('question-text').setValue('Which tool?')
  await get('question-type').setValue('single_choice')
  await get('question-form').trigger('submit')

  expect(get('question-error').text()).toBe('A choice question needs at least one option')
  expect(question('Which tool?')).toBeUndefined()

  await get('question-cancel').trigger('click')
  expect(app.find('[data-testid="question-form"]').exists()).toBe(false)
})

test('Edit opens a Question in the editor, and saving changes it in the bank', async () => {
  await openBank()
  await row('How sensitive is the data?').get('[data-testid="bank-question-edit"]').trigger('click')

  expect((get('question-text').element as HTMLInputElement).value).toBe('How sensitive is the data?')
  expect((get('question-type').element as HTMLSelectElement).value).toBe('single_choice')
  expect((get('question-options').element as HTMLTextAreaElement).value).toBe('Public\nInternal\nConfidential\nSecret')
  expect((get('question-category').element as HTMLInputElement).value).toBe('Data')

  await get('question-text').setValue('How sensitive is the data, at most?')
  await get('question-options').setValue('Public\nInternal\nConfidential')
  await get('question-form').trigger('submit')

  expect(question('How sensitive is the data, at most?')).toMatchObject({ options: ['Public', 'Internal', 'Confidential'], category: 'Data' })
  expect(question('How sensitive is the data?')).toBeUndefined()
  expect(row('How sensitive is the data, at most?').exists()).toBe(true)
})

test('Delete asks first, then takes the Question out of the bank and its sets, and Items keep their copy', async () => {
  const intake = createRecord('questionnaire', 'Coupa intake')
  addQuestions(intake, [question('Who approves the access?')!.id])
  const access = listSets().find((s) => s.name === 'Access request')!
  expect(access.questionIds).toHaveLength(6)
  await openBank()

  await row('Who approves the access?').get('[data-testid="bank-question-delete"]').trigger('click')
  await get('dialog-cancel').trigger('click')
  expect(question('Who approves the access?')).toBeDefined()

  await row('Who approves the access?').get('[data-testid="bank-question-delete"]').trigger('click')
  await get('dialog-confirm').trigger('submit')

  expect(question('Who approves the access?')).toBeUndefined()
  expect(all('bank-question')).toHaveLength(41)
  expect(listSets().find((s) => s.name === 'Access request')!.questionIds).toHaveLength(5)
  expect(listItems(intake).map((i) => i.text)).toEqual(['Who approves the access?'])
})

test('renaming a category renames it on all its Questions, and a taken name merges the two', async () => {
  await openBank()

  const risks = all('bank-group')[7]
  await risks.get('[data-testid="bank-rename-category"]').trigger('click')
  await get('bank-category-input').setValue('Risks and impact')
  await get('bank-category-input').trigger('keydown', { key: 'Enter' })

  expect(texts('bank-category-name')[7]).toBe('Risks and impact')
  expect(listQuestions({ category: 'Risks and impact' })).toHaveLength(4)
  expect(listQuestions({ category: 'Risks' })).toHaveLength(0)

  await all('bank-group')[1].get('[data-testid="bank-rename-category"]').trigger('click')
  await get('bank-category-input').setValue('Goals and scope')
  await get('bank-category-input').trigger('keydown', { key: 'Enter' })

  expect(texts('bank-category-name')).not.toContain('Stakeholders')
  expect(listQuestions({ category: 'Goals and scope' })).toHaveLength(9)
})

test('Esc leaves a category rename without renaming', async () => {
  await openBank()
  await all('bank-group')[0].get('[data-testid="bank-rename-category"]').trigger('click')
  await get('bank-category-input').setValue('Goals')
  await get('bank-category-input').trigger('keydown', { key: 'Escape' })

  expect(texts('bank-category-name')[0]).toBe('Goals and scope')
  expect(app.find('[data-testid="question-bank-dialog"]').exists()).toBe(true)
})

const openSets = async () => {
  await openBank()
  const tab = app.findAll('[data-testid="question-bank-tabs"] [role="tab"]').find((t) => t.text() === 'Sets')!
  await tab.trigger('mousedown', { button: 0 })
  await flushPromises()
}
const setRow = (name: string) => all('bank-set').find((s) => s.get('[data-testid="bank-set-name"]').text() === name)!
const choose = async (name: string) => {
  await setRow(name).get('[data-testid="bank-set-name"]').trigger('click')
}
const setNames = () => listSets().map((s) => s.name)
const members = () => texts('set-question-text')

test('the Sets tab lists the Question sets with their sizes, and shows a chosen one\'s Questions in order', async () => {
  await openSets()

  expect(texts('bank-set-name')).toEqual(['New project intake', 'Access request', 'Integration / dependency check'])
  expect(texts('bank-set-count')).toEqual(['16', '6', '8'])

  await choose('Access request')
  expect((get('set-name').element as HTMLInputElement).value).toBe('Access request')
  expect(members()).toEqual([
    'Who needs access, and to which systems?',
    'Which access level is needed?',
    'Does it need VPN or remote access?',
    'Are service accounts or API keys needed?',
    'Who approves the access?',
    'Until when is the access needed?',
  ])
})

test('a new set starts empty and takes Questions from the bank, each once', async () => {
  await openSets()
  await get('new-set-name').setValue('Go-live check')
  await get('new-set-form').trigger('submit')

  expect(setNames()).toEqual(['New project intake', 'Access request', 'Integration / dependency check', 'Go-live check'])
  expect((get('set-name').element as HTMLInputElement).value).toBe('Go-live check')
  expect(get('set-empty').text()).toBe('No Questions in this set yet.')

  const add = get('set-add-question')
  const option = (text: string) => add.findAll('option').find((o) => o.text() === text)!.element as HTMLOptionElement
  await add.setValue(String(question('Target go-live date')!.id))
  await add.setValue(String(question('Is there a hard deadline?')!.id))

  expect(members()).toEqual(['Target go-live date', 'Is there a hard deadline?'])
  expect(listSets().at(-1)!.questionIds).toEqual([question('Target go-live date')!.id, question('Is there a hard deadline?')!.id])
  expect(option('How many users?')).toBeDefined()
  expect(add.findAll('option').map((o) => o.text())).not.toContain('Target go-live date')
  expect((add.element as HTMLSelectElement).value).toBe('')
})

test('a blank set name is refused with the reason', async () => {
  await openSets()
  await get('new-set-name').setValue('  ')
  await get('new-set-form').trigger('submit')

  expect(get('sets-error').text()).toBe('A Question set needs a name')
  expect(setNames()).toHaveLength(3)
})

test('a set is renamed, reordered within the list, and deleted after asking', async () => {
  await openSets()
  await choose('Access request')

  await get('set-name').setValue('Access request (short)')
  await get('set-name').trigger('change')
  expect(setNames()[1]).toBe('Access request (short)')

  await setRow('Access request (short)').get('[data-testid="set-move-up"]').trigger('click')
  expect(setNames()).toEqual(['Access request (short)', 'New project intake', 'Integration / dependency check'])
  await setRow('New project intake').get('[data-testid="set-move-down"]').trigger('click')
  expect(setNames()).toEqual(['Access request (short)', 'Integration / dependency check', 'New project intake'])
  expect(texts('bank-set-name')).toEqual(setNames())

  await setRow('Access request (short)').get('[data-testid="set-delete"]').trigger('click')
  await get('dialog-confirm').trigger('submit')
  expect(setNames()).toEqual(['Integration / dependency check', 'New project intake'])
  expect(app.find('[data-testid="set-name"]').exists()).toBe(false)
  expect(question('Who approves the access?')).toBeDefined()
})

test('Save Items as a set, on a Questionnaire, saves its Items in order as a new set named as asked', async () => {
  const intake = createRecord('questionnaire', 'Coupa intake')
  openRecord('questionnaire', intake)
  await flushPromises()
  expect(get('save-items-as-set').attributes('disabled')).toBeDefined()

  addQuestions(intake, [question('How many users?')!.id, question('Target go-live date')!.id])
  addNewItem(intake, { text: 'Which plants go first?' })
  await flushPromises()

  await get('save-items-as-set').trigger('click')
  expect((get('set-name-input').element as HTMLInputElement).value).toBe('Coupa intake')
  await get('dialog-cancel').trigger('click')
  expect(setNames()).toHaveLength(3)

  await get('save-items-as-set').trigger('click')
  await get('set-name-input').setValue('Rollout intake')
  await get('dialog-confirm').trigger('submit')

  const saved = listSets().at(-1)!
  expect(saved.name).toBe('Rollout intake')
  expect(saved.questionIds.map((id) => listQuestions().find((q) => q.id === id)!.text)).toEqual([
    'How many users?',
    'Target go-live date',
    'Which plants go first?',
  ])
  expect(get('saved-as-set').text()).toBe('Saved as the Question set “Rollout intake”.')
  expect(app.find('[data-testid="set-name-input"]').exists()).toBe(false)
})

test('Save Items as a set refuses a blank name and keeps the dialog open', async () => {
  const intake = createRecord('questionnaire', 'Coupa intake')
  addQuestions(intake, [question('How many users?')!.id])
  openRecord('questionnaire', intake)
  await flushPromises()

  await get('save-items-as-set').trigger('click')
  await get('set-name-input').setValue(' ')
  await get('dialog-confirm').trigger('submit')

  expect(get('save-set-error').text()).toBe('A Question set needs a name')
  expect(setNames()).toHaveLength(3)
})

test("a set's Questions move up and down and come out of it", async () => {
  await openSets()
  await choose('Access request')
  const item = (text: string) => all('set-question').find((q) => q.get('[data-testid="set-question-text"]').text() === text)!

  await item('Who approves the access?').get('[data-testid="set-question-up"]').trigger('click')
  await item('Who needs access, and to which systems?').get('[data-testid="set-question-down"]').trigger('click')
  await item('Until when is the access needed?').get('[data-testid="set-question-remove"]').trigger('click')

  expect(members()).toEqual([
    'Which access level is needed?',
    'Who needs access, and to which systems?',
    'Does it need VPN or remote access?',
    'Who approves the access?',
    'Are service accounts or API keys needed?',
  ])
  expect(listSets()[1].questionIds).toHaveLength(5)
  expect(question('Until when is the access needed?')).toBeDefined()
})
