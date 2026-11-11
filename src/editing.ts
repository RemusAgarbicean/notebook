/**
 * Markdown editing comfort as plain text transforms: a text with its selection
 * in, the new text and selection out, or null when the transform has nothing to
 * do and the key should keep its normal meaning. `applyEdit` puts a result in a textarea.
 */
export type Edit = { text: string; start: number; end: number }

// A list item's start: indent, marker, and the task box when there is one.
const ITEM = /^(\s*)([-*+]|(\d+)([.)]))( +)(\[[ xX]\] +)?/
const INDENT = '    ' // enough to nest under `- ` and under `10. ` alike

const lineStart = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1
const lineEnd = (text: string, at: number) => {
  const end = text.indexOf('\n', at)
  return end < 0 ? text.length : end
}

/** Whether `at` is inside a fenced code block, where markdown means nothing. */
export function inFence(text: string, at: number): boolean {
  let open = false
  for (const line of text.slice(0, lineStart(text, at)).split('\n')) if (/^\s*(```|~~~)/.test(line)) open = !open
  return open
}

// How many times `char` repeats right before (step -1) or from (step 1) `at`.
function run(text: string, at: number, char: string, step: 1 | -1) {
  let n = 0
  for (let i = step < 0 ? at - 1 : at; text[i] === char; i += step) n++
  return n
}

/**
 * Wraps the selection in `marker` (`**`, `*` or a backtick), or unwraps it when
 * it already is. With nothing selected the caret lands between a new pair.
 */
export function toggleWrap({ text, start, end }: Edit, marker: string): Edit {
  const m = marker.length
  // A selection that takes its markers along counts as the text between them.
  const picked = text.slice(start, end)
  if (picked.length >= 2 * m && picked.startsWith(marker) && picked.endsWith(marker)) {
    start += m
    end -= m
  }
  const around = Math.min(run(text, start, marker[0], -1), run(text, end, marker[0], 1))
  // `**bold**` is not italic: one `*` is wrapped only by one star, or by the third of three.
  if (around >= m && !(marker === '*' && around === 2))
    return { text: text.slice(0, start - m) + text.slice(start, end) + text.slice(end + m), start: start - m, end: end - m }
  // Markers must touch the text to count, so the spaces a double click selects stay outside.
  const inner = text.slice(start, end)
  if (inner.trim()) {
    start += inner.length - inner.trimStart().length
    end -= inner.length - inner.trimEnd().length
  }
  return {
    text: text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end),
    start: start + m,
    end: end + m,
  }
}

/** Makes the selection a link. What still has to be typed is selected: the address, or the text when nothing was selected. */
export function insertLink({ text, start, end }: Edit): Edit {
  const label = text.slice(start, end) || 'text'
  const at = end > start ? start + label.length + 3 : start + 1
  return {
    text: `${text.slice(0, start)}[${label}](url)${text.slice(end)}`,
    start: at,
    end: at + (end > start ? 3 : label.length),
  }
}

const URL = /^https?:\/\/\S+$/i

/** Pasting a web address over selected text links the text; anything else pastes normally (null). */
export function pasteLink({ text, start, end }: Edit, pasted: string): Edit | null {
  const url = pasted.trim()
  const label = text.slice(start, end)
  if (!URL.test(url) || !label.trim() || label.includes('\n') || URL.test(label.trim()) || inFence(text, start)) return null
  const link = `[${label}](${url})`
  return { text: text.slice(0, start) + link + text.slice(end), start: start + link.length, end: start + link.length }
}

/**
 * Tab-separated text of at least two rows and two columns, every row the same
 * width (what a copied spreadsheet range is), as a markdown table whose first
 * row is the header. Null for anything else, e.g. a cell holding a line break.
 */
export function tableFromTsv(pasted: string): string | null {
  const rows = pasted
    .replace(/\r\n?/g, '\n')
    .replace(/\n$/, '')
    .split('\n')
    .map((r) => r.split('\t'))
  if (rows.length < 2 || rows[0].length < 2 || rows.some((r) => r.length !== rows[0].length)) return null
  const line = (cells: string[]) => `| ${cells.map((c) => c.trim().replace(/\|/g, '\\|')).join(' | ')} |`
  return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n')
}

/** Pasting a copied spreadsheet range inserts it as a markdown table, on lines of its own; anything else pastes normally (null). */
export function pasteTable({ text, start, end }: Edit, pasted: string): Edit | null {
  const table = tableFromTsv(pasted)
  if (!table || inFence(text, start)) return null
  const before = text.slice(0, start)
  // A table needs an empty line above it and starts at the line's start.
  const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const block = `${lead}${table}\n`
  return { text: before + block + text.slice(end), start: start + block.length, end: start + block.length }
}

/**
 * Enter in a list item starts the next one (the number one higher, a task box
 * unticked) and moves the numbers below it up; Enter in an empty item ends the
 * list. Null outside a list.
 */
export function continueList({ text, start, end }: Edit): Edit | null {
  if (start !== end || inFence(text, start)) return null
  const from = lineStart(text, start)
  const to = lineEnd(text, start)
  const item = ITEM.exec(text.slice(from, to))
  if (!item || start < from + item[0].length) return null
  if (!text.slice(from + item[0].length, to).trim())
    return { text: text.slice(0, from) + text.slice(to), start: from, end: from }

  const [, indent, bullet, number, close, gap, box] = item
  const marker = number ? `${Number(number) + 1}${close}` : bullet
  const added = `\n${indent}${marker}${gap}${box ? '[ ] ' : ''}`
  let rest = text.slice(to)
  if (number) {
    // The items after this one in the same list each move one up.
    let n = Number(number) + 1
    const lines = rest.split('\n')
    for (let i = 1; i < lines.length; i++) {
      const next = ITEM.exec(lines[i])
      const deeper = /^\s*/.exec(lines[i])![0].length > indent.length && lines[i].trim()
      if (deeper) continue
      if (!next?.[3] || next[1] !== indent || Number(next[3]) !== n) break
      lines[i] = lines[i].replace(/\d+/, String(++n))
    }
    rest = lines.join('\n')
  }
  return {
    text: text.slice(0, start) + added + text.slice(start, to) + rest,
    start: start + added.length,
    end: start + added.length,
  }
}

// Rewrites the lines the selection touches; the selection follows the text it held.
function mapLines({ text, start, end }: Edit, change: (line: string, i: number) => string): Edit {
  const from = lineStart(text, start)
  // A selection ending at a line's start does not include that line.
  const to = lineEnd(text, end > start && text[end - 1] === '\n' ? end - 1 : end)
  const lines = text.slice(from, to).split('\n')
  const changed = lines.map(change)
  const first = changed[0].length - lines[0].length
  const all = changed.join('\n').length - (to - from)
  return {
    text: text.slice(0, from) + changed.join('\n') + text.slice(to),
    // A selection that starts with the line keeps starting with it.
    start: end > start && start === from ? from : Math.max(from, start + first),
    end: Math.max(from, end + all),
  }
}

/**
 * Tab and Shift+Tab: moves the current list item, or every line of a selection
 * that spans lines, one level in or out. Null when there is nothing to move,
 * so that Tab moves the focus as it does everywhere else.
 */
export function indentLines(edit: Edit, out: boolean): Edit | null {
  const { text, start, end } = edit
  const many = text.slice(start, end).includes('\n')
  if (!many && !ITEM.test(text.slice(lineStart(text, start), lineEnd(text, start)))) return null
  const next = mapLines(edit, (line) =>
    out ? line.replace(/^(\t| {1,4})/, '') : line.trim() ? INDENT + line : line,
  )
  return next.text === text ? null : next
}

export type LineKind = 'bullet' | 'number' | 'task' | 'heading'

const KIND: Record<Exclude<LineKind, 'heading'>, RegExp> = {
  bullet: /^\s*[-*+] +(?!\[[ xX]\] )/,
  number: /^\s*\d+[.)] +/,
  task: /^\s*[-*+] +\[[ xX]\] +/,
}

/**
 * Makes the selected lines a bulleted, numbered or task list, or plain lines
 * again when they already are that list. A heading steps through `##`, `###` and none.
 */
export function toggleLines(edit: Edit, kind: LineKind): Edit {
  const { text, start, end } = edit
  const single = !text.slice(start, end).includes('\n')
  if (kind === 'heading')
    return mapLines(edit, (line) => {
      const [, hashes = '', body] = /^(?:(#{1,6}) +)?(.*)$/.exec(line)!
      if (!body.trim() && !single) return line
      return hashes.length === 2 ? `### ${body}` : hashes ? body : `## ${body}`
    })
  const from = lineStart(text, start)
  const lines = text.slice(from, lineEnd(text, end)).split('\n').filter((l) => l.trim())
  const off = lines.length > 0 && lines.every((l) => KIND[kind].test(l))
  let n = 0
  return mapLines(edit, (line) => {
    // Empty lines inside a selection stay empty; the caret's own empty line starts a list.
    if (!line.trim() && !single) return line
    const [, indent, body] = /^(\s*)(.*)$/.exec(line.replace(ITEM, '$1'))!
    if (off) return indent + body
    return `${indent}${kind === 'number' ? `${++n}.` : '-'} ${kind === 'task' ? '[ ] ' : ''}${body}`
  })
}

/** Puts `inserted` in place of the selection, the caret behind it. */
export function insertText({ text, start, end }: Edit, inserted: string): Edit {
  const at = start + inserted.length
  return { text: text.slice(0, start) + inserted + text.slice(end), start: at, end: at }
}

/** Starts a Mention at the caret: `[[`, with the selection as the text to search for. */
export function startMention({ text, start, end }: Edit): Edit {
  const at = end + 2
  return { text: `${text.slice(0, start)}[[${text.slice(start)}`, start: at, end: at }
}

/**
 * Puts an edit in a textarea the way typing would, so the browser's own undo
 * takes it back: only the part that differs is replaced, through `insertText`.
 */
export function applyEdit(el: HTMLTextAreaElement, next: Edit) {
  const old = el.value
  if (next.text !== old) {
    let a = 0
    while (a < old.length && a < next.text.length && old[a] === next.text[a]) a++
    let b = 0
    while (b < old.length - a && b < next.text.length - a && old.at(-1 - b) === next.text.at(-1 - b)) b++
    const insert = next.text.slice(a, next.text.length - b)
    el.focus()
    el.setSelectionRange(a, old.length - b)
    // execCommand is deprecated, and the one way to edit a textarea that leaves its undo history whole.
    try {
      document.execCommand(insert ? 'insertText' : 'delete', false, insert)
    } catch {
      // Falls through to the plain way below.
    }
    if (el.value !== next.text) {
      el.value = next.text
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
  el.setSelectionRange(next.start, next.end)
}
