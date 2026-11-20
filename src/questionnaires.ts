import { db } from './notebook'
import { registerChildren, type ChildText } from './record-children'
import type { RecordType } from './record-types'
import { changed, createRecord, foldTitle, getRecord, rows, textRows, transaction, type Titled, type Value } from './records'
import { LABEL, slotsOf } from './relation-slots'
import { addRelation, slotRecords } from './relations'

// The questionnaire domain: every read and write of the Items, the Question bank and the Question sets.
// Components never write these tables themselves. An Item keeps its own copy of a Question's wording,
// so editing or deleting a bank Question never changes a Questionnaire; `questionId` only remembers the origin.

export type AnswerType = 'short_text' | 'long_text' | 'yes_no' | 'single_choice' | 'multi_choice' | 'number' | 'date' | 'scale'

/** Every Answer type, in the order a type picker offers them, with its name for the user. */
export const ANSWER_TYPES: readonly { type: AnswerType; label: string }[] = [
  { type: 'short_text', label: 'Short text' },
  { type: 'long_text', label: 'Long text' },
  { type: 'yes_no', label: 'Yes/No' },
  { type: 'single_choice', label: 'Single choice' },
  { type: 'multi_choice', label: 'Multiple choice' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'scale', label: 'Scale 1–5' },
]

/** Whether an Answer type picks from options. */
export const isChoice = (type: AnswerType) => type === 'single_choice' || type === 'multi_choice'

/** An Item's answer. Its shape follows the Item's Answer type; "Other" on a single choice is `choice: ''` plus `other`. */
export type Answer =
  | { text: string } // short_text, long_text
  | { yes: boolean; comment?: string } // yes_no
  | { choice: string; other?: string } // single_choice
  | { choices: readonly string[]; other?: string } // multi_choice
  | { number: number } // number
  | { date: string } // date, YYYY-MM-DD
  | { scale: 1 | 2 | 3 | 4 | 5 } // scale

/** What a bank Question and an Item share: the wording and how it is answered. */
export type Wording = {
  text: string
  /** Help text under the question; '' for none. */
  help: string
  answerType: AnswerType
  /** The choices of a single or multiple choice; empty for the other types. */
  options: string[]
  /** Whether a choice also takes a free-text "Other". */
  allowOther: boolean
  /** Shown next to a number answer (users, €, GB). */
  unit: string | null
  /** The labels at the ends of a scale. */
  scaleLow: string | null
  scaleHigh: string | null
}

/** A Question for `createQuestion` or a new Item: only the text is needed; the type defaults to short text. */
export type QuestionDraft = Partial<Wording> & { text: string; category?: string }

export type Question = Wording & { id: number; category: string; position: number }

export type Item = Wording & {
  id: number
  questionnaireId: number
  position: number
  /** The bank Question it was added from, null for one written on the Questionnaire. Never read for wording. */
  questionId: number | null
  /** The section heading it sits under; '' for none. */
  section: string
  answer: Answer | null
  /** The Open question it was followed up with. */
  followUpId: number | null
}

/** What `updateItem` may change. */
export type ItemPatch = Partial<Wording> & { section?: string }

export type QuestionSet = { id: number; name: string; position: number; questionIds: number[] }

// ---- Rows

type WordingRow = {
  text: string
  help: string
  answer_type: AnswerType
  options: string
  allow_other: number
  unit: string | null
  scale_low: string | null
  scale_high: string | null
}
type QuestionRow = WordingRow & { id: number; category: string; position: number }
type ItemRow = WordingRow & {
  id: number
  questionnaire_id: number
  position: number
  question_id: number | null
  section: string
  answer: string | null
  follow_up_id: number | null
  /** 1 once a text Item took its follow-up's answer. */
  follow_up_taken: number
}

const WORDING_COLUMNS = ['text', 'help', 'answer_type', 'options', 'allow_other', 'unit', 'scale_low', 'scale_high'] as const

