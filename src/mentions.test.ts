// @vitest-environment jsdom
// DOMPurify does not sanitize under happy-dom, so these run in jsdom.
import { beforeEach, expect, test } from 'vitest'
import { renderMarkdown } from './markdown'
import { findMentions, mentionedIn, mentionFor, resolveMention, suggestMentions } from './mentions'
import { migrate } from './migrations'
import { db } from './notebook'
import { createRecord, getRecord, updateRecord } from './records'
import { loadSqlite } from './sqlite'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const link = (html: string) => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.querySelector('a, .mention-broken')
}

test('finds the Mentions in a text', () => {
  expect(findMentions('Ask [[Maria]] about [[System: Coupa]], not [single] or [[]]')).toEqual([
    'Maria',
    'System: Coupa',
  ])
})

test('a Mention resolves to the Record with that title, ignoring case', () => {
  const coupa = createRecord('system', 'Coupa')

  expect(resolveMention('coupa')).toEqual([{ type: 'system', id: coupa, title: 'Coupa' }])
  expect(resolveMention('Ștefan')).toEqual([])
})

test('an ambiguous title resolves to every match, and a type prefix narrows it', () => {
  const system = createRecord('system', 'Coupa')
  const team = createRecord('team', 'Coupa')

  expect(resolveMention('Coupa').map((r) => [r.type, r.id])).toEqual([
    ['system', system],
    ['team', team],
  ])
  expect(resolveMention('team: coupa').map((r) => [r.type, r.id])).toEqual([['team', team]])
})

test('a title that itself contains a colon still resolves', () => {
  const id = createRecord('journal_entry', 'Kickoff: P2P')

  expect(resolveMention('Kickoff: P2P')).toMatchObject([{ type: 'journal_entry', id }])
})

test('a Mention is written with its type only when the title is ambiguous', () => {
  const maria = createRecord('person', 'Maria')
  const system = createRecord('system', 'Coupa')
  const question = createRecord('open_question', 'coupa')

  expect(mentionFor({ type: 'person', id: maria, title: 'Maria' })).toBe('[[Maria]]')
  expect(mentionFor({ type: 'system', id: system, title: 'Coupa' })).toBe('[[System: Coupa]]')
  expect(mentionFor({ type: 'open_question', id: question, title: 'coupa' })).toBe('[[Open question: coupa]]')
})

test('autocomplete suggests Records whose title contains what was typed', () => {
  createRecord('system', 'Coupa')
  createRecord('person', 'Maria')
  createRecord('process', 'Procure in Coupa')

  expect(suggestMentions('cou').map((r) => r.title)).toEqual(['Coupa', 'Procure in Coupa'])
})

test('a Mention renders as a link to its Record', () => {
  const coupa = createRecord('system', 'Coupa')

  const a = link(renderMarkdown('We buy in [[coupa]].'))!

  expect(a.getAttribute('data-mention')).toBe(`system:${coupa}`)
  expect(a.textContent).toBe('coupa')
})

test('a Mention of an unknown title renders as a broken link', () => {
  const broken = link(renderMarkdown('See [[Nowhere <b>]]'))!

  expect(broken.classList.contains('mention-broken')).toBe(true)
  expect(broken.hasAttribute('data-mention')).toBe(false)
  expect(broken.textContent).toBe('Nowhere <b>')
})

test('a Mention inside code stays as text', () => {
  createRecord('system', 'Coupa')

  expect(renderMarkdown('`[[Coupa]]`')).not.toContain('data-mention')
})

test('renaming a Record rewrites every Mention of it in notes and answers', () => {
  const coupa = createRecord('system', 'Coupa')
  const process = createRecord('process', 'Buying', { notes: 'Use [[Coupa]], then [[coupa]] again. Not [[Coupang]].' })
  const question = createRecord('open_question', 'Who approves?', { answer: 'See [[System: Coupa]]' })

  updateRecord('system', coupa, { title: 'Coupa P2P' })

  expect(getRecord('process', process)!.notes).toBe('Use [[Coupa P2P]], then [[Coupa P2P]] again. Not [[Coupang]].')
  expect(getRecord('open_question', question)!.answer).toBe('See [[System: Coupa P2P]]')
})

test('renaming leaves Mentions of another Record with the same title alone', () => {
  const system = createRecord('system', 'Coupa')
  const team = createRecord('team', 'Coupa')
  const note = createRecord('process', 'Buying', { notes: '[[Coupa]] [[System: Coupa]] [[Team: Coupa]]' })

  updateRecord('team', team, { title: 'Coupa squad' })

  // A bare [[Coupa]] links to the first match, the System.
  expect(getRecord('process', note)!.notes).toBe('[[Coupa]] [[System: Coupa]] [[Team: Coupa squad]]')
  expect(getRecord('system', system)!.title).toBe('Coupa')
})

test('renaming onto a title another Record has writes the Mention with its type', () => {
  createRecord('team', 'Procurement')
  const system = createRecord('system', 'Coupa')
  const note = createRecord('process', 'Buying', { notes: '[[Coupa]]' })

  updateRecord('system', system, { title: 'Procurement' })

  expect(getRecord('process', note)!.notes).toBe('[[System: Procurement]]')
})

test('a rename that fails changes no Mention', () => {
  const coupa = createRecord('system', 'Coupa')
  const note = createRecord('process', 'Buying', { notes: '[[Coupa]]' })

  expect(() => updateRecord('system', coupa, { title: '  ' })).toThrow('Title is required')

  expect(getRecord('process', note)!.notes).toBe('[[Coupa]]')
})

test('Mentioned in lists the Records whose notes or answer Mention this one', () => {
  const coupa = createRecord('system', 'Coupa', { notes: 'I am [[Coupa]]' })
  const process = createRecord('process', 'Buying', { notes: '[[Coupa]] and [[coupa]]' })
  const question = createRecord('open_question', 'Who approves?', { answer: '[[Coupa]]' })
  createRecord('person', 'Maria', { notes: '[[Coupang]]' })

  expect(mentionedIn({ type: 'system', id: coupa })).toEqual([
    { type: 'process', id: process, title: 'Buying' },
    { type: 'open_question', id: question, title: 'Who approves?' },
  ])
})
