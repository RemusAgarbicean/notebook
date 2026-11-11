<script setup lang="ts">
import { NotebookPen, Search } from 'lucide-vue-next'
import { computed } from 'vue'
import { openRecord } from './navigation'
import { paletteOpen } from './palette'
import { shortcut } from './platform'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, recordType, type RecordType } from './record-types'
import { rows, todaysLog } from './records'
import { LABEL } from './relation-slots'

// The landing page: a search box that opens the palette, then five cards.
type Row = { type: RecordType; id: number; title: string; grey?: string | null; right?: string | null }

// "Task part of Project", by label id because the label can be renamed.
const IN_PROJECT = `r.from_type = 'task' and r.label_id = ${LABEL.partOf} and r.to_type = 'project'`
const LATEST = 8

const cards = computed<{ key: string; title: string; type?: RecordType; empty: string; rows: Row[] }[]>(() => [
  {
    key: 'task',
    type: 'task',
    title: 'Open Tasks',
    empty: 'No open Tasks.',
    rows: rows<Row>(
      `select 'task' as type, t.id, t.title, t.due as right,
         (select p.title from relation r join project p on p.id = r.to_id
          where ${IN_PROJECT} and r.from_id = t.id order by p.title collate nocase limit 1) as grey
       from task t where t.done = 0 order by t.due is null, t.due, t.title collate nocase, t.id`,
    ),
  },
  {
    key: 'open_question',
    type: 'open_question',
    title: 'Open questions',
    empty: 'No Open questions.',
    rows: rows<Row>(
      `select 'open_question' as type, id, title from open_question
       where status = 'open' order by title collate nocase, id`,
    ),
  },
  {
    key: 'journal_entry',
    type: 'journal_entry',
    title: 'Journal',
    empty: 'No Journal entries yet.',
    rows: rows<Row>(
      `select 'journal_entry' as type, id, title, date as right from journal_entry
       order by date desc, id desc limit ${LATEST}`,
    ),
  },
  {
    key: 'recent',
    title: 'Recently edited',
    empty: 'Nothing edited yet.',
    rows: rows<Row>(
      `select * from (${RECORD_TYPES.map(({ type }) => `select '${type}' as type, id, title, updated_at from ${type}`).join(
        ' union all ',
      )}) order by updated_at desc limit ${LATEST}`,
    ).map((r) => ({ ...r, right: RECORD_FIELDS[r.type].singular })),
  },
  {
    key: 'project',
    type: 'project',
    title: 'Active Projects',
    empty: 'No active Projects.',
    rows: rows<Row & { open: number }>(
      `select 'project' as type, p.id, p.title,
         (select count(*) from relation r join task t on t.id = r.from_id
          where ${IN_PROJECT} and r.to_id = p.id and t.done = 0) as open
       from project p where p.status = 'active' order by p.title collate nocase, p.id`,
    ).map((r) => ({ ...r, right: `${r.open} open ${r.open === 1 ? 'Task' : 'Tasks'}` })),
  },
])
</script>

<template>
  <main data-testid="home" class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <button
        type="button"
        data-testid="home-search"
        class="flex h-12 w-full items-center gap-3 rounded-lg border bg-background px-4 text-base text-muted-foreground hover:bg-accent"
        @click="paletteOpen = true"
      >
        <Search class="size-5" />
        <span class="flex-1 text-left">What do you want to find?</span>
        <kbd class="rounded border px-1.5 font-sans text-xs">{{ shortcut('K') }}</kbd>
      </button>

      <div class="grid gap-4 md:grid-cols-2">
        <section
          v-for="c in cards"
          :key="c.key"
          :aria-labelledby="`home-card-${c.key}`"
          class="rounded-lg border bg-card p-3 text-card-foreground"
        >
          <h2 :id="`home-card-${c.key}`" class="flex items-center gap-2 px-2 pb-2 font-semibold">
            <component :is="recordType(c.type).icon" v-if="c.type" class="size-4 text-muted-foreground" />
            {{ c.title }}
            <button
              v-if="c.key === 'journal_entry'"
              type="button"
              data-testid="todays-log"
              title="Open today's Journal entry of kind log, or start it"
              class="ml-auto flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent"
              @click="openRecord('journal_entry', todaysLog())"
            >
              <NotebookPen class="size-3.5" />
              Today's log
            </button>
          </h2>
          <ul v-if="c.rows.length" class="max-h-72 overflow-y-auto">
            <li v-for="r in c.rows" :key="`${r.type}:${r.id}`">
              <button
                type="button"
                :data-testid="`home-${c.key}`"
                class="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-accent"
                @click="openRecord(r.type, r.id)"
              >
                <span class="truncate">{{ r.title }}</span>
                <!-- No base width: the title keeps its room and the grey text gets what is left. -->
                <span v-if="r.grey" class="w-0 min-w-8 flex-1 truncate text-xs text-muted-foreground">{{ r.grey }}</span>
                <span v-if="r.right" class="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{{ r.right }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="px-2 py-1 text-muted-foreground">{{ c.empty }}</p>
        </section>
      </div>
    </div>
  </main>
</template>