const wordingOf = (r: WordingRow): Wording => ({
  text: r.text,
  help: r.help,
  answerType: r.answer_type,
  options: JSON.parse(r.options),
  allowOther: !!r.allow_other,
  unit: r.unit,
  scaleLow: r.scale_low,
  scaleHigh: r.scale_high,
})
const toQuestion = (r: QuestionRow): Question => ({ id: r.id, ...wordingOf(r), category: r.category, position: r.position })
const toItem = (r: ItemRow): Item => ({
  id: r.id,
  questionnaireId: r.questionnaire_id,
  position: r.position,
  questionId: r.question_id,
  section: r.section,
  ...wordingOf(r),
  answer: r.answer === null ? null : JSON.parse(r.answer),
  followUpId: r.follow_up_id,
})
const wordingValues = (w: Wording): Value[] => [
  w.text,
  w.help,
  w.answerType,
  JSON.stringify(w.options),
  w.allowOther ? 1 : 0,
  w.unit,
  w.scaleLow,
  w.scaleHigh,
]

const blank = (s: string | null | undefined) => (s ?? '').trim() || null

/** Checks and tidies a wording. Throws with a message fit for the user. */
function clean(w: Wording): Wording {
  const text = w.text.trim()
  if (!text) throw new Error('The question needs a text')
  if (!ANSWER_TYPES.some((t) => t.type === w.answerType)) throw new Error(`Unknown Answer type: ${w.answerType}`)
  const choice = isChoice(w.answerType)
  const options = choice ? [...new Set(w.options.map((o) => o.trim()).filter(Boolean))] : []
  if (choice && !options.length) throw new Error('A choice question needs at least one option')
  return {
    text,
    help: w.help.trim(),
    answerType: w.answerType,
    options,
    allowOther: choice && w.allowOther,
    unit: w.answerType === 'number' ? blank(w.unit) : null,
    scaleLow: w.answerType === 'scale' ? blank(w.scaleLow) : null,
    scaleHigh: w.answerType === 'scale' ? blank(w.scaleHigh) : null,
  }
}

const draftWording = (d: QuestionDraft): Wording => ({
  text: d.text,
  help: d.help ?? '',
  answerType: d.answerType ?? 'short_text',
  options: d.options ?? [],
  allowOther: d.allowOther ?? false,
  unit: d.unit ?? null,
  scaleLow: d.scaleLow ?? null,
  scaleHigh: d.scaleHigh ?? null,
})

const now = () => new Date().toISOString()
const run = (sql: string, params: Value[] = []) => db.value!.run(sql, params)
const lastId = () => db.value!.exec('select last_insert_rowid()')[0].values[0][0] as number

// Every write to a Questionnaire's Items bumps its updated_at, so Recently edited, search and saving see it.
const touch = (questionnaireId: number) => run('update questionnaire set updated_at = ? where id = ?', [now(), questionnaireId])

// ---- The Question bank

/** The bank's Questions in bank order; `search` narrows to those whose text or help contains it, `category` to one category. Reactive. */
export function listQuestions({ search = '', category }: { search?: string; category?: string } = {}): Question[] {
  const needle = foldTitle(search)
  return rows<QuestionRow>('select * from question order by position, id')
    .map(toQuestion)
    .filter((q) => (category === undefined || q.category === category) && (!needle || foldTitle(`${q.text}\n${q.help}`).includes(needle)))
}

export const getQuestion = (id: number): Question | null => {
  const [r] = rows<QuestionRow>('select * from question where id = ?', [id])
  return r ? toQuestion(r) : null
}

/** The categories in use, in bank order (the order of each one's first Question). Reactive. */
export const questionCategories = (): string[] =>
  rows<{ category: string }>('select category from question group by category order by min(position), min(id)').map((r) => r.category)

/** Adds a Question at the end of the bank and returns its id. */
export function createQuestion(draft: QuestionDraft): number {
  const w = clean(draftWording(draft))
  run(
    `insert into question (${WORDING_COLUMNS.join(', ')}, category, position)
     values (${WORDING_COLUMNS.map(() => '?').join(', ')}, ?, (select coalesce(max(position), 0) + 1 from question))`,
    [...wordingValues(w), (draft.category ?? '').trim()],
  )
  const id = lastId()
  changed('keep-titles')
  return id
}

