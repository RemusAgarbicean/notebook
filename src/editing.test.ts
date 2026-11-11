import { expect, test } from 'vitest'
import {
  continueList,
  indentLines,
  insertLink,
  pasteLink,
  pasteTable,
  startMention,
  tableFromTsv,
  toggleLines,
  toggleWrap,
  type Edit,
} from './editing'

// A text with its selection written in it: `|` is the caret, or two of them the selection's ends.
function at(marked: string): Edit {
  const start = marked.indexOf('|')
  const rest = marked.slice(start + 1)
  const second = rest.indexOf('|')
  return second < 0
    ? { text: marked.slice(0, start) + rest, start, end: start }
    : { text: marked.slice(0, start) + rest.replace('|', ''), start, end: start + second }
}
const show = (e: Edit | null) =>
  e && e.text.slice(0, e.start) + '|' + (e.end > e.start ? e.text.slice(e.start, e.end) + '|' : '') + e.text.slice(e.end)

test('the selection notation of these tests reads back as written', () => {
  expect(at('a |b| c')).toEqual({ text: 'a b c', start: 2, end: 3 })
  expect(show(at('a |b| c'))).toBe('a |b| c')
  expect(show(at('ab|'))).toBe('ab|')
})

// ---- Bold, italic, code

test('bold wraps the selection and keeps it selected', () => {
  expect(show(toggleWrap(at('pay |the invoice| now'), '**'))).toBe('pay **|the invoice|** now')
})

test('bold on bold text unwraps it, whether or not the markers are selected', () => {
  expect(show(toggleWrap(at('pay **|the invoice|** now'), '**'))).toBe('pay |the invoice| now')
  expect(show(toggleWrap(at('pay |**the invoice**| now'), '**'))).toBe('pay |the invoice| now')
})

test('with nothing selected the caret lands between a new pair, and the same key takes the pair away', () => {
  expect(show(toggleWrap(at('a |'), '**'))).toBe('a **|**')
  expect(show(toggleWrap(at('a **|**'), '**'))).toBe('a |')
  expect(show(toggleWrap(at('|'), '`'))).toBe('`|`')
})

test('the spaces around a selected word stay outside the markers', () => {
  expect(show(toggleWrap(at('pay| the invoice |now'), '**'))).toBe('pay **|the invoice|** now')
  expect(show(toggleWrap(at('run |ME21N |first'), '`'))).toBe('run `|ME21N|` first')
})

test('italic and bold do not mistake each other', () => {
  expect(show(toggleWrap(at('|word|'), '*'))).toBe('*|word|*')
  expect(show(toggleWrap(at('*|word|*'), '*'))).toBe('|word|')
  // Bold text becomes bold italic, not plain italic.
  expect(show(toggleWrap(at('**|word|**'), '*'))).toBe('***|word|***')
  expect(show(toggleWrap(at('***|word|***'), '*'))).toBe('**|word|**')
  expect(show(toggleWrap(at('***|word|***'), '**'))).toBe('*|word|*')
  expect(show(toggleWrap(at('*|word|*'), '**'))).toBe('***|word|***')
})

test('code wraps and unwraps with backticks', () => {
  expect(show(toggleWrap(at('table |EKKO|'), '`'))).toBe('table `|EKKO|`')
  expect(show(toggleWrap(at('table `|EKKO|`'), '`'))).toBe('table |EKKO|')
})

// ---- Links

test('the link button wraps the selection and selects the address to type', () => {
  expect(show(insertLink(at('see |the wiki| page')))).toBe('see [the wiki](|url|) page')
})

test('with nothing selected the link button selects the text to type', () => {
  expect(show(insertLink(at('see |')))).toBe('see [|text|](url)')
})

test('pasting a web address over selected text links the text', () => {
  expect(show(pasteLink(at('see |the wiki| page'), ' https://wiki.example.com/a?b=1\n'))).toBe(
    'see [the wiki](https://wiki.example.com/a?b=1)| page',
  )
})

