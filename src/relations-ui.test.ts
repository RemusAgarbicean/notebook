import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App.vue'
import { current, openRecord } from './navigation'
import { closeNotebook } from './notebook'
import { RECORD_TYPES } from './record-types'
import { createRecord, listRecords, type RecordRef } from './records'
import { LABEL, RELATION_SLOTS } from './relation-slots'
import { addRelation, hasRelation, listLabels } from './relations'
import { memoryFolder } from './storage-memory'

let app: VueWrapper

beforeEach(async () => {
  closeNotebook()
  const folder = memoryFolder()
  app = mount(App, {
    props: { storage: { pick: async () => folder, lastName: async () => null, reopen: async () => null } },
    attachTo: document.body,
  })
  await flushPromises()
  await app.findAll('button').find((b) => b.text() === 'Create new Notebook')!.trigger('click')
  await expect.poll(() => app.find('[data-testid="sidebar"]').exists()).toBe(true)
})
afterEach(() => app.unmount())

const USES = 5
const get = (id: string) => app.get(`[data-testid="${id}"]`)
const all = (id: string, within: Pick<DOMWrapper<Element>, 'findAll'> = app) =>
  within.findAll(`[data-testid="${id}"]`)
const make = (type: RecordRef['type'], title: string): RecordRef => ({ type, id: createRecord(type, title) })
const open = async (r: RecordRef) => {
  openRecord(r.type, r.id)
  await flushPromises()
}
// Types into the picker inside the given part of the page and returns the options it offers.
const search = async (within: string, text: string) => {
  await get(within).get('[data-testid="record-picker"]').setValue(text)
  return all('picker-option', get(within))
}
const pick = async (within: string, text: string, option: string) => {
  const found = (await search(within, text)).find((o) => o.text() === option)
  if (!found) throw new Error(`No option "${option}"`)
  await found.trigger('click')
}
const chooseReading = async (reading: string) => {
  await get('add-relation').trigger('click')
  const select = get('relation-reading')
  await select.setValue(select.findAll('option').find((o) => o.text() === reading)!.attributes('value'))
}
// The Relations section as text: each reading with the titles under it.
const relations = () =>
  all('relation-group').map((g) => [g.get('h3').text(), all('relation', g).map((r) => r.text())])
const slot = (name: string) => all('slot-record', get(`slot-${name}`)).map((r) => r.text())

test('adding "owned by Maria" on Coupa saves Maria owns Coupa and shows on both pages', async () => {
  const maria = make('person', 'Maria')
  const coupa = make('system', 'Coupa')
  await open(coupa)

  await chooseReading('owned by')
  await pick('relations', 'mar', 'Maria')

  expect(hasRelation(maria, LABEL.owns, coupa)).toBe(true)
  // On Coupa it is the Owner slot's; on Maria it reads the forward way.
  expect(slot('Owner')).toEqual(['Maria'])
  expect(relations()).toEqual([])

  await open(maria)
  expect(relations()).toEqual([['owns', ['Coupa']]])

  await get('relation').get('button').trigger('click')
  expect(current.value).toEqual(coupa)
})

test('a plain Relation shows under its own reading on each page and can be removed', async () => {
  const s2p = make('process', 'Source-to-Pay')
  const coupa = make('system', 'Coupa')
  await open(s2p)

  await chooseReading('uses')
  await pick('relations', 'COUP', 'Coupa')
  expect(relations()).toEqual([['uses', ['Coupa']]])

  await open(coupa)
  expect(relations()).toEqual([['used by', ['Source-to-Pay']]])

  await get('relation').get('[aria-label="Remove Relation used by Source-to-Pay"]').trigger('click')
  expect(relations()).toEqual([])
  expect(hasRelation(s2p, USES, coupa)).toBe(false)
})

test('the picker offers to create a Record, which is related without leaving the page', async () => {
  const coupa = make('system', 'Coupa')
  await open(coupa)

  await chooseReading('used by')
  await pick('relations', 'Finance', "Create Team 'Finance'")

  expect(listRecords('team').map((t) => t.title)).toEqual(['Finance'])
  expect(current.value).toEqual(coupa)
  expect(relations()).toEqual([['used by', ['Finance']]])
})

test('the picker does not offer the Record itself, and a duplicate is refused with a message', async () => {
  const coupa = make('system', 'Coupa')
  const sap = make('system', 'SAP')
  addRelation(coupa, USES, sap)
  await open(coupa)

  await chooseReading('uses')
  expect((await search('relations', 'coupa')).map((o) => o.text())).not.toContain('Coupa')

  await pick('relations', 'sap', 'SAP')
  expect(get('relations').get('[role="alert"]').text()).toBe('That Relation already exists')
  expect(relations()).toEqual([['uses', ['SAP']]])
})