/** Saves the given parts of a Question. Items made from it keep their wording. */
export function updateQuestion(id: number, patch: Partial<QuestionDraft>) {
  const q = getQuestion(id)
  if (!q) throw new Error('That Question no longer exists')
  const w = clean({ ...q, ...patch })
  run(
    `update question set ${WORDING_COLUMNS.map((c) => `${c} = ?`).join(', ')}, category = ?, updated_at = ? where id = ?`,
    [...wordingValues(w), (patch.category ?? q.category).trim(), now(), id],
  )
  changed('keep-titles')
}

/** Deletes a Question and takes it out of its sets. Items made from it stay as they are. */
export function deleteQuestion(id: number) {
  transaction(() => {
    run('delete from question_set_item where question_id = ?', [id])
    run('delete from question where id = ?', [id])
  })
  changed('keep-titles')
}

/** Renames a category on all its Questions; renaming to an existing category merges the two. Items keep their sections. */
export function renameCategory(from: string, to: string) {
  const name = to.trim()
  if (!name) throw new Error('A category needs a name')
  run('update question set category = ?, updated_at = ? where category = ?', [name, now(), from])
  changed('keep-titles')
}

// ---- Question sets

/** Every Question set in order, with its Questions' ids in set order. Reactive. */
export function listSets(): QuestionSet[] {
  const members = rows<{ set_id: number; question_id: number }>('select set_id, question_id from question_set_item order by position, question_id')
  return rows<{ id: number; name: string; position: number }>('select id, name, position from question_set order by position, id').map(
    (s) => ({ ...s, questionIds: members.filter((m) => m.set_id === s.id).map((m) => m.question_id) }),
  )
}

export const getSet = (id: number): QuestionSet | null => listSets().find((s) => s.id === id) ?? null

function setName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('A Question set needs a name')
  return trimmed
}

// Replaces a set's members, in order, each once, leaving out ids no longer in the bank.
function writeMembers(setId: number, questionIds: number[]) {
  const bank = new Set(rows<{ id: number }>('select id from question').map((r) => r.id))
  run('delete from question_set_item where set_id = ?', [setId])
  ;[...new Set(questionIds)]
    .filter((id) => bank.has(id))
    .forEach((id, i) => run('insert into question_set_item (set_id, question_id, position) values (?, ?, ?)', [setId, id, i + 1]))
}

/** Adds a Question set at the end, with these Questions in this order, and returns its id. */
export function createSet(name: string, questionIds: number[] = []): number {
  const trimmed = setName(name)
  const id = transaction(() => {
    run('insert into question_set (name, position) values (?, (select coalesce(max(position), 0) + 1 from question_set))', [trimmed])
    const id = lastId()
    writeMembers(id, questionIds)
    return id
  })
  changed('keep-titles')
  return id
}

export function renameSet(setId: number, name: string) {
  run('update question_set set name = ? where id = ?', [setName(name), setId])
  changed('keep-titles')
}

/** Deletes a set; its Questions stay in the bank. */
export function deleteSet(setId: number) {
  transaction(() => {
    run('delete from question_set_item where set_id = ?', [setId])
    run('delete from question_set where id = ?', [setId])
  })
  changed('keep-titles')
}

// Moves `id` `offset` places within `ids`, stopping at either end; null when it doesn't move.
function moved(ids: number[], id: number, offset: number): number[] | null {
  const from = ids.indexOf(id)
  if (from < 0) return null
  const to = Math.max(0, Math.min(ids.length - 1, from + offset))
  if (to === from) return null
  const out = ids.filter((x) => x !== id)
  out.splice(to, 0, id)
  return out
}

/** Moves a set `offset` places in the list of sets (-1 is up), stopping at either end. */
export function moveSet(setId: number, offset: number) {
  const ids = moved(
    listSets().map((s) => s.id),
    setId,
    offset,
  )
  if (!ids) return
  transaction(() => ids.forEach((id, i) => run('update question_set set position = ? where id = ?', [i + 1, id])))
  changed('keep-titles')
}