test('a paste that is not one web address over one line of text pastes normally', () => {
  expect(pasteLink(at('see |the wiki|'), 'not a link')).toBeNull()
  expect(pasteLink(at('see |the wiki|'), 'https://a.example and more')).toBeNull()
  expect(pasteLink(at('see |'), 'https://a.example')).toBeNull()
  expect(pasteLink(at('|one\ntwo|'), 'https://a.example')).toBeNull()
  // Replacing one address with another.
  expect(pasteLink(at('|https://old.example|'), 'https://new.example')).toBeNull()
  expect(pasteLink(at('```\n|curl|\n```'), 'https://a.example')).toBeNull()
})

// ---- Pasted spreadsheet ranges

test('a copied spreadsheet range becomes a markdown table with the first row as its header', () => {
  expect(tableFromTsv('System\tOwner\r\nCoupa\tAna\r\nSAP\tDan\r\n')).toBe(
    '| System | Owner |\n| --- | --- |\n| Coupa | Ana |\n| SAP | Dan |',
  )
})

test('a pipe in a cell is escaped and an empty cell stays a cell', () => {
  expect(tableFromTsv('a|b\tc\n\td')).toBe('| a\\|b | c |\n| --- | --- |\n|  | d |')
})

test('text that is not a rectangle of at least two rows and columns is not a table', () => {
  expect(tableFromTsv('one\ttwo')).toBeNull()
  expect(tableFromTsv('one\ntwo')).toBeNull()
  expect(tableFromTsv('a\tb\nc')).toBeNull()
  // A cell with a line break arrives quoted and breaks the rectangle.
  expect(tableFromTsv('a\t"b\nc"\nd\te')).toBeNull()
  expect(tableFromTsv('just words')).toBeNull()
})

test('a pasted table goes on lines of its own, with an empty line above', () => {
  expect(show(pasteTable(at('Interfaces:|'), 'a\tb\n1\t2'))).toBe('Interfaces:\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n|')
  expect(show(pasteTable(at('Interfaces:\n|'), 'a\tb\n1\t2'))).toBe('Interfaces:\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n|')
  expect(show(pasteTable(at('|'), 'a\tb\n1\t2'))).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |\n|')
  expect(show(pasteTable(at('x\n\n|old| y'), 'a\tb\n1\t2'))).toBe('x\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n| y')
})

test('inside a code block, and for anything that is not a table, the paste stays as it is', () => {
  expect(pasteTable(at('```\n|\n```'), 'a\tb\n1\t2')).toBeNull()
  expect(pasteTable(at('|'), 'plain text')).toBeNull()
})

// ---- Enter in a list

test('Enter continues a bulleted list with the same marker and indent', () => {
  expect(show(continueList(at('- one|')))).toBe('- one\n- |')
  expect(show(continueList(at('* one|')))).toBe('* one\n* |')
  expect(show(continueList(at('text\n    - deep|\nmore')))).toBe('text\n    - deep\n    - |\nmore')
})

test('Enter continues a numbered list with the next number', () => {
  expect(show(continueList(at('1. Requisition|')))).toBe('1. Requisition\n2. |')
  expect(show(continueList(at('9. nine|')))).toBe('9. nine\n10. |')
  expect(show(continueList(at('3) three|')))).toBe('3) three\n4) |')
})

test('Enter in the middle of a numbered list moves the steps below it up', () => {
  expect(show(continueList(at('1. Requisition|\n2. Approval\n    - by Ana\n3. PO\n\n4. later list')))).toBe(
    '1. Requisition\n2. |\n3. Approval\n    - by Ana\n4. PO\n\n4. later list',
  )
})

test('Enter in the middle of an item splits it', () => {
  expect(show(continueList(at('1. Requisition| in Coupa\n2. Approval')))).toBe('1. Requisition\n2. | in Coupa\n3. Approval')
})

test('Enter continues a task list with an unticked box', () => {
  expect(show(continueList(at('- [x] done|')))).toBe('- [x] done\n- [ ] |')
  expect(show(continueList(at('- [ ] open|')))).toBe('- [ ] open\n- [ ] |')
})

test('Enter on an empty item ends the list', () => {
  expect(show(continueList(at('- one\n- |')))).toBe('- one\n|')
  expect(show(continueList(at('1. one\n2. |\nafter')))).toBe('1. one\n|\nafter')
  expect(show(continueList(at('- [ ] |')))).toBe('|')
})

