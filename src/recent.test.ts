import { expect, test } from 'vitest'
import { promote, recentFromStore, type Remembered } from './recent'

// A fake directory handle: two handles are the same folder when their paths match, as isSameEntry says.
type Fake = { name: string; path: string }
const dir = (path: string): Fake => ({ name: path.split('/').at(-1)!, path })
const same = async (a: Fake, b: Fake) => a.path === b.path
let n = 0
const newId = () => `id${++n}`

const names = (list: Remembered<Fake>[]) => list.map((r) => r.handle.name)

test('an opened folder goes to the front of the list', async () => {
  n = 0
  let list: Remembered<Fake>[] = []
  list = await promote(list, dir('/a/Work'), same, newId)
  list = await promote(list, dir('/b/Home'), same, newId)

  expect(names(list)).toEqual(['Home', 'Work'])
})

test('a folder already in the list moves to the front, keeping its id, without a duplicate', async () => {
  n = 0
  let list: Remembered<Fake>[] = []
  for (const p of ['/a/Work', '/b/Home', '/c/Old']) list = await promote(list, dir(p), same, newId)
  const workId = list.find((r) => r.handle.name === 'Work')!.id

  // Another handle object for the same folder, as the picker returns.
  list = await promote(list, dir('/a/Work'), same, newId)

  expect(names(list)).toEqual(['Work', 'Old', 'Home'])
  expect(list[0].id).toBe(workId)
})

test('two folders with the same name are different entries', async () => {
  n = 0
  let list: Remembered<Fake>[] = []
  list = await promote(list, dir('/a/Notes'), same, newId)
  list = await promote(list, dir('/b/Notes'), same, newId)

  expect(list.map((r) => r.handle.path)).toEqual(['/b/Notes', '/a/Notes'])
  expect(list[0].id).not.toBe(list[1].id)
})

test('the list keeps the 5 most recent folders', async () => {
  n = 0
  let list: Remembered<Fake>[] = []
  for (const p of ['/1', '/2', '/3', '/4', '/5', '/6']) list = await promote(list, dir(p), same, newId)

  expect(names(list)).toEqual(['6', '5', '4', '3', '2'])
})

test('the one folder remembered before the list existed becomes its only entry', () => {
  n = 0
  const work = dir('/a/Work')

  expect(recentFromStore(undefined, work, newId)).toEqual([{ id: 'id1', handle: work }])
  expect(recentFromStore(undefined, undefined, newId)).toEqual([])
  // Once there is a list, it wins.
  const stored = [{ id: 'x', handle: dir('/b/Home') }]
  expect(recentFromStore(stored, work, newId)).toBe(stored)
})
