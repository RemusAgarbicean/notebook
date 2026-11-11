import { expect, test } from 'vitest'
import { filterList } from './list-filter'

const rows = [
  { title: 'PO', sub: 'Purchase Order', closed: false },
  { title: 'GRN', sub: null, closed: false },
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