/** Sets a set's Questions and their order at once; a repeated id counts once. */
export function setSetQuestions(setId: number, questionIds: number[]) {
  transaction(() => writeMembers(setId, questionIds))
  changed('keep-titles')
}

/** Adds a Question at the end of a set, unless it is in it already. */
export function addToSet(setId: number, questionId: number) {
  setSetQuestions(setId, [...(getSet(setId)?.questionIds ?? []), questionId])
}

export function removeFromSet(setId: number, questionId: number) {
  setSetQuestions(
    setId,
    (getSet(setId)?.questionIds ?? []).filter((id) => id !== questionId),
  )
}

/** Moves a Question `offset` places within a set (-1 is up), stopping at either end. */
export function moveInSet(setId: number, questionId: number, offset: number) {
  const ids = moved(getSet(setId)?.questionIds ?? [], questionId, offset)
  if (ids) setSetQuestions(setId, ids)
}

/**
 * Saves a Questionnaire's Items, in order, as a new Question set and returns its id. An Item from the bank stands
 * for its Question as the bank has it; one written on the Questionnaire (or whose Question was deleted) is first
 * saved to the bank under its section, and becomes that Question's Item.
 */
export function saveItemsAsSet(questionnaireId: number, name: string): number {
  setName(name)
  const id = transaction(() => {
    const ids = listItems(questionnaireId).map((item) => {
      if (item.questionId !== null && getQuestion(item.questionId)) return item.questionId
      const qid = createQuestion({ ...item, category: item.section })
      run('update questionnaire_item set question_id = ? where id = ?', [qid, item.id])
      return qid
    })
    return createSet(name, ids)
  })
  changed('keep-titles')
  return id
}

// ---- Items

/** A Questionnaire's Items in order. Reactive, also to answer and wording edits. */
export const listItems = (questionnaireId: number): Item[] =>
  textRows<ItemRow>('select * from questionnaire_item where questionnaire_id = ? order by position, id', [questionnaireId]).map(toItem)

export const getItem = (id: number): Item | null => {
  const [r] = textRows<ItemRow>('select * from questionnaire_item where id = ?', [id])
  return r ? toItem(r) : null
}

/** The bank Questions already on a Questionnaire, for the picker to mark. Reactive. */
export const addedQuestionIds = (questionnaireId: number): Set<number> =>
  new Set(
    textRows<{ question_id: number }>('select question_id from questionnaire_item where questionnaire_id = ? and question_id is not null', [
      questionnaireId,
    ]).map((r) => r.question_id),
  )

const nextPosition = (questionnaireId: number) =>
  (rows<{ p: number | null }>('select max(position) as p from questionnaire_item where questionnaire_id = ?', [questionnaireId])[0].p ?? 0) + 1

// Inserts an Item at the end, without bumping the refresh signal.
function insertItem(questionnaireId: number, w: Wording, section: string, questionId: number | null): number {
  run(
    `insert into questionnaire_item (questionnaire_id, position, question_id, section, ${WORDING_COLUMNS.join(', ')})
     values (?, ?, ?, ?, ${WORDING_COLUMNS.map(() => '?').join(', ')})`,
    [questionnaireId, nextPosition(questionnaireId), questionId, section, ...wordingValues(w)],
  )
  return lastId()
}

/**
 * Adds bank Questions as Items at the end, in the given order, each under its category as section.
 * Skips the ones already on the Questionnaire and ones no longer in the bank. Returns the new Items' ids.
 */
export function addQuestions(questionnaireId: number, questionIds: number[]): number[] {
  const added = transaction(() => {
    const have = addedQuestionIds(questionnaireId)
    const ids: number[] = []
    for (const qid of questionIds) {
      const q = have.has(qid) ? null : getQuestion(qid)
      if (!q) continue
      have.add(qid)
      ids.push(insertItem(questionnaireId, q, q.category, q.id))
    }
    if (ids.length) touch(questionnaireId)
    return ids
  })
  if (added.length) changed('keep-titles')
  return added
}

