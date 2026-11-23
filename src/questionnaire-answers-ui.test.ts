import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.vue'
import { imageInfo } from './images'
import { mentionedIn } from './mentions'
import { openRecord } from './navigation'
import { closeNotebook, db, openNotebook } from './notebook'
import { addQuestions, listItems, listQuestions, setAnswer } from './questionnaires'
import { createRecord, deleteRecord, updateRecord, type RecordRef } from './records'
import { memoryFolder, memoryStorage } from './storage-memory'
import { undoDelete } from './undo-delete'

// Seam 1: Images and Mentions in a Questionnaire's answers behave as they do in notes.
// Decoding and shrinking need a real browser's canvas: here every file comes out as a 40 × 30 WebP of 5 bytes.
vi.mock('./image-file', () => ({
  prepareImage: async () => ({ mime: 'image/webp', width: 40, height: 30, data: new Uint8Array(5) }),
}))

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

const PROBLEM = 'What problem does this project solve?'
const VPN = 'Does it need VPN or remote access?'
const bank = (...texts: string[]) => texts.map((t) => listQuestions().find((q) => q.text === t)!.id)
const open = async (r: RecordRef) => {
  openRecord(r.type, r.id)
  await flushPromises()
}
const item = (text: string) => app.findAll('[data-testid="questionnaire-item"]').find((i) => i.get('[data-testid="item-text"]').text() === text)!
const answers = (id: number) => listItems(id).map((i) => i.answer)

async function paste(area: HTMLTextAreaElement) {
  area.setSelectionRange(area.value.length, area.value.length)
  const event = new Event('paste', { bubbles: true, cancelable: true })
  const files = [new File(['x'], 'image.png', { type: 'image/png' })]
  Object.assign(event, { clipboardData: { getData: () => '', files, types: ['Files'] } })
  area.dispatchEvent(event)
  await flushPromises()
}

// Saves nothing to disk: opens the Notebook as it is now, as a fresh start of the app would, collecting unused Images.
async function reopen() {
  await openNotebook(memoryFolder(db.value!.export()))
  await flushPromises()
}

async function answerWithImages(): Promise<RecordRef> {
  const intake: RecordRef = { type: 'questionnaire', id: createRecord('questionnaire', 'Coupa rollout intake') }
  const [, vpn] = addQuestions(intake.id, bank(PROBLEM, VPN))
  setAnswer(vpn, { yes: true })
  await open(intake)
  const long = item(PROBLEM).get(`textarea[aria-label="Answer to ${PROBLEM}"]`)
  await long.setValue('Slow invoices: ')
  await paste(long.element as HTMLTextAreaElement)
  const comment = item(VPN).get(`textarea[aria-label="Comment on ${VPN}"]`)
  await comment.setValue('Lyon only ')
  await paste(comment.element as HTMLTextAreaElement)
  return intake
}

test('an Image pasted into a long text answer or a Yes/No comment belongs to the Questionnaire and survives reopening the Notebook', async () => {
  const intake = await answerWithImages()
  expect(answers(intake.id)).toEqual([{ text: 'Slow invoices: ![screenshot](image:1)' }, { yes: true, comment: 'Lyon only ![screenshot](image:2)' }])
  expect(imageInfo(1)).toMatchObject({ owner_type: 'questionnaire', owner_id: intake.id })

  await reopen()
  await open(intake)

  expect(imageInfo(1)).not.toBeNull()
  expect(imageInfo(2)).not.toBeNull()
  expect(item(PROBLEM).find('img[data-image="1"]').exists()).toBe(true)
  expect(item(VPN).find('img[data-image="2"]').exists()).toBe(true)
})

test("removing an Item and undoing it, or deleting the Questionnaire and undoing that, keeps the answers' Images", async () => {
  const intake = await answerWithImages()

  await item(PROBLEM).get('[data-testid="item-remove"]').trigger('click')
  await app.get('[data-testid="undo-remove"]').trigger('click')
  deleteRecord('questionnaire', intake.id)
  undoDelete()
  await reopen()
  await open(intake)

  expect(item(PROBLEM).find('img[data-image="1"]').exists()).toBe(true)
  expect(item(VPN).find('img[data-image="2"]').exists()).toBe(true)
})

test('an Image in the answer of a removed Item goes when the Notebook is next opened', async () => {
  await answerWithImages()

  await item(PROBLEM).get('[data-testid="item-remove"]').trigger('click')
  await reopen()

  expect(imageInfo(1)).toBeNull()
  expect(imageInfo(2)).not.toBeNull()
})

test('a Mention in an answer counts in "Mentioned in" and follows a rename of the Record it mentions', async () => {
  const coupa: RecordRef = { type: 'system', id: createRecord('system', 'Coupa') }
  const intake: RecordRef = { type: 'questionnaire', id: createRecord('questionnaire', 'Coupa rollout intake') }
  const [problem, vpn] = addQuestions(intake.id, bank(PROBLEM, VPN))
  setAnswer(problem, { text: 'Invoices in [[Coupa]] are slow' })
  setAnswer(vpn, { yes: false, comment: 'Not for [[Coupa]], it is "SaaS"' })

  expect(mentionedIn(coupa).map((r) => r.title)).toEqual(['Coupa rollout intake'])
  await open(coupa)
  expect(app.findAll('[data-testid="mentioned-in"]').map((r) => r.text())).toEqual(['Coupa rollout intake'])

  updateRecord('system', coupa.id, { title: 'Coupa "P2P"' })

  expect(answers(intake.id)).toEqual([
    { text: 'Invoices in [[Coupa "P2P"]] are slow' },
    { yes: false, comment: 'Not for [[Coupa "P2P"]], it is "SaaS"' },
  ])
  expect(mentionedIn(coupa).map((r) => r.title)).toEqual(['Coupa rollout intake'])
})
