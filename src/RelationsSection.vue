<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { openRecord } from './navigation'
import RecordPicker from './RecordPicker.vue'
import { recordType, type RecordType } from './record-types'
import type { RecordRef } from './records'
import { groupRelations, readings, relate, removeRelation } from './relations'

// The Relations section of a Record page, with "+ Relation".
const props = defineProps<{ type: RecordType; id: number; record?: unknown }>()

const own = computed<RecordRef>(() => ({ type: props.type, id: props.id }))
const groups = computed(() => groupRelations(own.value))
const choices = computed(() => readings())

const adding = ref(false)
// An index into `choices`: the two readings of a label share its id.
const choice = ref(0)
const error = ref('')

// Opening the row puts the focus on its first control.
const reading = useTemplateRef('reading')
function toggle() {
  adding.value = !adding.value
  error.value = ''
  if (adding.value) nextTick(() => reading.value?.focus())
}

function add(other: RecordRef) {
  try {
    relate(own.value, choices.value[choice.value], other)
    error.value = ''
    adding.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <section data-testid="relations" class="flex flex-col gap-2">
    <header class="flex items-center gap-2">
      <h2 class="flex-1 text-xs font-medium text-muted-foreground">Relations</h2>
      <button
        type="button"
        data-testid="add-relation"
        class="flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
        :aria-expanded="adding"
        @click="toggle"
      >
        <Plus class="size-3.5" />
        Relation
      </button>
    </header>

    <div v-if="adding" class="flex items-center gap-2">
      <select
        ref="reading"
        v-model.number="choice"
        data-testid="relation-reading"
        aria-label="Reading"
        class="h-6 rounded-md border bg-background px-1 text-xs"
      >
        <option v-for="(c, i) in choices" :key="i" :value="i">{{ c.reading }}</option>
      </select>
      <RecordPicker class="flex-1" label="Search Records" :exclude="[own]" @pick="add" />
    </div>
    <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>

    <div v-for="g in groups" :key="g.reading" data-testid="relation-group" class="flex gap-2">
      <h3 class="w-28 shrink-0 pt-1 text-muted-foreground">{{ g.reading }}</h3>
      <ul class="flex min-w-0 flex-1 flex-col">
        <li
          v-for="e in g.entries"
          :key="`${e.forward}:${e.other.type}:${e.other.id}`"
          data-testid="relation"
          class="group flex min-h-7 min-w-0 items-center gap-1"
        >
          <button
            type="button"
            class="flex min-w-0 items-center gap-2 rounded-md px-1 hover:bg-accent"
            @click="openRecord(e.other.type, e.other.id)"
          >
            <component :is="recordType(e.other.type).icon" class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ e.other.title }}</span>
          </button>
          <button
            type="button"
            :aria-label="`Remove Relation ${g.reading} ${e.other.title}`"
            class="shrink-0 rounded text-muted-foreground opacity-0 hover:bg-accent focus:opacity-100 group-hover:opacity-100"
            @click="removeRelation(e.from, e.labelId, e.to)"
          >
            <X class="size-3.5" />
          </button>
        </li>
      </ul>
    </div>
    <p v-if="!groups.length && !adding" class="text-xs text-muted-foreground">No Relations yet.</p>
  </section>
</template>
