import { portableImages } from './images'
import { renderMarkdown } from './markdown'
import { getRecord, today } from './records'
import { slotsOf } from './relation-slots'
import { slotRecords } from './relations'
import { listItems, type Item } from './questionnaires'

// Export a Questionnaire: pure renderers from a snapshot to Markdown, email text and the print view's HTML.
// Long text answers and Yes/No comments are markdown: the Markdown keeps them as written, with Images as a
// placeholder; the email text is blank; the print view renders them as notes are, Images included.

/** What an export shows of an Item. */
export type ExportItem = Pick<
  Item,
  'text' | 'help' | 'answerType' | 'options' | 'allowOther' | 'unit' | 'scaleLow' | 'scaleHigh' | 'section' | 'answer'
>

/** A Questionnaire as an export shows it. `project` is '' for none; `date` is the day of the export. */
export type Snapshot = { title: string; project: string; respondents: string[]; date: string; items: ExportItem[] }

/** The Questionnaire as it is now, for the renderers. */
export function snapshot(id: number): Snapshot {
  const titles = (name: string) => {
    const slot = slotsOf('questionnaire').find((s) => s.name === name)
    return slot ? slotRecords(slot, id).map((r) => r.title) : []
  }
  return {
    title: getRecord('questionnaire', id)?.title ?? '',
    project: titles('Project').join(', '),
    respondents: titles('Respondents'),
    date: today(),
    items: listItems(id),
  }
}

const LINE = '_______'

// The facts under the title, those with something in them.
const facts = (s: Snapshot): [string, string][] =>
  (
    [
      ['Project', s.project],
      ['Respondents', s.respondents.join(', ')],
      ['Date', s.date],
    ] as [string, string][]
  ).filter(([, value]) => value)

// The Items in order, numbered from 1 across sections, each with the section heading where it changes.
const numbered = (items: ExportItem[]) =>
  items.map((item, i) => ({ item, n: i + 1, heading: item.section && item.section !== items[i - 1]?.section ? item.section : '' }))

// A scale's five steps, the ends labelled.
const steps = (item: ExportItem) =>
  ([1, 2, 3, 4, 5] as const).map((n) => {
    const label = n === 1 ? item.scaleLow : n === 5 ? item.scaleHigh : null
    return { n, text: label ? `${n} (${label})` : String(n) }
  })

// What an answer area shows: boxes (ticked or not), a line or a text, and the markdown under the boxes.
// `lines` blank lines to write on, the last followed by `suffix` (a unit, or what to write).
type Area = { boxes?: { text: string; ticked: boolean }[]; line?: string; lines?: number; suffix?: string; markdown?: string }

function area(item: ExportItem, answered: boolean): Area {
  const a = answered ? item.answer : null
  const unit = item.unit ? ` ${item.unit}` : ''
  switch (item.answerType) {
    case 'short_text':
    case 'long_text': {
      const text = a && 'text' in a ? a.text.trim() : ''
      if (!text) return { lines: item.answerType === 'long_text' ? 3 : 1 }
      return item.answerType === 'long_text' ? { markdown: text } : { line: text }
    }
    case 'yes_no': {
      const yes = a && 'yes' in a ? a.yes : null
      const comment = a && 'yes' in a ? (a.comment ?? '').trim() : ''
      return {
        boxes: [
          { text: 'Yes', ticked: yes === true },
          { text: 'No', ticked: yes === false },
        ],
        ...(comment ? { markdown: comment } : {}),
      }
    }
    case 'single_choice':
    case 'multi_choice': {
      const chosen = !a ? [] : 'choices' in a ? a.choices : 'choice' in a ? [a.choice] : []
      const other = a && ('choice' in a || 'choices' in a) ? (a.other ?? '').trim() : ''
      const boxes = item.options.map((o) => ({ text: o, ticked: chosen.includes(o) }))
      if (item.allowOther) boxes.push({ text: `Other: ${other || LINE}`, ticked: !!other })
      return { boxes }
    }
    case 'number':
      return a && 'number' in a ? { line: `${a.number}${unit}` } : { lines: 1, suffix: unit }
    case 'date':
      return a && 'date' in a ? { line: a.date } : { lines: 1, suffix: ' (date)' }
    case 'scale': {
      const at = a && 'scale' in a ? a.scale : null
      return { boxes: steps(item).map((s) => ({ text: s.text, ticked: s.n === at })) }
    }
  }
}

