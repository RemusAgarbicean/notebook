import { expect, test } from 'vitest'
import { parseTable } from './bulk-import'
import { exampleCsv, planQuestionImport } from './question-import'

const plan = (text: string, existing: string[] = [], category = '') => planQuestionImport(parseTable(text), existing, category)

test('the columns may come in any order and any case, and only question is required', () => {
  expect(plan('Help,CATEGORY,Question\nThe business owner,Stakeholders,Who owns it?\n,,What is it for?')).toEqual({
    problem: null,
    rows: [
      { text: 'Who owns it?', answerType: 'short_text', options: [], category: 'Stakeholders', help: 'The business owner' },
      { text: 'What is it for?', answerType: 'short_text', options: [], category: '', help: '' },
    ],
  })
})

test('friendly type names, the picker labels and the codes all read as Answer types', () => {
  const types = (names: string[]) =>
    plan(`question,type,options\n${names.map((n, i) => `Q${i},${n},a`).join('\n')}`).rows.map((r) => r.answerType)
  expect(types(['text', 'Short text', 'long text', 'Long_Text', 'paragraph'])).toEqual([
    'short_text',
    'short_text',
    'long_text',
    'long_text',
    'long_text',
  ])
  expect(types(['yes/no', 'Yes / No', 'true/false', 'boolean', 'yes_no'])).toEqual(['yes_no', 'yes_no', 'yes_no', 'yes_no', 'yes_no'])
  expect(types(['choice', 'single choice', 'multiple choice', 'Multi choice', 'multi_choice'])).toEqual([
    'single_choice',
    'single_choice',
    'multi_choice',
    'multi_choice',
    'multi_choice',
  ])
  expect(types(['number', 'Date', 'scale', 'Scale 1–5', 'scale 1-5'])).toEqual(['number', 'date', 'scale', 'scale', 'scale'])
})

test('options are separated by | or ;, trimmed, without blanks or repeats, and kept only for choice types', () => {
  const rows = plan('question\ttype\toptions\nWhich env?\tchoice\tDev | Test|| Prod | Dev\nWhich days?\tmultiple choice\tMon;Tue ; Wed\nWhen?\tdate\tignored|too').rows
  expect(rows.map((r) => r.options)).toEqual([['Dev', 'Test', 'Prod'], ['Mon', 'Tue', 'Wed'], []])
})

test('an empty type is short text, or single choice when the row has options', () => {
  expect(plan('question,type,options\nA,,\nB,,x|y').rows.map((r) => r.answerType)).toEqual(['short_text', 'single_choice'])
})

test('a row with an unknown type, a choice without options or no question text carries a problem', () => {
  const rows = plan('question,type,options\nWhich env?,dropdown,a|b\nWhich region?,choice,\n,number,\nHow many?,number,').rows
  expect(rows.map((r) => r.error)).toEqual([
    'Unknown type "dropdown"',
    'A choice question needs options',
    'The question is empty',
    undefined,
  ])
})

test('without a question column nothing can be imported', () => {
  expect(plan('text,type\nWho owns it?,text')).toEqual({ problem: 'There is no "question" column.', rows: [] })
})

test('a question the bank already has, or an earlier row, is a duplicate, ignoring case and outer spaces', () => {
  const rows = plan('question\nWho owns it?\n  WHAT is it for? \nwho owns it?\nNew one', ['What is it for?']).rows
  expect(rows.map((r) => [r.text, r.duplicate])).toEqual([
    ['Who owns it?', undefined],
    ['WHAT is it for?', true],
    ['who owns it?', true],
    ['New one', undefined],
  ])
})

test('the example CSV has every column and imports without problems', () => {
  const csv = exampleCsv()
  expect(csv.split('\r\n')[0]).toBe('question,type,options,category,help')
  const { problem, rows } = plan(csv)
  expect(problem).toBeNull()
  expect(rows.filter((r) => r.error || r.duplicate)).toEqual([])
  expect(new Set(rows.map((r) => r.answerType))).toEqual(new Set(['short_text', 'long_text', 'yes_no', 'single_choice', 'multi_choice', 'number', 'date', 'scale']))
})

test('rows without a category take the default category', () => {
  expect(plan('question,category\nA,\nB,Data', [], ' Imported ').rows.map((r) => r.category)).toEqual(['Imported', 'Data'])
})
