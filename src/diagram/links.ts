import { db } from '../notebook'
import { RECORD_TYPES } from '../record-types'
import { getRecord, rows, sameRecord, type RecordRef, type Titled } from '../records'
import { parseCanvas, type NodeData } from './canvas'

/** The Record a Node is linked to; null for a free-text Node. */
export function linkOf(data: NodeData | undefined): RecordRef | null {
  // The type comes from stored JSON and ends up as a table name, so it is checked.
  const type = RECORD_TYPES.find((t) => t.type === data?.recordType)?.type
  return type && typeof data?.recordId === 'number' ? { type, id: data.recordId } : null
}

const linksTo = (data: NodeData | undefined, target: RecordRef) => {
  const link = linkOf(data)
  return !!link && sameRecord(link, target)
}

// Every Diagram with at least one Node linked to the Record.
const diagramsLinking = (target: RecordRef) =>
  rows<{ id: number; title: string; canvas: string }>(
    `select id, title, canvas from diagram where canvas like '%"recordId"%' order by title collate nocase, id`,
  ).filter((d) => parseCanvas(d.canvas).nodes.some((n) => linksTo(n.data, target)))

/** The Diagrams with a Node linked to the Record, by title. */
export const inDiagrams = (target: RecordRef): Titled[] =>
  diagramsLinking(target).map(({ id, title }) => ({ type: 'diagram', id, title }))

/** A linked Node's data as a free-text Node holding `title`; without one (the Record is gone) it keeps its snapshot. */
export function unlinked(data: NodeData, title: string | undefined): NodeData {
  const { recordType: _type, recordId: _id, ...rest } = data
  return { ...rest, label: title ?? data.label }
}

/**
 * Turns every Node linked to a Record into a free-text Node holding the Record's
 * title. Call it before the Record is deleted, inside the caller's transaction.
 */
export function unlinkNodes(target: RecordRef) {
  const title = getRecord(target.type, target.id)?.title
  for (const { id, canvas } of diagramsLinking(target)) {
    const saved = JSON.parse(canvas)
    for (const node of saved.nodes as { data: NodeData }[])
      if (linksTo(node.data, target)) node.data = unlinked(node.data, title)
    db.value!.run('update diagram set canvas = ? where id = ?', [JSON.stringify(saved), id])
  }
}

/** Nodes with each linked Node's title snapshot (`label`) set to its Record's title now. */
export const withLiveTitles = <N extends { data?: NodeData }>(nodes: N[]): N[] =>
  nodes.map((n) => {
    const link = linkOf(n.data)
    const title = link && getRecord(link.type, link.id)?.title
    return title ? { ...n, data: { ...n.data, label: title } } : n
  })
