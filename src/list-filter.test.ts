import { expect, test } from 'vitest'
import { filterList } from './list-filter'

const rows = [
  { title: 'PO', sub: 'Purchase Order', closed: false, tags: ['Finance', 'core'] },
  { title: 'GRN', sub: null, closed: false, tags: ['Logistics'] },
  { title: 'Élan', sub: 2026, closed: true },
]
const titles = (text: string, hideClosed = false) => filterList(rows, text, hideClosed).map((r) => r.title)

test('no filter text keeps every row', () => {
  expect(titles('')).toEqual(['PO', 'GRN', 'Élan'])
  expect(titles('   ')).toEqual(['PO', 'GRN', 'Élan'])
})

test('the text is looked for in the title and in the key field, ignoring case', () => {
  expect(titles('grn')).toEqual(['GRN'])
  expect(titles(' purchase ')).toEqual(['PO'])
  expect(titles('élan')).toEqual(['Élan'])
  expect(titles('202')).toEqual(['Élan'])
  expect(titles('zzz')).toEqual([])
})

test('closed rows can be left out, with or without filter text', () => {
  expect(titles('', true)).toEqual(['PO', 'GRN'])
  expect(titles('élan', true)).toEqual([])
})

test('a word starting with # narrows to rows with a Tag whose name contains it, and combines with text', () => {
  expect(titles('#finance')).toEqual(['PO'])
  expect(titles('#FIN')).toEqual(['PO'])
  expect(titles('#i')).toEqual(['PO', 'GRN'])
  expect(titles('#fin #core')).toEqual(['PO'])
  expect(titles('#fin #logistics')).toEqual([])
  expect(titles('#i grn')).toEqual(['GRN'])
  expect(titles('purchase   order #core')).toEqual(['PO'])
  expect(titles('#zzz')).toEqual([])
})

test('a # with nothing after it does not narrow yet', () => {
  expect(titles('#')).toEqual(['PO', 'GRN', 'Élan'])
  expect(titles('grn #')).toEqual(['GRN'])
})
