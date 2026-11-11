import { listRecords } from './records'

// The Acronym quiz: flashcards for one sitting. Nothing about it is saved.

export type QuizCard = { id: number; title: string; expansion: string; notes: string }

/** The cards still to get right, the one being asked first, and how many there were at the start. */
export type Quiz = { queue: QuizCard[]; total: number }

/** The Acronyms a quiz can ask: those with an expansion. */
export const quizCards = (): QuizCard[] =>
  listRecords('acronym')
    .filter((a) => String(a.expansion ?? '').trim())
    .map((a) => ({ id: a.id, title: a.title, expansion: String(a.expansion), notes: a.notes }))

/** A quiz over the cards in a random order. */
export function startQuiz(cards: readonly QuizCard[], random = Math.random): Quiz {
  const queue = [...cards]
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
  }
  return { queue, total: queue.length }
}

/** The quiz after the card being asked is answered: a known card is done, an unknown one comes back last. */
export function answerCard({ queue: [asked, ...rest], total }: Quiz, knew: boolean): Quiz {
  return { queue: knew || !asked ? rest : [...rest, asked], total }
}

/** "3 of 12 known · 9 to go". */
export const quizProgress = ({ queue, total }: Quiz) =>
  `${total - queue.length} of ${total} known${queue.length ? ` · ${queue.length} to go` : ''}`