test.each(RELATION_SLOTS)('the $type $name slot offers only its types and saves its Relation', async (s) => {
  for (const t of RECORD_TYPES) createRecord(t.type, `Zed ${t.type}`)
  const own = make(s.type, 'The one')
  await open(own)

  const options = await search(`slot-${s.name}`, 'zed')
  expect(options.map((o) => o.text()).filter((o) => !o.startsWith('Create '))).toEqual(
    s.offers.map((t) => `Zed ${t}`).sort(),
  )
  const created = (await search(`slot-${s.name}`, 'Brand new')).map((o) => o.text())
  expect(created).toHaveLength(s.offers.length)
  expect(created.every((c) => c.startsWith('Create ') && c.endsWith("'Brand new'"))).toBe(true)

  await pick(`slot-${s.name}`, 'zed', `Zed ${s.offers[0]}`)

  const other = { type: s.offers[0], id: listRecords(s.offers[0]).find((r) => r.title.startsWith('Zed'))!.id }
  expect(s.end === 'from' ? hasRelation(own, s.labelId, other) : hasRelation(other, s.labelId, own)).toBe(true)
  expect(slot(s.name)).toEqual([`Zed ${s.offers[0]}`])
  // A Record already in the slot is not offered again.
  expect((await search(`slot-${s.name}`, 'zed')).map((o) => o.text())).not.toContain(`Zed ${s.offers[0]}`)

  await get(`slot-${s.name}`).get(`[aria-label="Remove Zed ${s.offers[0]}"]`).trigger('click')
  expect(slot(s.name)).toEqual([])
})

test('a slot can create the Record it needs', async () => {
  const maria = make('person', 'Maria')
  await open(maria)

  await pick('slot-Team', 'Analytics', "Create Team 'Analytics'")

  expect(slot('Team')).toEqual(['Analytics'])
  const team = { type: 'team' as const, id: listRecords('team')[0].id }
  expect(hasRelation(maria, LABEL.memberOf, team)).toBe(true)

  await open(team)
  expect(relations()).toEqual([['has member', ['Maria']]])
})

const labelRows = () =>
  all('label-row').map((r) => [
    (r.get('[data-testid="label-forward"]').element as HTMLInputElement).value,
    (r.get('[data-testid="label-reverse"]').element as HTMLInputElement).value,
    r.get('[data-testid="label-uses"]').text(),
    (r.get('[data-testid="label-delete"]').element as HTMLButtonElement).disabled,
  ])

test('the Labels screen lists each label with its readings, its use count and whether it can be deleted', async () => {
  addRelation(make('process', 'Source-to-Pay'), USES, make('system', 'Coupa'))

  await get('open-labels').trigger('click')

  expect(labelRows()).toEqual([
    ['owns', 'owned by', '0', true],
    ['member of', 'has member', '0', true],
    ['ask about', 'go-to for', '0', true],
    ['attended', 'attended by', '0', true],
    ['uses', 'used by', '1', true],
    ['part of', 'contains', '0', true],
    ['related to', 'related to', '0', false],
    ['answered by', 'answers', '0', true],
  ])
})

test('renaming a label on the Labels screen updates the open Record page', async () => {
  const s2p = make('process', 'Source-to-Pay')
  addRelation(s2p, USES, make('system', 'Coupa'))
  await open(s2p)
  await get('open-labels').trigger('click')

  const row = all('label-row')[4]
  await row.get('[data-testid="label-forward"]').setValue('runs on')

  expect(relations()).toEqual([['runs on', ['Coupa']]])

  await row.get('[data-testid="label-reverse"]').setValue(' ')
  expect(get('labels-dialog').get('[role="alert"]').text()).toBe('Both readings are required')
  expect(labelRows()[4].slice(0, 2)).toEqual(['runs on', 'used by'])
})

test('a label can be added and an unused one deleted from the Labels screen', async () => {
  await get('open-labels').trigger('click')

  await get('new-label-forward').setValue('reports to')
  await get('new-label-reverse').setValue('manages')
  await get('add-label').trigger('submit')

  expect(labelRows().at(-1)).toEqual(['reports to', 'manages', '0', false])

  await all('label-row').at(-1)!.get('[data-testid="label-delete"]').trigger('click')
  expect(listLabels().map((l) => l.forward)).not.toContain('reports to')
  expect(labelRows()).toHaveLength(8)

  await get('close-labels').trigger('click')
  expect(app.find('[data-testid="labels-dialog"]').exists()).toBe(false)
})

test('the Labels screen refuses a reading another label has, says which, and keeps what was typed or saved', async () => {
  await get('open-labels').trigger('click')
  const alert = () => get('labels-dialog').get('[role="alert"]').text()

  await get('new-label-forward').setValue('reports to')
  await get('new-label-reverse').setValue('Owns')
  await get('add-label').trigger('submit')

  expect(alert()).toBe('"Owns" is already a reading of the label "owns / owned by"')
  expect(labelRows()).toHaveLength(8)
  expect((get('new-label-forward').element as HTMLInputElement).value).toBe('reports to')

  await all('label-row')[4].get('[data-testid="label-reverse"]').setValue('has member')
  expect(alert()).toBe('"has member" is already a reading of the label "member of / has member"')
  expect(labelRows()[4].slice(0, 2)).toEqual(['uses', 'used by'])

  await get('new-label-reverse').setValue('manages')
  await get('add-label').trigger('submit')
  expect(labelRows().at(-1)).toEqual(['reports to', 'manages', '0', false])
  expect(get('labels-dialog').find('[role="alert"]').exists()).toBe(false)
})
