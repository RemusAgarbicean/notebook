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

/** Node ids within one Diagram. */
export type NodesInDiagram = { diagram: number; nodes: string[] }

/** The Nodes linked to a Record, per Diagram: what `unlinkNodes` would turn into free text. */
export const linkedNodes = (target: RecordRef): NodesInDiagram[] =>
  diagramsLinking(target).map((d) => ({
    diagram: d.id,
    nodes: parseCanvas(d.canvas)
      .nodes.filter((n) => linksTo(n.data, target))
      .map((n) => n.id),
  }))

/**
 * Undoes `unlinkNodes` for a Record that is back: links the given Nodes to it
 * again, where they still are free text holding `title`. Call it inside the caller's transaction.
 */
export function relinkNodes(target: RecordRef, title: string, where: readonly NodesInDiagram[]) {
  for (const { diagram, nodes } of where) {
    const canvas = getRecord('diagram', diagram)?.canvas
    if (typeof canvas !== 'string') continue
    const saved = JSON.parse(canvas)
    for (const node of saved.nodes as { id: string; data: NodeData }[])
      if (nodes.includes(node.id) && !linkOf(node.data) && node.data.label === title)
        node.data = { ...node.data, recordType: target.type, recordId: target.id }
    db.value!.run('update diagram set canvas = ? where id = ?', [JSON.stringify(saved), diagram])
  }
}

/** Nodes with each linked Node's title snapshot (`label`) set to its Record's title now. */
export const withLiveTitles = <N extends { data?: NodeData }>(nodes: N[]): N[] =>
  nodes.map((n) => {
    const link = linkOf(n.data)
    const title = link && getRecord(link.type, link.id)?.title
    return title ? { ...n, data: { ...n.data, label: title } } : n
  })

/** Nodes with each one linked to a Record that no longer exists turned into a free-text Node (a clipboard outlives a delete). */
export const withoutDeadLinks = <N extends { data?: NodeData }>(nodes: N[]): N[] =>
  nodes.map((n) => {
    const link = linkOf(n.data)
    return n.data && link && !getRecord(link.type, link.id) ? { ...n, data: unlinked(n.data, undefined) } : n
  })
