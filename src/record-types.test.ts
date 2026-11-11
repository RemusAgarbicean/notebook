import { FolderKanban } from 'lucide-vue-next'
import { expect, test } from 'vitest'
import { RECORD_TYPES } from './record-types'

test('there are the 11 Record types, keyed by their table names', () => {
  expect(RECORD_TYPES.map((t) => t.type).sort()).toEqual([
    'acronym',
    'bookmark',
    'diagram',
    'journal_entry',
    'open_question',
    'person',
    'process',
    'project',
    'system',
    'task',
    'team',
  ])
})

test('every Record type has its own icon, and Project uses folder-kanban', () => {
  const icons = RECORD_TYPES.map((t) => t.icon)
  expect(new Set(icons).size).toBe(11)
  expect(RECORD_TYPES.find((t) => t.type === 'project')?.icon).toBe(FolderKanban)
})
