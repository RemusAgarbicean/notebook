// Builds sample-notebook/notebook.sqlite through the app's own modules, so it follows the schema.
// Run with `npm run sample`. Dates are relative to the day it runs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'
import { edgeData, FRAME_TYPE, GRID, greyEdge, NODE_TYPE, parseCanvas, serialiseCanvas, viewportFor, type EdgeOptions, type NodeData } from '../../src/diagram/canvas'
import { addImage, imageMarkdown } from '../../src/images'
import { findMentions, resolveMention } from '../../src/mentions'
import { MIGRATIONS, schemaVersion } from '../../src/migrations'
import { db, openNotebook } from '../../src/notebook'
import { setPinned } from '../../src/pins'
import type { RecordType } from '../../src/record-types'
import { addTag, createRecord, getRecord, incompleteRecords, listRecords, transaction, updateRecord, type Patch, type RecordRef } from '../../src/records'
import { LABEL, RELATION_SLOTS } from '../../src/relation-slots'
import { addLabel, addRelation, addToSlot, listLabels } from '../../src/relations'
import { memoryFolder } from '../../src/storage-memory'
import { DEFAULT_TEMPLATES } from '../../src/templates'

const BASE = Date.now()
const DAY = 864e5
/** The date `n` days ago (negative: ahead), as YYYY-MM-DD. */
const day = (n: number) => new Date(BASE - n * DAY).toLocaleDateString('sv')
/** Makes the app's clock read `n` days ago, so created_at and updated_at spread over the weeks. */
const at = (n: number, hour = 10) => vi.setSystemTime(new Date(BASE - n * DAY).setHours(n ? hour : new Date(BASE).getHours(), 15))

const ids: Record<string, RecordRef> = {}
function mk(key: string, type: RecordType, title: string, fields: Patch = {}, tags: string[] = [], daysAgo = 15): RecordRef {
  at(daysAgo)
  const id = createRecord(type, title, fields)
  for (const tag of tags) addTag(type, id, tag)
  return (ids[key] = { type, id })
}
const slot = (type: RecordType, name: string) => RELATION_SLOTS.find((s) => s.type === type && s.name === name)!
const put = (key: string, name: string, ...others: string[]) => others.forEach((o) => addToSlot(slot(ids[key].type, name), ids[key].id, ids[o]))
const title = (key: string) => getRecord(ids[key].type, ids[key].id)!.title

function png(name: string) {
  const data = new Uint8Array(readFileSync(`scripts/sample/${name}.png`))
  const view = new DataView(data.buffer)
  // A PNG's width and height are the first two fields of its IHDR chunk.
  return { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20), data }
}

// ---- Diagrams

const node = (id: string, x: number, y: number, data: NodeData, more: object = {}) => ({ id, type: NODE_TYPE, position: { x, y }, data, ...more })
const frame = (id: string, x: number, y: number, width: number, height: number, label: string, fill: NodeData['fill']) => ({
  id,
  type: FRAME_TYPE,
  position: { x, y },
  data: { label, width, height, fill },
})
const box = { width: 150, height: 44 }
const link = (key: string, more: Partial<NodeData> = {}): NodeData => ({ label: title(key), recordType: ids[key].type, recordId: ids[key].id, ...box, ...more })
const text = (label: string, more: Partial<NodeData> = {}): NodeData => ({ label, ...box, ...more })
const edge = (id: string, source: string, target: string, label = '', options: Partial<EdgeOptions> = {}) =>
  greyEdge({ id, type: 'default', source, target, data: edgeData({ arrow: 'end', line: 'solid', path: 'curved', ...options }), label })
const [LEFT, RIGHT] = [{ targetPosition: 'left' }, { sourcePosition: 'right' }]
// shortcut: the viewport fits a canvas of about this size; a much smaller window shows part of the Diagram until "Fit" is pressed.
const SCREEN = { width: 700, height: 430 }
function canvas(nodes: object[], edges: object[], bounds: { x: number; y: number; width: number; height: number }, snap = false) {
  const { x, y, zoom } = viewportFor(bounds, SCREEN, 24)
  // In the key order the app writes, so opening the Diagram reads back the very same text.
  return serialiseCanvas({ nodes, edges, viewport: { x, y, zoom }, snap })
}

