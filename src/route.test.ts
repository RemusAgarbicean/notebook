import { expect, test } from 'vitest'
import { decodePlace, encodePlace } from './route'

test.each([
  ['#/', { list: 'home', current: null }],
  ['#/system', { list: 'system', current: null }],
  ['#/open_question/12', { list: 'open_question', current: { type: 'open_question', id: 12 } }],
  ['#/tag/3', { list: { tag: 3 }, current: null }],
  ['#/tag/3/person/7', { list: { tag: 3 }, current: { type: 'person', id: 7 } }],
] as const)('%s names a place and reads back as it', (hash, place) => {
  expect(encodePlace(place)).toBe(hash)
  expect(decodePlace(hash)).toEqual(place)
})

test.each(['', '#', '#/nonsense', '#/tag', '#/tag/x', '#/system/abc/extra', 'system'])(
  'the hash %j is Home',
  (hash) => expect(decodePlace(hash)).toEqual({ list: 'home', current: null }),
)

test('a Record id that is not a whole number leaves just the list', () => {
  expect(decodePlace('#/system/1.5')).toEqual({ list: 'system', current: null })
  expect(decodePlace('#/tag/3/person/-1')).toEqual({ list: { tag: 3 }, current: null })
})
