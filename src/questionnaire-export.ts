import { answerArea, answerType, LINE } from './answer-types'
import { portableImages } from './images'
import { renderMarkdown } from './markdown'
import { listItems, respondents, type Item } from './questionnaires'
import { getRecord, today } from './records'
import { LABEL, slotsOf } from './relation-slots'
import { slotRecords } from './relations'

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
  const project = slotsOf('questionnaire').find((s) => s.labelId === LABEL.partOf)!
  return {
    title: getRecord('questionnaire', id)?.title ?? '',
    project: slotRecords(project, id)
      .map((r) => r.title)
      .join(', '),
    respondents: respondents(id).map((r) => r.title),
    date: today(),
    items: listItems(id),
  }
}

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
    const { boxes, line, lines, suffix = '', markdown: text } = answerArea(item, answers)
    if (boxes) parts.push(boxes.map((b) => `- [${b.ticked ? 'x' : ' '}] ${b.text}`).join('\n'))
    if (line) parts.push(line)
    if (lines) parts.push(Array(lines).fill(LINE).join('\n') + suffix)
    if (text) parts.push(portableImages(text))
  }
  return parts.join('\n\n')
}

/**
 * The Questionnaire as plain text to paste into an email or a chat ahead of a meeting: numbered questions,
 * their options indented under them, and a closing line inviting replies inline. Always blank.
 */
export function emailText(s: Snapshot): string {
  const lines = [s.title, ...facts(s).map(([label, value]) => `${label}: ${value}`), '']
  for (const { item, n, heading } of numbered(s.items)) {
    if (heading) lines.push(heading.toUpperCase(), '')
    const info = answerType(item.answerType)
    lines.push(`${n}. ${item.text}${info.hint(item)}`)
    if (item.help) lines.push(`   ${item.help}`)
    lines.push(...info.emailOptions(item).map((o) => `   - ${o}`), '')
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
    const { boxes, line, lines, suffix = '', markdown: text } = answerArea(item, answers)
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