/** Adds every Question of a category, in bank order. Returns the new Items' ids. */
export const addCategory = (questionnaireId: number, category: string): number[] =>
  addQuestions(
    questionnaireId,
    listQuestions({ category }).map((q) => q.id),
  )

/** Adds a Question set's Questions, in set order. Returns the new Items' ids. */
export const addSet = (questionnaireId: number, setId: number): number[] => addQuestions(questionnaireId, getSet(setId)?.questionIds ?? [])

/**
 * Adds a question written on the Questionnaire as an Item at the end and returns its id.
 * With `saveToBank` it is also saved as a Question in `draft.category`, which becomes the Item's origin and section.
 */
export function addNewItem(questionnaireId: number, draft: QuestionDraft, { saveToBank = false } = {}): number {
  const w = clean(draftWording(draft))
  const id = transaction(() => {
    const questionId = saveToBank ? createQuestion({ ...w, category: draft.category }) : null
    const section = saveToBank ? (draft.category ?? '').trim() : ''
    const id = insertItem(questionnaireId, w, section, questionId)
    touch(questionnaireId)
    return id
  })
  changed('keep-titles')
  return id
}

// The Item, or a message fit for the user.
function existing(itemId: number): Item {
  const item = getItem(itemId)
  if (!item) throw new Error('That Item no longer exists')
  return item
}

/**
 * Changes an Item's wording, Answer type, options or section, on this Questionnaire only.
 * An answer that no longer fits the new type or options is cleared.
 */
export function updateItem(itemId: number, patch: ItemPatch) {
  const item = existing(itemId)
  const { section = item.section, ...wording } = patch
  const w = clean({ ...item, ...wording })
  const answer = item.answer && fits({ ...item, ...w }, item.answer) ? item.answer : null
  transaction(() => {
    run(`update questionnaire_item set ${WORDING_COLUMNS.map((c) => `${c} = ?`).join(', ')}, section = ?, answer = ? where id = ?`, [
      ...wordingValues(w),
      section.trim(),
      answer && JSON.stringify(answer),
      itemId,
    ])
    touch(item.questionnaireId)
  })
  changed('text')
}

// ---- Answers

/** Whether an answer counts as given: not null, and not an empty text or an empty choice. */
export function isAnswered(answer: Answer | null): boolean {
  if (!answer) return false
  if ('text' in answer) return !!answer.text.trim()
  if ('choice' in answer) return !!answer.choice || !!answer.other?.trim()
  if ('choices' in answer) return answer.choices.length > 0 || !!answer.other?.trim()
  return true
}

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !Number.isNaN(Date.parse(s))

// The answer, tidied, if it has the shape the Item's type takes; throws with a message fit for the user otherwise.
function fitted(item: Wording, a: Answer): Answer {
  const shape = new Error(`That is not a ${ANSWER_TYPES.find((t) => t.type === item.answerType)!.label} answer`)
  const other = (o: string | undefined) => {
    if (o === undefined || o === '') return {}
    if (!item.allowOther) throw new Error('This question has no "Other"')
    return { other: String(o) }
  }
  const option = (o: string) => {
    if (!item.options.includes(o)) throw new Error(`"${o}" is not one of the options`)
    return o
  }
  switch (item.answerType) {
    case 'short_text':
    case 'long_text':
      if (!('text' in a) || typeof a.text !== 'string') throw shape
      return { text: a.text }
    case 'yes_no':
      if (!('yes' in a) || typeof a.yes !== 'boolean') throw shape
      return { yes: a.yes, ...(a.comment ? { comment: String(a.comment) } : {}) }
    case 'single_choice':
      if (!('choice' in a) || typeof a.choice !== 'string') throw shape
      return { choice: a.choice && option(a.choice), ...other(a.other) }
    case 'multi_choice':
      if (!('choices' in a) || !Array.isArray(a.choices)) throw shape
      // In the options' order, each once.
      return { choices: item.options.filter((o) => a.choices.map(option).includes(o)), ...other(a.other) }
    case 'number':
      if (!('number' in a) || typeof a.number !== 'number' || !Number.isFinite(a.number)) throw shape
      return { number: a.number }
    case 'date':
      if (!('date' in a) || !isDate(a.date)) throw shape
      return { date: a.date }
    case 'scale':
      if (!('scale' in a) || ![1, 2, 3, 4, 5].includes(a.scale)) throw shape
      return { scale: a.scale }
  }
}

