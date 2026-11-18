<script setup lang="ts">
import { CalendarCheck, NotebookPen, Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import { waitedDays, waitedText } from './due'
import { openRecord } from './navigation'
import { recordType } from './record-types'
import { createRecord, rows, today, todaysLog } from './records'
import { LABEL } from './relation-slots'

// The act-now section at the top of Home: Due now, Journal, Ask.

const hasLog = computed(
  () => rows("select 1 from journal_entry where date = ? and kind = 'log' limit 1", [today()]).length > 0,
)

const newMeeting = () => openRecord('journal_entry', createRecord('journal_entry', '', { kind: 'meeting' }))

// Open questions with the Person to ask (the `from` end of an Ask Relation), once per Person; none gives a null Person.
type Asked = { id: number; title: string; created_at: string; person: number | null; name: string | null }
type AskGroup = { person: number | null; name: string; questions: (Asked & { waited: string })[] }
const askGroups = computed<AskGroup[]>(() => {
  const now = today()
  const groups = new Map<number | null, AskGroup>()
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
    if (!groups.has(q.person)) groups.set(q.person, { person: q.person, name: q.name ?? 'No one to ask', questions: [] })
    groups.get(q.person)!.questions.push({ ...q, waited: waitedText(waitedDays(q.created_at, now)) })
  }
  return [...groups.values()]
})

const column = 'flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground'
const heading = 'flex items-center gap-2 px-2 font-semibold'
const action = 'flex h-8 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent'
</script>

<template>
  <section data-testid="today-strip" aria-labelledby="today-strip-title" class="flex flex-col gap-2">
    <h2 id="today-strip-title" class="sr-only">Today</h2>
    <div class="grid gap-4 md:grid-cols-3">
      <section aria-labelledby="today-due-title" :class="column">
        <h3 id="today-due-title" :class="heading">
          <CalendarCheck class="size-4 text-muted-foreground" />
          Due now
        </h3>
      </section>

      <section aria-labelledby="today-journal-title" :class="column">
        <h3 id="today-journal-title" :class="heading">
          <component :is="recordType('journal_entry').icon" class="size-4 text-muted-foreground" />
          Journal
        </h3>
        <button
          type="button"
          data-testid="todays-log"
          title="Open today's Journal entry of kind log, or start it"
          :class="action"
          @click="openRecord('journal_entry', todaysLog())"
        >
          <NotebookPen class="size-4" />
          {{ hasLog ? "Open today's log" : "Start today's log" }}
        </button>
        <button
          type="button"
          data-testid="today-new-meeting"
          title="Start a Journal entry of kind meeting dated today"
          :class="action"
          @click="newMeeting"
        >
          <Plus class="size-4" />
          New meeting
        </button>
      </section>

      <section aria-labelledby="today-ask-title" :class="column">
        <h3 id="today-ask-title" :class="heading">
          <component :is="recordType('open_question').icon" class="size-4 text-muted-foreground" />
          Ask
        </h3>
        <div v-if="askGroups.length" class="flex max-h-72 flex-col gap-2 overflow-y-auto">
          <section v-for="g in askGroups" :key="g.person ?? 'none'" data-testid="today-ask-group">
            <h4 class="px-2 text-xs font-medium text-muted-foreground">
              <button
                v-if="g.person !== null"
                type="button"
                class="rounded-sm hover:text-foreground hover:underline"
                @click="openRecord('person', g.person)"
              >
                {{ g.name }}
              </button>
              <template v-else>{{ g.name }}</template>
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
