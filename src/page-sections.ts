import type { Component } from 'vue'
import AnswerFlow from './AnswerFlow.vue'
import AttachedDiagrams from './AttachedDiagrams.vue'
import { inDiagrams } from './diagram/links'
import { mentionedIn } from './mentions'
import ProjectTasks from './ProjectTasks.vue'
import RecordLinks from './RecordLinks.vue'
import type { RecordType } from './record-types'
import QuestionnaireItems from './QuestionnaireItems.vue'
import { RELATION_SLOTS } from './relation-slots'
import { projectQuestionnaires } from './relations'
import RelationSlots from './RelationSlots.vue'
import RelationsSection from './RelationsSection.vue'

/**
 * A part of the Record page added by a feature. The component gets the props
 * `type`, `id` and `record`. `fields` sections sit with the fixed fields
 * (Relation slots); `main` sections take the page's width between the fields and
 * the notes (a Questionnaire's Items); `below` sections follow the notes (Relations, Mentioned in).
 */
export type PageSection = {
  slot: 'fields' | 'main' | 'below'
  component: Component
  /** Only on these types' pages; on every page when left out. */
  types?: readonly RecordType[]
  /** Extra props for the component. */
  props?: Record<string, unknown>
}

// Shown in array order within each slot.
export const PAGE_SECTIONS: PageSection[] = [
  { slot: 'fields', component: RelationSlots, types: [...new Set(RELATION_SLOTS.map((s) => s.type))] },
  { slot: 'fields', component: AnswerFlow, types: ['open_question'] },
  // Its header holds Save Items as a set (SaveItemsAsSet.vue, from Q3).
  { slot: 'main', component: QuestionnaireItems, types: ['questionnaire'] },
  // Pictures of the Diagrams in the Diagrams slot.
  { slot: 'main', component: AttachedDiagrams, types: ['process', 'project'] },
  { slot: 'below', component: ProjectTasks, types: ['project'] },
  {
    slot: 'below',
    component: RecordLinks,
    types: ['project'],
    props: { heading: 'Questionnaires', source: projectQuestionnaires, testId: 'project-questionnaire' },
  },
  { slot: 'below', component: RelationsSection },
  {
    slot: 'below',
    component: RecordLinks,
    props: { heading: 'Mentioned in', source: mentionedIn, testId: 'mentioned-in' },
  },
  {
    slot: 'below',
    component: RecordLinks,
    props: { heading: 'In Diagrams', source: inDiagrams, testId: 'in-diagrams' },
  },
]