const fits = (item: Wording, a: Answer) => {
  try {
    fitted(item, a)
    return true
  } catch {
    return false
  }
}

/** Saves an Item's answer as given (null clears it). Throws, saving nothing, when it doesn't fit the Item's type or options. */
export function setAnswer(itemId: number, answer: Answer | null) {
  const item = existing(itemId)
  const value = answer && fitted(item, answer)
  transaction(() => {
    run('update questionnaire_item set answer = ? where id = ?', [value && JSON.stringify(value), itemId])
    touch(item.questionnaireId)
  })
  changed('text')
}

/** Clears an Item's answer. */
export const clearAnswer = (itemId: number) => setAnswer(itemId, null)

/** How many of a Questionnaire's Items are answered, of how many. Reactive. */
export function progress(questionnaireId: number): { answered: number; total: number } {
  const items = listItems(questionnaireId)
  return { answered: items.filter((i) => isAnswered(i.answer)).length, total: items.length }
}

/** Every Questionnaire's progress by its id, for the list; one with no Items is left out. Reactive like `progress`. */
export function progressById(): Map<number, { answered: number; total: number }> {
  const out = new Map<number, { answered: number; total: number }>()
  for (const r of textRows<{ questionnaire_id: number; answer: string | null }>('select questionnaire_id, answer from questionnaire_item')) {
    const p = out.get(r.questionnaire_id) ?? { answered: 0, total: 0 }
    p.total++
    if (r.answer !== null && isAnswered(JSON.parse(r.answer))) p.answered++
    out.set(r.questionnaire_id, p)
  }
  return out
}

/** Progress as the page and the list say it: "7 of 12 answered". */
export const progressText = ({ answered, total }: { answered: number; total: number }) => `${answered} of ${total} answered`

// ---- Order and removal

// Writes positions 1..n in the given order.
function renumber(ids: number[]) {
  ids.forEach((id, i) => run('update questionnaire_item set position = ? where id = ?', [i + 1, id]))
}

/** Moves an Item `offset` places (-1 is up), stopping at either end. */
export function moveItem(itemId: number, offset: number) {
  const item = existing(itemId)
  const ids = listItems(item.questionnaireId).map((i) => i.id)
  const from = ids.indexOf(itemId)
  const to = Math.max(0, Math.min(ids.length - 1, from + offset))
  if (to === from) return
  ids.splice(from, 1)
  ids.splice(to, 0, itemId)
  transaction(() => {
    renumber(ids)
    touch(item.questionnaireId)
  })
  changed('keep-titles')
}

/** An Item as `removeItem` took it out: `restoreItem` puts it back. */
export type RemovedItem = { row: ItemRow; index: number }

/** Removes an Item. Keep the result to put it back with `restoreItem` (Undo). */
export function removeItem(itemId: number): RemovedItem {
  const item = existing(itemId)
  const [row] = rows<ItemRow>('select * from questionnaire_item where id = ?', [itemId])
  const ids = listItems(item.questionnaireId).map((i) => i.id)
  transaction(() => {
    run('delete from questionnaire_item where id = ?', [itemId])
    renumber(ids.filter((id) => id !== itemId))
    touch(item.questionnaireId)
  })
  changed('keep-titles')
  return { row, index: ids.indexOf(itemId) }
}

