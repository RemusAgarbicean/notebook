// The Answer types: one descriptor per type, holding everything that differs by type, so the domain,
// the export and the components ask the descriptor instead of switching on the type themselves.

export type AnswerType = 'short_text' | 'long_text' | 'yes_no' | 'single_choice' | 'multi_choice' | 'number' | 'date' | 'scale'

/** An Item's answer. Its shape follows the Item's Answer type; "Other" on a single choice is `choice: ''` plus `other`. */
export type Answer = TextAnswer | YesNoAnswer | ChoiceAnswer | ChoicesAnswer | NumberAnswer | DateAnswer | ScaleAnswer
type TextAnswer = { text: string } // short_text, long_text
type YesNoAnswer = { yes: boolean; comment?: string }
type ChoiceAnswer = { choice: string; other?: string }
type ChoicesAnswer = { choices: readonly string[]; other?: string }
type NumberAnswer = { number: number }
type DateAnswer = { date: string } // YYYY-MM-DD
type ScaleAnswer = { scale: 1 | 2 | 3 | 4 | 5 }

/** What a bank Question and an Item share: the wording and how it is answered. */
export type Wording = {
  text: string
  /** Help text under the question; '' for none. */
  help: string
  answerType: AnswerType
  /** The choices of a single or multiple choice; empty for the other types. */
  options: string[]
  /** Whether a choice also takes a free-text "Other". */
  allowOther: boolean
  /** Shown next to a number answer (users, €, GB). */
  unit: string | null
  /** The labels at the ends of a scale. */
  scaleLow: string | null
  scaleHigh: string | null
}

/** The blank line an export leaves to write on. */
export const LINE = '_______'

/**
 * What an export shows in an Item's answer area: boxes (ticked or not), a line or a text, and the markdown under
 * the boxes. `lines` blank lines to write on, the last followed by `suffix` (a unit, or what to write).
 */
export type AnswerArea = { boxes?: { text: string; ticked: boolean }[]; line?: string; lines?: number; suffix?: string; markdown?: string }

/** Everything about one Answer type. `A` is the shape of its answer. */
export type AnswerTypeInfo<A extends Answer = Answer> = {
  type: AnswerType
  /** Its name for the user. */
  label: string
  /** 'text' is typed in (and can take a follow-up's answer), 'choice' picks from options, 'value' is one value. */
  kind: 'text' | 'choice' | 'value'
  /** Whether an answer has this type's shape. */
  holds: (a: Answer) => a is A
  /** The answer, tidied, for an Item of this type; throws with a message fit for the user when it doesn't fit the options. */
  tidy: (item: Wording, a: A) => A
  /** Whether it counts as given: not an empty text or an empty choice. */
  answered: (a: A) => boolean
  /** The answer as plain text, for search and export. */
  text: (a: A) => string
  /** What an email question asks for, after the question. */
  hint: (item: Wording) => string
  /** The options an email lists under the question. */
  emailOptions: (item: Wording) => string[]
  /** The answer area of an export; `a` is null for a blank one. */
  area: (item: Wording, a: A | null) => AnswerArea
}

// Each descriptor is typed by its own answer shape, and listed as one for any Answer.
const describe = <A extends Answer>(info: AnswerTypeInfo<A>) => info as unknown as AnswerTypeInfo

const has = <K extends string>(a: Answer, key: K, type: string) => key in a && typeof (a as Record<K, unknown>)[key] === type

// "Other", when the Item allows it.
function other(item: Wording, o: string | undefined): { other?: string } {
  if (o === undefined || o === '') return {}
  if (!item.allowOther) throw new Error('This question has no "Other"')
  return { other: String(o) }
}
function option(item: Wording, o: string) {
  if (!item.options.includes(o)) throw new Error(`"${o}" is not one of the options`)
  return o
}
const otherText = (a: { other?: string } | null) => (a?.other ?? '').trim()

// Option boxes, the chosen ones ticked, and Other with its text or a line.
function optionBoxes(item: Wording, chosen: readonly string[], o: string) {
  const boxes = item.options.map((x) => ({ text: x, ticked: chosen.includes(x) }))
  if (item.allowOther) boxes.push({ text: `Other: ${o || LINE}`, ticked: !!o })
  return boxes
}
const choiceOptions = (item: Wording) => [...item.options, ...(item.allowOther ? ['Other: ...'] : [])]

// A scale's five steps, the ends labelled.
const steps = (item: Wording) =>
  ([1, 2, 3, 4, 5] as const).map((n) => {
    const label = n === 1 ? item.scaleLow : n === 5 ? item.scaleHigh : null
    return { n, text: label ? `${n} (${label})` : String(n) }
  })

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !Number.isNaN(Date.parse(s))

const text = (type: AnswerType, label: string, blankLines: number, area: (text: string) => AnswerArea) =>
  describe<TextAnswer>({
    type,
    label,
    kind: 'text',
    holds: (a): a is TextAnswer => has(a, 'text', 'string'),
    tidy: (_, a) => ({ text: a.text }),
    answered: (a) => !!a.text.trim(),
    text: (a) => a.text,
    hint: () => '',
    emailOptions: () => [],
    area: (_, a) => (a?.text.trim() ? area(a.text.trim()) : { lines: blankLines }),
  })