function landscape() {
  const W = 1320
  const nodes = [
    frame('1', 0, 0, W, 140, 'Source', 'purple'),
    frame('2', 0, 156, W, 140, 'Procure', 'blue'),
    frame('3', 0, 312, W, 200, 'Pay', 'green'),
    frame('4', 0, 528, W, 200, 'Analyse', 'orange'),
    node('5', 40, 62, link('sourcing', { shape: 'pill' }), RIGHT),
    node('6', 250, 62, link('ariba'), LEFT),
    node('7', 460, 54, text('RFI, then RFQ or RFP, then award.\nContracts (MSA, SOW) stay in Ariba.', { shape: 'note', width: 300 })),
    node('8', 40, 218, link('srm', { fill: 'grey' }), RIGHT),
    node('9', 460, 218, link('coupa', { fill: 'blue' }), LEFT),
    node('10', 880, 218, link('mdg'), { sourcePosition: 'left' }),
    node('11', 40, 348, text('Invoice: 3-way match?', { shape: 'diamond', width: 180, height: 84, fill: 'orange' }), RIGHT),
    node('12', 330, 452, link('ap', { shape: 'pill' }), LEFT),
    node('13', 670, 368, link('s4', { fill: 'green' }), LEFT),
    node('14', 40, 584, text('Coupa loads hourly through the API,\nSAP nightly at 02:00 CET.', { shape: 'note', width: 300 })),
    node('15', 880, 574, link('snowflake', { shape: 'cylinder', height: 64, fill: 'blue' }), { ...LEFT, ...RIGHT }),
    node('16', 1130, 584, link('powerbi'), LEFT),
    node('17', 1130, 660, link('analytics', { shape: 'pill' })),
    node('18', 880, 664, link('arjun')),
    // A few shapes from the shape library.
    node('19', 900, 40, text('Supplier portal', { shape: 'cloud', height: 80 }), LEFT),
    node('20', 1130, 210, text('Purchase order', { shape: 'document', height: 60 }), LEFT),
    node('21', 1000, 440, text('Payment run', { shape: 'chevron' }), LEFT),
    node('22', 560, 420, text('AP clerk', { shape: 'actor', width: 80, height: 76 }), RIGHT),
  ]
  const edges = [
    edge('1', '5', '6'),
    edge('2', '6', '9', 'awarded contracts'),
    edge('3', '8', '9', 'replaced by', { line: 'dashed' }),
    edge('4', '10', '9', 'supplier sync'),
    edge('5', '10', '13', 'supplier master'),
    edge('6', '9', '13', 'POs, receipts', { arrow: 'both' }),
    edge('7', '11', '13', 'yes: post and pay', { path: 'straight' }),
    edge('8', '11', '12', 'no: exception'),
    edge('9', '9', '15', 'API, hourly', { path: 'step' }),
    edge('10', '13', '15', 'nightly extract'),
    edge('11', '15', '16', 'spend cube'),
    edge('12', '16', '17', '', { arrow: 'none' }),
    edge('13', '13', '21', 'pays'),
    edge('14', '22', '12', '', { arrow: 'none', line: 'dashed' }),
  ]
  // Snap to grid is on here, and a Diagram with it on moves its Nodes onto the grid when opened: they start there.
  const onGrid = (v: number) => Math.round(v / GRID) * GRID
  const snapped = nodes.map((n) => ({ ...n, position: { x: onGrid(n.position.x), y: onGrid(n.position.y) } }))
  return canvas(snapped, edges, { x: 0, y: 0, width: W, height: 736 }, true)
}

function stakeholders() {
  const person = { width: 170, height: 44 }
  const nodes = [
    frame('1', -24, -48, 658, 116, 'My team', 'blue'),
    node('2', 0, 0, link('ingrid', person)),
    node('3', 220, 0, link('tomasz', person)),
    node('4', 440, 0, link('priya', person)),
    node('5', 220, 200, text('Me', { ...person, shape: 'pill', fill: 'green' })),
    node('6', -95, 400, link('sofia', person)),
    node('7', 115, 400, link('arjun', person)),
    node('8', 325, 400, link('ruth', person)),
    node('9', 535, 400, link('marcus', person)),
    node('10', -95, 490, link('ops', { ...person, shape: 'pill' })),
    node('11', 115, 490, link('platform', { ...person, shape: 'pill' })),
    node('12', 325, 490, link('ap', { ...person, shape: 'pill' })),
    node('13', 535, 490, link('sourcing', { ...person, shape: 'pill' })),
  ]
  const plain = { arrow: 'none' } as const
  const edges = [
    edge('1', '5', '2', 'reports to'),
    edge('2', '5', '3', 'buddy', plain),
    edge('3', '5', '4', 'dashboards', plain),
    edge('4', '5', '6', 'P2P process', plain),
    edge('5', '5', '7', 'data access', plain),
    edge('6', '5', '8', 'invoices', plain),
    edge('7', '5', '9', 'category spend', plain),
    ...[6, 7, 8, 9].map((n) => edge(String(n + 2), String(n), String(n + 4), '', plain)),
  ]
  return canvas(nodes, edges, { x: -95, y: -48, width: 800, height: 582 })
}