/** Puts a removed Item back under its id, in its place among the Items there now. Does nothing if its Questionnaire is gone. */
export function restoreItem(removed: RemovedItem) {
  const { row } = removed
  if (!rows('select 1 from questionnaire where id = ?', [row.questionnaire_id]).length || getItem(row.id)) return
  const ids = listItems(row.questionnaire_id).map((i) => i.id)
  ids.splice(Math.min(removed.index, ids.length), 0, row.id)
  transaction(() => {
    insertRows([row])
    renumber(ids)
    touch(row.questionnaire_id)
  })
  changed('keep-titles')
}

// Inserts Item rows as they were, ids included.
function insertRows(items: ItemRow[]) {
  for (const r of items) {
    const columns = Object.keys(r)
    run(`insert into questionnaire_item (${columns.join(', ')}) values (${columns.map(() => '?').join(', ')})`, Object.values(r) as Value[])
  }
}

// ---- Follow up

const slot = (type: RecordType, labelId: number) => slotsOf(type).find((s) => s.labelId === labelId)!

/** A Questionnaire's Respondents, by title. Reactive. */
export const respondents = (questionnaireId: number): Titled[] => slotRecords(slot('questionnaire', LABEL.respondent), questionnaireId)

/** An Item's follow-up as it stands: the Open question's title, status, answer and whom it asks. Null when there is none, or it was deleted. Reactive. */
export function followUpOf(
  item: Item,
): { id: number; title: string; status: 'open' | 'answered'; answer: string | null; askedOf: string[] } | null {
  if (item.followUpId === null) return null
  const q = getRecord('open_question', item.followUpId)
  if (!q) return null
  const askedOf = slotRecords(slot('open_question', LABEL.askAbout), q.id).map((r) => r.title)
  return { id: q.id, title: q.title, status: q.status as 'open' | 'answered', answer: (q.answer as string | null) || null, askedOf }
}

/**
 * Follows up an unanswered Item: creates an Open question with the Item's text, notes "From [[<Questionnaire>]]"
 * plus the help text, asked of each Respondent, and links the Item to it. All in one transaction. Returns its id.
 */
export function followUp(itemId: number): number {
  const item = existing(itemId)
  if (isAnswered(item.answer)) throw new Error('This Item is already answered')
  if (followUpOf(item)) throw new Error('This Item is already followed up')
  const title = getRecord('questionnaire', item.questionnaireId)!.title
  const id = transaction(() => {
    const asked = createRecord('open_question', item.text, { notes: [`From [[${title}]]`, item.help].filter(Boolean).join('\n\n') })
    for (const person of respondents(item.questionnaireId)) addRelation(person, LABEL.askAbout, { type: 'open_question', id: asked })
    run('update questionnaire_item set follow_up_id = ?, follow_up_taken = 0 where id = ?', [asked, itemId])
    touch(item.questionnaireId)
    return asked
  })
  changed('keep-titles')
  return id
}

/**
 * Copies an answered follow-up's answer into a text Item that is still unanswered, once, and says whether it did.
 * Call it when the Item shows; other types only show the answer as a hint.
 */
export function takeFollowUpAnswer(itemId: number): boolean {
  const item = getItem(itemId)
  if (!item || (item.answerType !== 'short_text' && item.answerType !== 'long_text') || isAnswered(item.answer)) return false
  const asked = followUpOf(item)
  if (asked?.status !== 'answered' || !asked.answer?.trim()) return false
  if (rows<{ follow_up_taken: number }>('select follow_up_taken from questionnaire_item where id = ?', [itemId])[0].follow_up_taken)
    return false
  transaction(() => {
    run('update questionnaire_item set follow_up_taken = 1 where id = ?', [itemId])
    setAnswer(itemId, { text: asked.answer! })
  })
  return true
}

// ---- Reading answers

/** An answer as plain text, for search and export: "Yes, <comment>", choices joined with commas, '' for none. */
export function answerText(answer: Answer | null): string {
  if (!answer) return ''
  if ('text' in answer) return answer.text
  if ('yes' in answer) return [answer.yes ? 'Yes' : 'No', answer.comment].filter(Boolean).join(', ')
  if ('choice' in answer) return [answer.choice, answer.other].filter(Boolean).join(', ')
  if ('choices' in answer) return [...answer.choices, answer.other].filter(Boolean).join(', ')
  if ('number' in answer) return String(answer.number)
  if ('date' in answer) return answer.date
  return String(answer.scale)
}

