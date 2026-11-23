import { db, takeBackup } from './notebook'
import {
  ANSWER_TYPES,
  createQuestion,
  createSet,
  getSet,
  isChoice,
  listQuestions,
  setSetQuestions,
  type AnswerType,
} from './questionnaires'
import { foldTitle, transaction } from './records'

// Question import: a pasted table or CSV file becomes Questions in the bank.
// Planning is pure; only `runQuestionImport` touches the Notebook.

/** One Question the import will save, or a row it will skip. */
export type QuestionImportRow = {
  text: string
  answerType: AnswerType
  options: string[]
  category: string
  help: string
  /** Why the row can't be imported. */
  error?: string
  /** The bank, or an earlier row, already has this question. */
  duplicate?: true
}

// Lower case letters and digits only: "Yes / No", "yes_no" and "yes/no" all read alike.
const key = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// Each Answer type under its code, its picker label and the friendly names people write.
const TYPE_NAMES = new Map<string, AnswerType>([
  ...ANSWER_TYPES.flatMap((t) => [
    [key(t.type), t.type],
    [key(t.label), t.type],
  ] as [string, AnswerType][]),
  ...(
    [
      ['text', 'short_text'],
      ['paragraph', 'long_text'],
      ['truefalse', 'yes_no'],
      ['boolean', 'yes_no'],
      ['choice', 'single_choice'],
      ['multichoice', 'multi_choice'],
      ['scale15', 'scale'],
    ] as [string, AnswerType][]
  ).map(([name, type]): [string, AnswerType] => [key(name), type]),
])

const COLUMNS = ['question', 'type', 'options', 'category', 'help'] as const
type Column = (typeof COLUMNS)[number]

/**
 * Turns the table (column names first) into the Questions as they will be saved.
 * `problem` says why nothing can be imported (no question column).
 */
export function planQuestionImport(
  table: readonly string[][],
  existingTexts: readonly string[],
  defaultCategory: string,
): { problem: string | null; rows: QuestionImportRow[] } {
  const headers = (table[0] ?? []).map((h) => h.trim().toLocaleLowerCase())
  const at = Object.fromEntries(COLUMNS.map((c) => [c, headers.indexOf(c)])) as Record<Column, number>
  if (at.question < 0) return { problem: 'There is no "question" column.', rows: [] }
  const seen = new Set(existingTexts.map(foldTitle))
  const rows = table.slice(1).map((cells): QuestionImportRow => {
    const cell = (c: Column) => (at[c] < 0 ? '' : (cells[at[c]] ?? '').trim())
    const options = [...new Set(cell('options').split(/[|;]/).map((o) => o.trim()).filter(Boolean))]
    const typeName = cell('type')
    const answerType = typeName ? TYPE_NAMES.get(key(typeName)) : options.length ? 'single_choice' : 'short_text'
    const row: QuestionImportRow = {
      text: cell('question'),
      answerType: answerType ?? 'short_text',
      options: answerType && isChoice(answerType) ? options : [],
      category: cell('category') || defaultCategory.trim(),
      help: cell('help'),
    }
    if (!row.text) row.error = 'The question is empty'
    else if (!answerType) row.error = `Unknown type "${typeName}"`
    else if (isChoice(answerType) && !row.options.length) row.error = 'A choice question needs options'
    else if (seen.has(foldTitle(row.text))) row.duplicate = true
    else seen.add(foldTitle(row.text))
    return row
  })
  return { problem: null, rows }
}

// One example row per Answer type; the help cells say what the column takes.
const EXAMPLE = [
  ['question', 'type', 'options', 'category', 'help'],
  ['What is the project called?', 'text', '', 'Goals and scope', 'Only question is required; the other columns may be left out.'],
  ['What problem does it solve?', 'long text', '', 'Goals and scope', ''],
  ['Is personal data involved?', 'yes/no', '', 'Data', 'yes/no or true/false'],
  ['Which environment?', 'choice', 'Dev | Test | Prod', 'Access', 'Options are separated by | or ;'],
  ['Which teams are involved?', 'multiple choice', 'Payments; Platform; Data', 'Stakeholders', ''],
  ['How many users?', 'number', '', 'Non-functional', ''],
  ['When is the go-live?', 'date', '', 'Timeline and budget', ''],
  ['How urgent is it?', 'scale', '', 'Timeline and budget', 'A scale from 1 to 5'],
]

const csvCell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** The example file offered in the import dialog: every column, and a row per Answer type. */
export const exampleCsv = () => EXAMPLE.map((row) => row.map(csvCell).join(',') + '\r\n').join('')

/** Where the imported Questions go besides the bank: nowhere, a new set by name, or the end of an existing set. */
export type ImportSet = null | { name: string } | { id: number }

/**
 * Takes a Backup, then saves the import in one transaction: all of it or nothing.
 * Rows with a problem are skipped; a duplicate is not imported again, but the
 * Question it matches still goes into the set. Rejects without saving if the Backup fails.
 */
export async function runQuestionImport(
  table: readonly string[][],
  defaultCategory: string,
  set: ImportSet,
): Promise<{ created: number; skipped: number }> {
  await takeBackup('question import')
  if (!db.value) throw new Error('The Notebook is closed')
  // Planned after the Backup, which may have waited on a save.
  const bank = listQuestions()
  const { problem, rows } = planQuestionImport(
    table,
    bank.map((q) => q.text),
    defaultCategory,
  )
  if (problem) throw new Error(problem)
  // The first Question with each text: the bank's, then the ones this import creates.
  const byText = new Map([...bank].reverse().map((q) => [foldTitle(q.text), q.id]))
  const result = { created: 0, skipped: 0 }

  // Nothing below awaits, so no save can run inside the transaction.
  transaction(() => {
    const ids: number[] = []
    for (const row of rows) {
      if (row.error) {
        result.skipped++
        continue
      }
      if (row.duplicate) result.skipped++
      else {
        const { text, answerType, options, category, help } = row
        byText.set(foldTitle(text), createQuestion({ text, answerType, options, category, help }))
        result.created++
      }
      ids.push(byText.get(foldTitle(row.text))!)
    }
    if (set && 'name' in set) createSet(set.name, ids)
    else if (set) setSetQuestions(set.id, [...(getSet(set.id)?.questionIds ?? []), ...ids])
  })
  return result
}