// ---- The Notebook

const ACRONYMS: [string, string, string][] = [
  ['P2P', 'Procure-to-Pay', 'From requisition to paid invoice. Here: [[Purchase requisition to payment]].'],
  ['S2P', 'Source-to-Pay', 'Sourcing plus P2P: the whole chain. See [[Source-to-pay landscape]].'],
  ['PR', 'Purchase Requisition', 'The internal request to buy, raised in [[Coupa]].'],
  ['PO', 'Purchase Order', 'The binding order sent to the supplier once the PR is approved.'],
  ['GR', 'Goods Receipt', 'Confirmation that goods or services arrived.'],
  ['IR', 'Invoice Receipt', 'The supplier invoice as booked in [[SAP S/4HANA]].'],
  ['3WM', 'Three-Way Match', 'Invoice checked against PO and GR before payment.'],
  ['RFI', 'Request for Information', 'Market scan before a sourcing event.'],
  ['RFQ', 'Request for Quotation', 'Price request for a well-specified need.'],
  ['RFP', 'Request for Proposal', 'Like an RFQ, but suppliers also propose the solution.'],
  ['SOW', 'Statement of Work', 'What a supplier will deliver under an MSA.'],
  ['MSA', 'Master Service Agreement', 'Framework contract; each SOW hangs under it.'],
  ['SLA', 'Service Level Agreement', 'Agreed service targets, with penalties.'],
  ['KPI', 'Key Performance Indicator', ''],
  ['OTIF', 'On Time In Full', 'Share of deliveries that were both on time and complete.'],
  ['MOQ', 'Minimum Order Quantity', ''],
  ['TCO', 'Total Cost of Ownership', 'Price plus freight, duties, quality and handling cost.'],
  ['PPV', 'Purchase Price Variance', 'Actual price paid minus standard price, times quantity.'],
  ['SRM', 'Supplier Relationship Management', 'The discipline. Not to be confused with [[System: SRM]], the old tool.'],
  ['ERP', 'Enterprise Resource Planning', 'Ours is [[SAP S/4HANA]].'],
  ['EDI', 'Electronic Data Interchange', 'How large suppliers receive POs and send invoices.'],
  ['AP', 'Accounts Payable', 'The team: [[Accounts Payable]].'],
  ['DPO', 'Days Payable Outstanding', 'Average days we take to pay suppliers.'],
  ['COGS', 'Cost of Goods Sold', ''],
  ['CapEx', 'Capital Expenditure', 'Needs CFO approval above 50k EUR.'],
  ['OpEx', 'Operating Expenditure', ''],
  ['UNSPSC', 'United Nations Standard Products and Services Code', 'The category tree the spend cube uses.'],
]

