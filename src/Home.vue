<script setup lang="ts">
import { CircleAlert, Pin, Search } from 'lucide-vue-next'
import { computed, type Component } from 'vue'
import HomeRows from './HomeRows.vue'
import { openRecord } from './navigation'
import { paletteOpen } from './palette'
import { pinnedRecords } from './pins'
import { shortcut } from './platform'
import QuickTask from './QuickTask.vue'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, recordType, type RecordType } from './record-types'
import { incompleteRecords, rows, textRows } from './records'
import { FIRST_PROJECT_SQL, IN_PROJECT_SQL } from './relations'
import TaskRow from './TaskRow.vue'
import TodayStrip from './TodayStrip.vue'

// The landing page: a search box that opens the palette, the Today strip, then the cards.
type Row = { type: RecordType; id: number; title: string; grey?: string | null; right?: string | null }

const LATEST = 8

type Card = { key: string; title: string; type?: RecordType; icon?: Component; empty: string; rows: Row[] }
const cards = computed<Card[]>(() => [
  // Only there while a Record is pinned, or has an empty required field.
  ...[
    {
      key: 'pinned',
      title: 'Pinned',
      icon: Pin,
      empty: '',
      rows: pinnedRecords().map((r) => ({ ...r, right: RECORD_FIELDS[r.type].singular })),
    },
    {
      key: 'incomplete',
      title: 'Needs attention',
      icon: CircleAlert,
      empty: '',
      rows: incompleteRecords().map((r) => ({ ...r, right: `${r.missing} is empty` })),
    },
  ].filter((c) => c.rows.length),
  {
    key: 'task',
    type: 'task',
    title: 'Open Tasks',
    empty: 'No open Tasks.',
    rows: rows<Row>(
      `select 'task' as type, t.id, t.title, t.due as right, ${FIRST_PROJECT_SQL} as grey
       from task t where t.done = 0 order by t.due is null, t.due, t.title collate nocase, t.id`,
    ),
  },
  {
    key: 'open_question',
    type: 'open_question',
    title: 'Open questions',
    empty: 'Nothing waiting for an answer.',
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
    // A notes edit moves a Record up here too.
    rows: textRows<Row>(
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
      // Counted in one pass: relation has no index on its `to` end, so a count per Project would read it once per Project.
      `select 'project' as type, p.id, p.title, coalesce(o.n, 0) as open
       from project p left join (
         select r.to_id as id, count(*) as n from relation r join task t on t.id = r.from_id
         where ${IN_PROJECT_SQL} and t.done = 0 group by r.to_id
       ) o on o.id = p.id
       where p.status = 'active' order by p.title collate nocase, p.id`,
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

      <TodayStrip />

      <div class="grid gap-4 md:grid-cols-2">
        <section
          v-for="c in cards"
          :key="c.key"
          :aria-labelledby="`home-card-${c.key}`"
          class="rounded-lg border bg-card p-3 text-card-foreground"
        >
          <h2 :id="`home-card-${c.key}`" class="flex items-center gap-2 px-2 pb-2 font-semibold">
            <component
              :is="c.type ? recordType(c.type).icon : c.icon"
              v-if="c.type || c.icon"
              class="size-4 text-muted-foreground"
            />
            {{ c.title }}
          </h2>
          <HomeRows v-if="c.rows.length" v-slot="{ row: r }" :rows="c.rows">
            <TaskRow
              v-if="c.key === 'task'"
              :id="r.id"
              data-testid="home-task"
              :title="r.title"
              :due="r.right"
              :project="r.grey"
            />
            <button
              v-else
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
          </HomeRows>
          <p v-else class="px-2 py-1 text-muted-foreground">{{ c.empty }}</p>
          <QuickTask v-if="c.key === 'task'" />
        </section>
      </div>
    </div>
  </main>
</template>
