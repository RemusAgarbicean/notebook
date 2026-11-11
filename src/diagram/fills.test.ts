import { expect, test } from 'vitest'
import { FILL_NAMES, fillVars } from './fills'

test('the palette is grey, red, orange, green, blue and purple', () => {
  expect(FILL_NAMES).toEqual(['grey', 'red', 'orange', 'green', 'blue', 'purple'])
})

test('a fill name gives a light and a different dark shade', () => {
  expect(fillVars('green')).toEqual({ '--fill-light': '#bbf7d0', '--fill-dark': '#166534' })
  for (const name of FILL_NAMES) {
    const vars = fillVars(name)
    expect(vars['--fill-light']).not.toBe(vars['--fill-dark'])
  }
})

test('no fill, or anything that is not a palette name, gives no shade', () => {
  expect(fillVars(undefined)).toEqual({})
  expect(fillVars('#ff0000')).toEqual({})
  expect(fillVars('toString')).toEqual({})
})