test('builds the sample Notebook', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  await openNotebook(memoryFolder(), true)

  transaction(() => {
    // Teams and People
    mk('analytics', 'team', 'Procurement Analytics', { notes: 'My team. Owns the spend cube and the [[Power BI]] dashboards.' }, ['reporting'], 20)
    mk('sourcing', 'team', 'Strategic Sourcing', { notes: 'Category managers. They run RFQ and RFP events in [[SAP Ariba]].' }, ['sourcing'], 20)
    mk('ops', 'team', 'Procurement Operations', { notes: 'Runs the buying desk, [[Coupa]] and [[Supplier onboarding]].' }, ['p2p'], 20)
    mk('ap', 'team', 'Accounts Payable', { notes: 'Invoices, the three-way match and the payment run.' }, ['finance', 'p2p'], 19)
    mk('platform', 'team', 'Data Platform', { notes: 'Owns [[Snowflake]] and the loads into it.' }, ['data'], 19)
    const people: [string, string, string, string, string][] = [
      ['ingrid', 'Ingrid Halvorsen', 'Head of Procurement Analytics', 'Priorities, KPI definitions', 'analytics'],
      ['tomasz', 'Tomasz Wieczorek', 'Senior procurement analyst', 'Spend cube logic, anything "how do we do this here"', 'analytics'],
      ['priya', 'Priya Raman', 'BI developer', 'Power BI models and access', 'analytics'],
      ['marcus', 'Marcus Oyelaran', 'Category manager, Packaging', 'Packaging suppliers and contracts', 'sourcing'],
      ['sofia', 'Sofia Marchetti', 'P2P process owner', 'Approval rules, P2P policy', 'ops'],
      ['daniel', 'Daniel Okafor', 'Coupa administrator', 'Coupa access, approval chains', 'ops'],
      ['meiling', 'Mei-Ling Tan', 'Supplier onboarding specialist', 'New suppliers, master data', 'ops'],
      ['ruth', 'Ruth Abernathy', 'AP manager', 'Payment terms, invoice exceptions', 'ap'],
      ['arjun', 'Arjun Mehta', 'Data engineer', 'Snowflake access, load failures', 'platform'],
    ]
    for (const [key, name, role, go_to_for, team] of people) {
      mk(key, 'person', name, { role, go_to_for, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@kestrelpine.example` }, [], 19)
      put(key, 'Team', team)
    }
    updateRecord('person', ids.tomasz.id, { notes: 'My onboarding buddy. Sits two desks down; prefers a quick call over chat.' })

    // Systems, each with an Owner
    const systems: [string, string, string, string, string, string[]][] = [
      ['s4', 'SAP S/4HANA', 'ERP: finance, purchasing, master data', 'System of record for POs, receipts and invoices. Gets POs from [[Coupa]] and suppliers from [[SAP MDG]].\n\nUseful tables: `EKKO`/`EKPO` (PO header and item), `EKBE` (PO history), `LFA1` (supplier).', 'ap', ['finance', 'p2p']],
      ['coupa', 'Coupa', 'Requisitions, approvals, POs, supplier portal', '## What it does\n\nWhere everyone raises a PR. Approved PRs become POs and go to [[SAP S/4HANA]].\n\n## Things to remember\n\n- Approval chains are maintained by [[Daniel Okafor]]\n- It replaced [[System: SRM]] in 2024\n- The old intranet page [[Coupa quick guide]] no longer exists\n\n| Object | Coupa name | SAP name |\n|---|---|---|\n| Request | Requisition | PR (`BANF`) |\n| Order | Purchase order | PO (`EKKO`) |\n| Receipt | Receipt | GR (movement 101) |', 'daniel', ['p2p']],
      ['ariba', 'SAP Ariba', 'Sourcing events and contracts', 'RFQ and RFP events, and the contract repository. Only [[Strategic Sourcing]] works in it.', 'sourcing', ['sourcing']],
      ['snowflake', 'Snowflake', 'Data warehouse', 'Schema `PROCUREMENT` holds the spend cube. Ask [[Arjun Mehta]] for access.', 'platform', ['data']],
      ['powerbi', 'Power BI', 'Dashboards on top of Snowflake', '', 'priya', ['reporting', 'data']],
      ['mdg', 'SAP MDG', 'Supplier and material master data', 'Master Data Governance: suppliers are created here, then synced to [[Coupa]] and [[SAP S/4HANA]].', 'meiling', ['master-data']],
      ['srm', 'SRM', 'Legacy SAP SRM, read-only since 2024', 'Old requisition tool. History before 2024 only exists here. See [[SRM decommissioning]].', 'ops', ['p2p']],
      ['jira', 'Jira', 'Tickets for data and report requests', 'Board `PA` for [[Procurement Analytics]].', 'analytics', []],
    ]
    for (const [key, name, summary, notes, owner, tags] of systems) {
      mk(key, 'system', name, { summary, notes, url: `https://${key}.kestrelpine.example` }, tags, 18)
      put(key, 'Owner', owner)
    }
    at(6, 14)
    const chart = addImage(ids.powerbi, png('spend-by-category'))
    updateRecord('system', ids.powerbi.id, {
      notes: `## Spend overview\n\nThe main dashboard, built by [[Priya Raman]] on the spend cube in [[Snowflake]].\n\n${imageMarkdown(chart, 'Spend by category')}\n\n## Checklist\n\n- [x] Get a Pro licence\n- [x] Open the Spend overview workspace\n- [ ] Rebuild the category page on the new cube\n\nThe query behind the supplier page:\n\n\`\`\`sql\nselect supplier_id, supplier_name, sum(amount_eur) as spend_eur\nfrom procurement.spend_cube\nwhere fiscal_year = 2025\ngroup by supplier_id, supplier_name\norder by spend_eur desc\nlimit 50;\n\`\`\`\n\nDocs: [Power BI documentation](https://learn.microsoft.com/power-bi/)`,
    })

    // Acronyms; SRM shares its title with the System, and BPO still lacks its expansion
    for (const [name, expansion, notes] of ACRONYMS) mk(`a:${name}`, 'acronym', name, { expansion, notes }, name === 'PPV' || name === 'OTIF' ? ['reporting'] : [], 17)
    for (const name of ['P2P', 'PR', 'PO', 'GR', '3WM']) addTag('acronym', ids[`a:${name}`].id, 'p2p')
    for (const name of ['RFQ', 'RFP', 'MSA', 'SOW']) addTag('acronym', ids[`a:${name}`].id, 'sourcing')
    mk('a:BPO', 'acronym', 'BPO', { notes: 'Heard in the AP walkthrough: the outsourced team keying invoices? Check with [[Ruth Abernathy]].' }, ['finance'], 5)

    // Processes
    mk('p2p', 'process', 'Purchase requisition to payment', { notes: '1. Requester raises a PR in [[Coupa]]\n2. Budget owner approves; above 50k EUR the CFO too\n3. Coupa issues the PO and sends it to the supplier\n4. Requester books the GR in Coupa\n5. Supplier invoice arrives in [[SAP S/4HANA]]\n6. [[Accounts Payable]] runs the three-way match\n7. Payment run, twice a week' }, ['p2p'], 16)
    mk('onboarding', 'process', 'Supplier onboarding', { notes: '1. Requester asks for a new supplier in [[Coupa]]\n2. [[Mei-Ling Tan]] checks for duplicates\n3. Supplier fills in bank and tax details in the portal\n4. Supplier is created in [[SAP MDG]]\n5. Sync to Coupa and SAP overnight' }, ['master-data', 'onboarding'], 16)
    mk('sourcingEvent', 'process', 'Sourcing event', { notes: '1. Category manager gathers demand\n2. RFI to scan the market\n3. RFQ or RFP in [[SAP Ariba]]\n4. Evaluation on TCO, not price alone\n5. Award, then MSA and SOW' }, ['sourcing'], 15)

    // Projects with Owners
    mk('cube', 'project', 'Spend cube rebuild', { status: 'active', due: day(-30), summary: 'One trusted spend model in Snowflake, by supplier and category', notes: 'Kick-off: [[Spend cube kick-off]]. Categories follow UNSPSC; open point: [[Do we report spend on PO date or invoice date?]]' }, ['reporting', 'data'], 13)
    mk('cleanup', 'project', 'Supplier master cleanup', { status: 'done', summary: 'Merge duplicate suppliers before the cube rebuild' }, ['master-data'], 18)
    mk('decom', 'project', 'SRM decommissioning', { status: 'on hold', summary: 'Switch off SRM once its history is in Snowflake', notes: 'On hold until the spend cube holds the pre-2024 history.' }, ['p2p'], 12)
    put('cube', 'Owner', 'ingrid')
    put('cleanup', 'Owner', 'meiling')
    put('decom', 'Owner', 'ops')

    // Tasks: done, overdue, due today, later, and without a date
    const tasks: [string, Patch, string | null, number][] = [
      ['Request Snowflake access', { done: true }, null, 18],
      ['Finish Coupa read-only training', { done: true }, null, 16],
      ['Review the duplicate supplier report', { done: true, due: day(9) }, 'cleanup', 10],
      ['Map SAP material groups to UNSPSC', { due: day(3) }, 'cube', 8],
      ['Write down the tail spend threshold', { due: day(1) }, 'cube', 6],
      ['Check spend by supplier against Power BI', { due: day(0) }, 'cube', 4],
      ['Draft KPI definitions for OTIF and PPV', { due: day(-3) }, 'cube', 3],
      ['Add payment terms to the supplier dimension', { due: day(-8) }, 'cube', 2],
      ['List reports that still read from SRM', { due: day(-14) }, 'decom', 5],
      ['Read the P2P policy', {}, null, 15],
    ]
    tasks.forEach(([name, fields, project, ago], i) => {
      mk(`t${i}`, 'task', name, fields, project === 'cube' ? ['reporting'] : [], ago)
      if (project) put(`t${i}`, 'Project', project)
    })

    // Bookmarks; one still lacks its URL
    mk('b1', 'bookmark', 'Spend overview dashboard', { url: 'https://powerbi.kestrelpine.example/groups/procurement/spend-overview' }, ['reporting'], 14)
    mk('b2', 'bookmark', 'P2P policy', { url: 'https://intranet.kestrelpine.example/policies/p2p.pdf' }, ['p2p'], 15)
    mk('b3', 'bookmark', 'UNSPSC code search', { url: 'https://www.unspsc.org/search-code' }, ['reporting'], 8)
    mk('b4', 'bookmark', 'Jira board PA', { url: 'https://jira.kestrelpine.example/boards/PA' }, [], 12)
    mk('b5', 'bookmark', 'Supplier scorecard template', { notes: 'Tomasz mentioned it; ask him for the link.' }, ['sourcing'], 4)

    // Open questions with someone to Ask; one answer became a Record
    mk('q1', 'open_question', 'Do we report spend on PO date or invoice date?', { notes: 'The old dashboard uses invoice date, [[Coupa]] reports use PO date.' }, ['reporting'], 9)
    mk('q2', 'open_question', 'Why do Coupa and SAP PO counts differ by about 2%?', {}, ['data'], 7)
    mk('q3', 'open_question', 'Is freight part of PPV?', {}, ['reporting'], 3)
    mk('q4', 'open_question', 'Where is the supplier master maintained?', { status: 'answered', answer: 'In [[SAP MDG]]. Never edit suppliers in Coupa or SAP directly: the nightly sync overwrites it.' }, ['master-data'], 14)
    mk('q5', 'open_question', 'What does GR/IR mean on the aging report?', { status: 'answered', answer: 'The clearing account between goods receipt and invoice receipt. Wrote it up as [[GR/IR]].' }, ['finance'], 6)
    put('q1', 'Ask', 'ingrid')
    put('q2', 'Ask', 'arjun')
    put('q3', 'Ask', 'marcus')
    put('q4', 'Ask', 'meiling')
    put('q5', 'Ask', 'ruth')
    mk('a:GR/IR', 'acronym', 'GR/IR', { expansion: 'Goods Receipt / Invoice Receipt', notes: 'Clearing account: received but not yet invoiced, or invoiced but not yet received. Old open items are what [[Accounts Payable]] chases.' }, ['finance'], 6)
    addRelation(ids.q5, LABEL.answeredBy, ids['a:GR/IR'])

    // Journal: meetings from the meeting template, and daily logs
    const [agenda, notes, decisions, actions] = DEFAULT_TEMPLATES.meeting!.split('\n\n')
    const meeting = (a: string, n: string, d: string, todo: string) => `${agenda}\n\n${a}\n\n${notes}\n\n${n}\n\n${decisions}\n\n${d}\n\n${actions}\n\n${todo}`
    mk('j1', 'journal_entry', '', { date: day(20), kind: 'log', notes: 'First day. Laptop, badge, accounts. [[Tomasz Wieczorek]] walked me through the team wiki.\n\nNew words today: [[P2P]], [[S2P]], [[PO]], [[Acronym: SRM]].' }, ['onboarding'], 20)
    mk('j2', 'journal_entry', 'P2P walkthrough with Procurement Operations', { date: day(16), kind: 'meeting', notes: meeting('- How a PR becomes a PO\n- Approval rules', '[[Sofia Marchetti]] showed [[Purchase requisition to payment]] end to end in [[Coupa]].', '- I get read-only access to Coupa', '- [x] Finish the Coupa training\n- [ ] Read the P2P policy') }, ['p2p', 'onboarding'], 16)
    mk('j3', 'journal_entry', 'Spend cube kick-off', { date: day(13), kind: 'meeting', notes: meeting('- Scope\n- Who does what', 'The cube moves to [[Snowflake]]; [[Power BI]] reads from it. History from [[System: SRM]] comes later.', '- Categories follow UNSPSC\n- [[Ingrid Halvorsen]] owns the KPI definitions', '- [ ] Map SAP material groups to UNSPSC\n- [ ] Draft KPI definitions for OTIF and PPV') }, ['reporting'], 13)
    mk('j4', 'journal_entry', 'AP invoice exceptions walkthrough', { date: day(6), kind: 'meeting' }, ['finance'], 6)
    mk('j5', 'journal_entry', '', { date: day(2), kind: 'log', notes: 'Tail spend here means suppliers under 10k EUR a year. Wrote the first version of the supplier query, see [[Power BI]].' }, [], 2)
    mk('j6', 'journal_entry', '', { date: day(0), kind: 'log', notes: '- Compared spend by supplier with the dashboard: top 20 match\n- Still unclear: [[Is freight part of PPV?]]' }, [], 0)
    put('j2', 'Attendees', 'sofia', 'daniel')
    put('j3', 'Attendees', 'ingrid', 'tomasz', 'priya', 'arjun')
    put('j4', 'Attendees', 'ruth')
    at(6, 16)
    const exceptions = addImage(ids.j4, png('invoice-exceptions'))
    updateRecord('journal_entry', ids.j4.id, {
      notes: meeting('- What blocks an invoice', `Most exceptions are price mismatches and a missing GR.\n\n${imageMarkdown(exceptions, 'Invoice exceptions by reason')}`, '- None', '- [x] Ask what GR/IR means\n- [ ] Find out what [[BPO]] stands for'),
    })

    // Free Relations: seeded labels and two of my own
    const uses = listLabels().find((l) => l.forward === 'uses')!.id
    const related = listLabels().find((l) => l.forward === 'related to')!.id
    const feeds = addLabel('feeds', 'fed by')
    const reportsTo = addLabel('reports to', 'manages')
    const relations: [string, number, string][] = [
      ['p2p', uses, 'coupa'], ['p2p', uses, 's4'], ['onboarding', uses, 'mdg'], ['sourcingEvent', uses, 'ariba'],
      ['analytics', uses, 'powerbi'], ['analytics', uses, 'snowflake'], ['cube', uses, 'snowflake'],
      ['coupa', feeds, 's4'], ['coupa', feeds, 'snowflake'], ['s4', feeds, 'snowflake'], ['snowflake', feeds, 'powerbi'], ['mdg', feeds, 'coupa'], ['mdg', feeds, 's4'],
      ['coupa', related, 'srm'], ['decom', related, 'cube'], ['a:P2P', related, 'p2p'],
      ['tomasz', reportsTo, 'ingrid'], ['priya', reportsTo, 'ingrid'], ['daniel', reportsTo, 'sofia'], ['meiling', reportsTo, 'sofia'],
    ]
    for (const [from, label, to] of relations) addRelation(ids[from], label, ids[to])

    // Diagrams
    at(11)
    mk('landscape', 'diagram', 'Source-to-pay landscape', { notes: 'Which System does what, by stage. Double-click a Node to open its Record.' }, ['p2p', 'data'], 11)
    mk('who', 'diagram', 'Who to ask', { notes: 'The people I go to most, and their Teams.' }, ['onboarding'], 9)
    at(4, 17)
    updateRecord('diagram', ids.landscape.id, { canvas: landscape() })
    at(7, 11)
    updateRecord('diagram', ids.who.id, { canvas: stakeholders() })

    for (const key of ['cube', 'landscape', 'coupa', 'p2p']) setPinned(ids[key], true)
  })
  vi.useRealTimers()

  // ---- Self-check, then write the file
  const d = db.value!
  expect(schemaVersion(d)).toBe(MIGRATIONS.length)
  expect(incompleteRecords().map((r) => r.title)).toEqual(['BPO', 'Supplier scorecard template'])
  const texts = Object.values(ids).flatMap(({ type, id }) => [getRecord(type, id)!.notes, String(getRecord(type, id)!.answer ?? '')])
  const broken = texts.flatMap(findMentions).filter((m) => !resolveMention(m).length)
  expect(broken).toEqual(['Coupa quick guide']) // the one deliberately broken Mention
  for (const diagram of listRecords('diagram')) expect(serialiseCanvas(parseCanvas(diagram.canvas as string))).toBe(diagram.canvas)

  mkdirSync('sample-notebook', { recursive: true })
  writeFileSync('sample-notebook/notebook.sqlite', d.export())
})