/** The Questionnaire as Markdown: blank, with `- [ ]` boxes and `_______` lines, or with its answers filled in. */
export function markdown(s: Snapshot, { answers }: { answers: boolean }): string {
  const parts = [`# ${s.title}`]
  const known = facts(s)
  if (known.length) parts.push(known.map(([label, value]) => `- **${label}:** ${value}`).join('\n'))
  return [...parts, itemsMarkdown(s.items, { answers })].filter(Boolean).join('\n\n') + '\n'
}

/** The Items alone as Markdown, as `markdown` writes them; section headings at `level` (2 is `##`). '' for none. */
export function itemsMarkdown(items: ExportItem[], { answers, level = 2 }: { answers: boolean; level?: number }): string {
  const parts: string[] = []
  for (const { item, n, heading } of numbered(items)) {
    if (heading) parts.push(`${'#'.repeat(level)} ${heading}`)
    parts.push(`**${n}. ${item.text}**` + (item.help ? `\n_${item.help}_` : ''))
    const { boxes, line, lines, suffix = '', markdown: text } = area(item, answers)
    if (boxes) parts.push(boxes.map((b) => `- [${b.ticked ? 'x' : ' '}] ${b.text}`).join('\n'))
    if (line) parts.push(line)
    if (lines) parts.push(Array(lines).fill(LINE).join('\n') + suffix)
    if (text) parts.push(portableImages(text))
  }
  return parts.join('\n\n')
}

// What an email question asks for, after the question.
function hint(item: ExportItem): string {
  switch (item.answerType) {
    case 'single_choice':
      return ' (pick one)'
    case 'multi_choice':
      return ' (pick any)'
    case 'number':
      return item.unit ? ` (${item.unit})` : ' (a number)'
    case 'date':
      return ' (date)'
    case 'scale':
      return ` (1 = ${item.scaleLow || 'lowest'}, 5 = ${item.scaleHigh || 'highest'})`
    default:
      return ''
  }
}

/**
 * The Questionnaire as plain text to paste into an email or a chat ahead of a meeting: numbered questions,
 * their options indented under them, and a closing line inviting replies inline. Always blank.
 */
export function emailText(s: Snapshot): string {
  const lines = [s.title, ...facts(s).map(([label, value]) => `${label}: ${value}`), '']
  for (const { item, n, heading } of numbered(s.items)) {
    if (heading) lines.push(heading.toUpperCase(), '')
    lines.push(`${n}. ${item.text}${hint(item)}`)
    if (item.help) lines.push(`   ${item.help}`)
    const options =
      item.answerType === 'yes_no'
        ? ['Yes', 'No']
        : item.answerType === 'single_choice' || item.answerType === 'multi_choice'
          ? [...item.options, ...(item.allowOther ? ['Other: ...'] : [])]
          : []
    lines.push(...options.map((o) => `   - ${o}`), '')
  }
  lines.push('Please reply inline: write your answer under each question.', '')
  return lines.join('\n')
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * The print view's HTML: the title, the facts, the sections and the numbered questions, with ☐/☑ boxes for
 * Yes/No, choices and the scale, answer lines for the blanks, and markdown answers rendered as notes are.
 * Safe for `v-html`; an Image comes out as `<img data-image>` for `vImages` to fill.
 */
export function printHtml(s: Snapshot, { answers }: { answers: boolean }): string {
  const out = [`<h1>${escape(s.title)}</h1>`]
  const known = facts(s)
  if (known.length)
    out.push(`<dl class="print-facts">${known.map(([l, v]) => `<div><dt>${l}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl>`)
  for (const { item, n, heading } of numbered(s.items)) {
    if (heading) out.push(`<h2>${escape(heading)}</h2>`)
    const { boxes, line, lines, suffix = '', markdown: text } = area(item, answers)
    const body = [`<p class="print-question"><span>${n}.</span> ${escape(item.text)}</p>`]
    if (item.help) body.push(`<p class="print-help">${escape(item.help)}</p>`)
    if (boxes)
      body.push(
        `<ul class="print-boxes">${boxes.map((b) => `<li><span aria-hidden="true">${b.ticked ? '☑' : '☐'}</span> ${escape(b.text)}</li>`).join('')}</ul>`,
      )
    if (line) body.push(`<p class="print-answer">${escape(line)}</p>`)
    for (let i = 1; i <= (lines ?? 0); i++) body.push(`<p class="print-line">${i === lines ? escape(suffix.trim()) : ''}</p>`)
    if (text) body.push(`<div class="print-answer markdown">${renderMarkdown(text)}</div>`)
    out.push(`<section class="print-item">${body.join('')}</section>`)
  }
  return out.join('\n')
}