test('Enter outside a list, before the marker, with a selection or in a code block is a plain Enter', () => {
  expect(continueList(at('plain text|'))).toBeNull()
  expect(continueList(at('|- one'))).toBeNull()
  expect(continueList(at('- |one| two'))).toBeNull()
  expect(continueList(at('```\n- one|\n```'))).toBeNull()
  // A line of dashes or bold text is not a list item.
  expect(continueList(at('---|'))).toBeNull()
  expect(continueList(at('**bold**|'))).toBeNull()
})

// ---- Tab and Shift+Tab

test('Tab indents the current list item and Shift+Tab brings it back', () => {
  expect(show(indentLines(at('1. one\n2. tw|o'), false))).toBe('1. one\n    2. tw|o')
  expect(show(indentLines(at('1. one\n    2. tw|o'), true))).toBe('1. one\n2. tw|o')
  expect(show(indentLines(at('- [ ] a|'), false))).toBe('    - [ ] a|')
})

test('Tab outside a list does nothing, so the focus moves on', () => {
  expect(indentLines(at('plain| text'), false)).toBeNull()
  expect(indentLines(at('|'), false)).toBeNull()
  expect(indentLines(at('plain| text'), true)).toBeNull()
})

test('Shift+Tab on an item that has no indent does nothing, so the focus moves back', () => {
  expect(indentLines(at('- one|'), true)).toBeNull()
})

test('Tab and Shift+Tab move every line of a selection that spans lines', () => {
  expect(show(indentLines(at('a\n|b\n\nc|\nd'), false))).toBe('a\n|    b\n\n    c|\nd')
  expect(show(indentLines(at('a\n  |b\n\tc|\nd'), true))).toBe('a\n|b\nc|\nd')
})

test('a selection that ends at the start of a line leaves that line alone', () => {
  expect(show(indentLines(at('|- a\n- b\n|- c'), false))).toBe('|    - a\n    - b\n|- c')
})

// ---- The formatting bar's line buttons

test('the list buttons start a list on the current line', () => {
  expect(show(toggleLines(at('step| one'), 'bullet'))).toBe('- step| one')
  expect(show(toggleLines(at('|'), 'number'))).toBe('1. |')
  expect(show(toggleLines(at('call Ana|'), 'task'))).toBe('- [ ] call Ana|')
})

test('the numbered list button numbers the selected lines, skipping empty ones', () => {
  expect(show(toggleLines(at('|Requisition\nApproval\n\nPO|'), 'number'))).toBe('|1. Requisition\n2. Approval\n\n3. PO|')
})

test('a list button on lines that already are that list makes them plain lines', () => {
  expect(show(toggleLines(at('|- a\n- b|'), 'bullet'))).toBe('|a\nb|')
  expect(show(toggleLines(at('1. a|'), 'number'))).toBe('a|')
  expect(show(toggleLines(at('- [x] a|'), 'task'))).toBe('a|')
})

test('a list button turns one kind of list into another and keeps the indent', () => {
  expect(show(toggleLines(at('|- a\n- b|'), 'number'))).toBe('|1. a\n2. b|')
  expect(show(toggleLines(at('    1. a|'), 'task'))).toBe('    - [ ] a|')
  expect(show(toggleLines(at('- [ ] a|'), 'bullet'))).toBe('- a|')
})

test('the heading button steps through a heading, a smaller heading and plain text', () => {
  expect(show(toggleLines(at('Agenda|'), 'heading'))).toBe('## Agenda|')
  expect(show(toggleLines(at('## Agenda|'), 'heading'))).toBe('### Agenda|')
  expect(show(toggleLines(at('### Agenda|'), 'heading'))).toBe('Agenda|')
  expect(show(toggleLines(at('# Agenda|'), 'heading'))).toBe('Agenda|')
})

test('the Mention button starts a Mention, searching for the selection', () => {
  expect(show(startMention(at('ask |')))).toBe('ask [[|')
  expect(show(startMention(at('ask |Ana| now')))).toBe('ask [[Ana| now')
})
