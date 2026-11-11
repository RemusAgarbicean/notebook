import { beforeEach, expect, test } from 'vitest'
import { migrate } from '../migrations'
import { db } from '../notebook'
import { createRecord, deleteRecord, getRecord, updateRecord } from '../records'
import { loadSqlite } from '../sqlite'
import { parseCanvas, type NodeData } from './canvas'
import { inDiagrams, withLiveTitles } from './links'

beforeEach(async () => {
  const fresh = new (await loadSqlite()).Database()
  migrate(fresh)
  db.value = fresh
})

const node = (id: string, data: NodeData) => ({ id, type: 'node', position: { x: 0, y: 0 }, data })
function diagram(title: string, ...data: NodeData[]) {
  const id = createRecord('diagram', title)
  updateRecord('diagram', id, { canvas: JSON.stringify({ nodes: data.map((d, i) => node(String(i + 1), d)) }) })
  return id
}
const nodeData = (id: number) => parseCanvas(getRecord('diagram', id)!.canvas as string).nodes.map((n) => n.data)

test('In Diagrams finds every Diagram with a Node linked to the Record, once each, by title', () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  const link = { label: 'Coupa', recordType: 'system', recordId: coupa }
  const s2p = diagram('S2P overview', link, { label: 'free' }, link)
  const invoices = diagram('Invoices', link)
  diagram('SAP only', { label: 'SAP', recordType: 'system', recordId: sap })
  // Same id, another type: not a link to the System.
  diagram('People', { label: 'Coupa', recordType: 'person', recordId: coupa })

  expect(inDiagrams({ type: 'system', id: coupa })).toEqual([
    { type: 'diagram', id: invoices, title: 'Invoices' },
    { type: 'diagram', id: s2p, title: 'S2P overview' },
  ])
})

test('deleting a Record turns its Nodes into free-text Nodes holding its last title', () => {
  const coupa = createRecord('system', 'Coupa')
  const sap = createRecord('system', 'SAP')
  const id = diagram(
    'S2P overview',
    { label: 'Coupa', fill: 'green', recordType: 'system', recordId: coupa },
    { label: 'SAP', recordType: 'system', recordId: sap },
  )
  updateRecord('system', coupa, { title: 'Coupa P2P' })

  deleteRecord('system', coupa)

  expect(nodeData(id)).toEqual([
    { label: 'Coupa P2P', fill: 'green' },
    { label: 'SAP', recordType: 'system', recordId: sap },
  ])
  expect(inDiagrams({ type: 'system', id: coupa })).toEqual([])
})

test('a save carries the live title as the snapshot, and keeps the snapshot of a Record that is gone', () => {
  const coupa = createRecord('system', 'Coupa')
  updateRecord('system', coupa, { title: 'Coupa P2P' })
  const nodes = [
    node('1', { label: 'Coupa', recordType: 'system', recordId: coupa }),
    node('2', { label: 'Gone', recordType: 'system', recordId: 999 }),
    node('3', { label: 'free' }),
  ]

  expect(withLiveTitles(nodes).map((n) => n.data.label)).toEqual(['Coupa P2P', 'Gone', 'free'])
})