/** What global search reads of a Questionnaire besides its fields: each Item's question and answer. */
export const searchTexts = (questionnaireId: number): [where: 'Question' | 'Answer', text: string][] =>
  rows<{ text: string; answer: string | null }>('select text, answer from questionnaire_item where questionnaire_id = ? order by position', [
    questionnaireId,
  ]).flatMap(({ text, answer }) => [
    ['Question', text],
    ['Answer', answerText(answer === null ? null : JSON.parse(answer))],
  ])

// The markdown fields of an answer: a long text, or a Yes/No comment.
const MARKDOWN_FIELDS = ['text', 'comment'] as const

/**
 * The markdown in the answers that holds a Mention, with its Questionnaire, each with how to write it back.
 * The answers are JSON: the texts in them are read and written field by field, never as raw JSON. Joins the caller's transaction.
 */
export const answerMarkdownTexts = (): ChildText[] =>
  rows<{ item: number; id: number; title: string; answer: string }>(
    `select i.id as item, q.id, q.title, i.answer from questionnaire_item i join questionnaire q on q.id = i.questionnaire_id
     where i.answer like '%[[%' order by q.id, i.position`,
  ).flatMap((row) => {
    const answer = JSON.parse(row.answer) as Record<string, unknown>
    return MARKDOWN_FIELDS.filter((key) => typeof answer[key] === 'string').map((key) => ({
      id: row.id,
      title: row.title,
      text: answer[key] as string,
      write: (next: string) => {
        // Re-read: the other text of the same answer may have been rewritten already.
        const [now] = rows<{ answer: string }>('select answer from questionnaire_item where id = ?', [row.item])
        run('update questionnaire_item set answer = ? where id = ?', [JSON.stringify({ ...JSON.parse(now.answer), [key]: next }), row.item])
      },
    }))
  })

// ---- With the Records: Duplicate, Delete, Undo delete, search and Mentions, through record-children

registerChildren('questionnaire', {
  // A copy has no answers yet, so it starts as a draft.
  freshOnCopy: ['status'],
  // The Items, without answers or follow-ups.
  copy: (fromId, toId) => {
    for (const r of rows<ItemRow>('select * from questionnaire_item where questionnaire_id = ? order by position, id', [fromId]))
      run(
        `insert into questionnaire_item (questionnaire_id, position, question_id, section, ${WORDING_COLUMNS.join(', ')})
         values (?, ?, ?, ?, ${WORDING_COLUMNS.map(() => '?').join(', ')})`,
        [toId, r.position, r.question_id, r.section, ...WORDING_COLUMNS.map((c) => r[c])],
      )
  },
  capture: (id) => {
    const items = rows<ItemRow>('select * from questionnaire_item where questionnaire_id = ?', [id])
    return () => insertRows(items)
  },
  remove: (id) => run('delete from questionnaire_item where questionnaire_id = ?', [id]),
  searchTexts,
  markdownTexts: () => answerMarkdownTexts(),
})

// An Item's follow-up goes with its Open question: deleting it unlinks the Items, and Undo delete links them again.
const followingUp = (openQuestionId: number) =>
  rows<{ id: number; questionnaire_id: number }>('select id, questionnaire_id from questionnaire_item where follow_up_id = ?', [openQuestionId])

registerChildren('open_question', {
  capture: (id) => {
    const items = followingUp(id)
    return () => {
      for (const item of items) {
        // Unless the Item is gone, or was followed up again since.
        run('update questionnaire_item set follow_up_id = ? where id = ? and follow_up_id is null', [id, item.id])
        touch(item.questionnaire_id)
      }
    }
  },
  remove: (id) => {
    for (const item of followingUp(id)) touch(item.questionnaire_id)
    run('update questionnaire_item set follow_up_id = null where follow_up_id = ?', [id])
  },
})
