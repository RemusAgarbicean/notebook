import { PAGE_SECTIONS } from './page-sections'
import { RELATION_SLOTS } from './relation-slots'
import RelationSlots from './RelationSlots.vue'
import RelationsSection from './RelationsSection.vue'

// Imported once by App.vue: puts the Relation slots and the Relations section on Record pages.
PAGE_SECTIONS.push(
  { slot: 'fields', component: RelationSlots, types: [...new Set(RELATION_SLOTS.map((s) => s.type))] },
  { slot: 'below', component: RelationsSection },
)