/** Every Answer type, in the order a type picker offers them. */
export const ANSWER_TYPES: readonly AnswerTypeInfo[] = [
  text('short_text', 'Short text', 1, (line) => ({ line })),
  text('long_text', 'Long text', 3, (markdown) => ({ markdown })),
  describe<YesNoAnswer>({
    type: 'yes_no',
    label: 'Yes/No',
    kind: 'value',
    holds: (a): a is YesNoAnswer => has(a, 'yes', 'boolean'),
    tidy: (_, a) => ({ yes: a.yes, ...(a.comment ? { comment: String(a.comment) } : {}) }),
    answered: () => true,
    text: (a) => [a.yes ? 'Yes' : 'No', a.comment].filter(Boolean).join(', '),
    hint: () => '',
    emailOptions: () => ['Yes', 'No'],
    area: (_, a) => {
      const comment = (a?.comment ?? '').trim()
      return {
        boxes: [
          { text: 'Yes', ticked: a?.yes === true },
          { text: 'No', ticked: a?.yes === false },
        ],
        ...(comment ? { markdown: comment } : {}),
      }
    },
  }),
  describe<ChoiceAnswer>({
    type: 'single_choice',
    label: 'Single choice',
    kind: 'choice',
    holds: (a): a is ChoiceAnswer => has(a, 'choice', 'string'),
    tidy: (item, a) => ({ choice: a.choice && option(item, a.choice), ...other(item, a.other) }),
    answered: (a) => !!a.choice || !!a.other?.trim(),
    text: (a) => [a.choice, a.other].filter(Boolean).join(', '),
    hint: () => ' (pick one)',
    emailOptions: choiceOptions,
    area: (item, a) => ({ boxes: optionBoxes(item, a ? [a.choice] : [], otherText(a)) }),
  }),
  describe<ChoicesAnswer>({
    type: 'multi_choice',
    label: 'Multiple choice',
    kind: 'choice',
    holds: (a): a is ChoicesAnswer => 'choices' in a && Array.isArray(a.choices),
    // In the options' order, each once.
    tidy: (item, a) => {
      const chosen = a.choices.map((o) => option(item, o))
      return { choices: item.options.filter((o) => chosen.includes(o)), ...other(item, a.other) }
    },
    answered: (a) => a.choices.length > 0 || !!a.other?.trim(),
    text: (a) => [...a.choices, a.other].filter(Boolean).join(', '),
    hint: () => ' (pick any)',
    emailOptions: choiceOptions,
    area: (item, a) => ({ boxes: optionBoxes(item, a?.choices ?? [], otherText(a)) }),
  }),
  describe<NumberAnswer>({
    type: 'number',
    label: 'Number',
    kind: 'value',
    holds: (a): a is NumberAnswer => has(a, 'number', 'number') && Number.isFinite((a as NumberAnswer).number),
    tidy: (_, a) => ({ number: a.number }),
    answered: () => true,
    text: (a) => String(a.number),
    hint: (item) => (item.unit ? ` (${item.unit})` : ' (a number)'),
    emailOptions: () => [],
    area: (item, a) => {
      const unit = item.unit ? ` ${item.unit}` : ''
      return a ? { line: `${a.number}${unit}` } : { lines: 1, suffix: unit }
    },
  }),
  describe<DateAnswer>({
    type: 'date',
    label: 'Date',
    kind: 'value',
    holds: (a): a is DateAnswer => 'date' in a && isDate(a.date),
    tidy: (_, a) => ({ date: a.date }),
    answered: () => true,
    text: (a) => a.date,
    hint: () => ' (date)',
    emailOptions: () => [],
    area: (_, a) => (a ? { line: a.date } : { lines: 1, suffix: ' (date)' }),
  }),
  describe<ScaleAnswer>({
    type: 'scale',
    label: 'Scale 1–5',
    kind: 'value',
    holds: (a): a is ScaleAnswer => 'scale' in a && ([1, 2, 3, 4, 5] as unknown[]).includes(a.scale),
    tidy: (_, a) => ({ scale: a.scale }),
    answered: () => true,
    text: (a) => String(a.scale),
    hint: (item) => ` (1 = ${item.scaleLow || 'lowest'}, 5 = ${item.scaleHigh || 'highest'})`,
    emailOptions: () => [],
    area: (item, a) => ({ boxes: steps(item).map((s) => ({ text: s.text, ticked: s.n === a?.scale })) }),
  }),
]

/** The descriptor of an Answer type; throws for one that doesn't exist. */
export function answerType(type: AnswerType): AnswerTypeInfo {
  const info = ANSWER_TYPES.find((t) => t.type === type)
  if (!info) throw new Error(`Unknown Answer type: ${type}`)
  return info
}

/** An Answer type's name for the user: "Yes/No", "Scale 1–5". */
export const answerTypeLabel = (type: AnswerType): string => answerType(type).label

/** Whether an Answer type picks from options. */
export const isChoice = (type: AnswerType) => answerType(type).kind === 'choice'

/** Whether an Answer type is typed in as text. */
export const isText = (type: AnswerType) => answerType(type).kind === 'text'

// The descriptor whose shape an answer has. Short and long text share theirs, and read the same.
const byShape = (a: Answer) => ANSWER_TYPES.find((t) => t.holds(a))

/** Whether an answer counts as given: not null, and not an empty text or an empty choice. */
export const isAnswered = (answer: Answer | null): boolean => !!answer && !!byShape(answer)?.answered(answer)

/** An answer as plain text, for search and export: "Yes, <comment>", choices joined with commas, '' for none. */
export const answerText = (answer: Answer | null): string => (answer && byShape(answer)?.text(answer)) || ''

/** The answer, tidied, if it has the shape the Item's type takes; throws with a message fit for the user otherwise. */
export function fitted(item: Wording, a: Answer): Answer {
  const info = answerType(item.answerType)
  if (!info.holds(a)) throw new Error(`That is not a ${info.label} answer`)
  return info.tidy(item, a)
}

/** The answer area an export shows for an Item; blank unless `answered`. */
export const answerArea = (item: Wording & { answer: Answer | null }, answered: boolean): AnswerArea => {
  const info = answerType(item.answerType)
  const a = answered && item.answer && info.holds(item.answer) ? item.answer : null
  return info.area(item, a)
}
