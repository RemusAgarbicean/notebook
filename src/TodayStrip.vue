<script setup lang="ts">
import { CalendarCheck, NotebookPen, Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import { openRecord } from './navigation'
import { recordType } from './record-types'
import { createRecord, rows, today, todaysLog, todaysLogId } from './records'
import { LABEL } from './relation-slots'
import { FIRST_PROJECT_SQL } from './relations'
import TaskRow from './TaskRow.vue'
import { waitedDays, waitedText } from './waited'

// The act-now section at the top of Home: Due now, Journal, Ask.

// Open Tasks overdue or due today, oldest due date first, with the first Project each is part of.
type Due = { id: number; title: string; due: string; project: string | null }
const dueNow = computed(() =>
  rows<Due>(
    `select t.id, t.title, t.due, ${FIRST_PROJECT_SQL} as project
     from task t where t.done = 0 and t.due is not null and t.due <= ?
     order by t.due, t.title collate nocase, t.id`,
    [today()],
  ),
)

const hasLog = computed(() => todaysLogId() !== null)

const newMeeting = () => openRecord('journal_entry', createRecord('journal_entry', '', { kind: 'meeting' }))

// Open questions grouped by the Person to ask (the `from` end of an Ask Relation), once per Person,
// then one group of the questions with no one to ask.
type Asked = { id: number; title: string; created_at: string; person: number | null; name: string | null }
type Question = Asked & { waited: string }
type AskGroup = { key: string; questions: Question[] } & (
  | { kind: 'person'; person: number; name: string }
  | { kind: 'no-one' }
)
const askGroups = computed<AskGroup[]>(() => {
  const now = today()
  const groups = new Map<string, AskGroup>()
  const asked = rows<Asked>(
    `select q.id, q.title, q.created_at, p.id as person, p.title as name
     from open_question q
     left join relation r on r.to_type = 'open_question' and r.to_id = q.id
       and r.label_id = ${LABEL.askAbout} and r.from_type = 'person'
     left join person p on p.id = r.from_id
     where q.status = 'open'
     order by p.id is null, p.title collate nocase, p.id, q.created_at, q.id`,
  )
  for (const q of asked) {
    const key = q.person === null ? 'no-one' : `person:${q.person}`
    if (!groups.has(key))
      groups.set(
        key,
        q.person === null
          ? { key, kind: 'no-one', questions: [] }
          : { key, kind: 'person', person: q.person, name: q.name ?? '', questions: [] },
      )
    groups.get(key)!.questions.push({ ...q, waited: waitedText(waitedDays(q.created_at, now)) })
  }
  return [...groups.values()]
})

const columnClass = 'flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground'
const headingClass = 'flex items-center gap-2 px-2 font-semibold'
const actionClass = 'flex h-8 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent'
</script>

<template>
  <!-- A container, so the columns stack on Home's own width, which the sidebar narrows, not the window's. -->
  <section data-testid="today-strip" aria-labelledby="today-strip-title" class="@container flex flex-col gap-2">
    <h2 id="today-strip-title" class="sr-only">Today</h2>
    <div class="grid gap-4 @2xl:grid-cols-3">
      <section aria-labelledby="today-due-title" :class="columnClass">
        <h3 id="today-due-title" :class="headingClass">
          <CalendarCheck class="size-4 text-muted-foreground" />
          Due now
        </h3>
        <ul v-if="dueNow.length" class="flex max-h-72 flex-col overflow-y-auto">
          <li v-for="t in dueNow" :key="t.id">
            <TaskRow
              :id="t.id"
              data-testid="today-due"
              push-testid="today-push"
              :title="t.title"
              :due="t.due"
              :project="t.project"
              where="Due now"
            />
          </li>
        </ul>
        <p v-else data-testid="today-due-empty" class="px-2 py-1 text-muted-foreground">Nothing due today.</p>
      </section>

      <section aria-labelledby="today-journal-title" :class="columnClass">
        <h3 id="today-journal-title" :class="headingClass">
          <component :is="recordType('journal_entry').icon" class="size-4 text-muted-foreground" />
          Journal
        </h3>
        <button
          type="button"
          data-testid="todays-log"
          title="Open today's Journal entry of kind log, or start it"
          :class="actionClass"
          @click="openRecord('journal_entry', todaysLog())"
        >
          <NotebookPen class="size-4" />
          {{ hasLog ? "Open today's log" : "Start today's log" }}
        </button>
        <button
          type="button"
          data-testid="today-new-meeting"
          title="Start a Journal entry of kind meeting dated today"
          :class="actionClass"
          @click="newMeeting"
        >
          <Plus class="size-4" />
          New meeting
        </button>
      </section>

      <section aria-labelledby="today-ask-title" :class="columnClass">
        <h3 id="today-ask-title" :class="headingClass">
          <component :is="recordType('open_question').icon" class="size-4 text-muted-foreground" />
          Ask
        </h3>
        <div v-if="askGroups.length" class="flex max-h-72 flex-col gap-2 overflow-y-auto">
          <section v-for="g in askGroups" :key="g.key" data-testid="today-ask-group">
            <h4 class="px-2 text-xs font-medium text-muted-foreground">
              <button
                v-if="g.kind === 'person'"
                type="button"
                class="rounded-sm hover:text-foreground hover:underline"
                @click="openRecord('person', g.person)"
              >
                {{ g.name }}
              </button>
              <template v-else>No one to ask</template>
            </h4>
            <ul>
              <li v-for="q in g.questions" :key="q.id">
                <button
                  type="button"
                  data-testid="today-ask"
                  class="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-accent"
                  @click="openRecord('open_question', q.id)"
                >
                  <span class="truncate">{{ q.title }}</span>
                  <span
                    data-testid="today-ask-waited"
                    class="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
                    >{{ q.waited }}</span
                  >
                </button>
              </li>
            </ul>
          </section>
        </div>
        <p v-else data-testid="today-ask-empty" class="px-2 py-1 text-muted-foreground">
          Nothing waiting for an answer.
        </p>
      </section>
    </div>
  </section>
</template>
