import {
  Bookmark,
  CaseUpper,
  CircleQuestionMark,
  FolderKanban,
  Network,
  NotebookPen,
  Server,
  SquareCheck,
  User,
  Users,
  Workflow,
} from 'lucide-vue-next'
import type { Component } from 'vue'

// The one place that knows the Record types: table name, sidebar label, icon.
export const RECORD_TYPES = [
  { type: 'system', label: 'Systems', icon: Server },
  { type: 'acronym', label: 'Acronyms', icon: CaseUpper },
  { type: 'person', label: 'People', icon: User },
  { type: 'team', label: 'Teams', icon: Users },
  { type: 'process', label: 'Processes', icon: Workflow },
  { type: 'project', label: 'Projects', icon: FolderKanban },
  { type: 'diagram', label: 'Diagrams', icon: Network },
  { type: 'bookmark', label: 'Bookmarks', icon: Bookmark },
  { type: 'open_question', label: 'Open questions', icon: CircleQuestionMark },
  { type: 'task', label: 'Tasks', icon: SquareCheck },
  { type: 'journal_entry', label: 'Journal', icon: NotebookPen },
] as const satisfies readonly { type: string; label: string; icon: Component }[]

export type RecordType = (typeof RECORD_TYPES)[number]['type']
