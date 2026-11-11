<script setup lang="ts">
import { ref } from 'vue'
import { RECORD_FIELDS } from './record-fields'
import { RECORD_TYPES, type RecordType } from './record-types'
import { createRecord, transaction, updateRecord, type Rec } from './records'
import { LABEL } from './relation-slots'
import { addRelation } from './relations'

// An Open question's answer flow: Mark answered, Reopen, and Make Record once answered.
const props = defineProps<{ type: RecordType; id: number; record: Rec }>()

const makeType = ref<RecordType>(RECORD_TYPES[0].type)
const makeTitle = ref('')
const error = ref('')

const setStatus = (status: 'open' | 'answered') => updateRecord(props.type, props.id, { status })

// The new Record starts with just its title: nothing of the question is copied into it.
function makeRecord() {
  const title = makeTitle.value.trim()
  if (!title) return
  try {
    // Both or neither: no new Record is left behind without its Relation.
    transaction(() => {
      const made = { type: makeType.value, id: createRecord(makeType.value, title) }
      addRelation({ type: props.type, id: props.id }, LABEL.answeredBy, made)
    })
    makeTitle.value = ''
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const button = 'h-6 shrink-0 rounded-md border px-2 text-xs hover:bg-accent hover:text-accent-foreground'
const input = 'h-6 rounded-md border bg-background px-2 text-xs'
</script>

<template>
  <div class="flex min-h-8 flex-wrap items-center gap-2">
    <span class="w-28 shrink-0 text-muted-foreground">Answer</span>
    <button
      v-if="record.status !== 'answered'"
      type="button"
      data-testid="mark-answered"
      :class="button"
      @click="setStatus('answered')"
    >
      Mark answered
    </button>
    <template v-else>
      <button type="button" data-testid="reopen" :class="button" @click="setStatus('open')">Reopen</button>
      <form data-testid="make-record" class="flex flex-1 items-center gap-1" @submit.prevent="makeRecord">
        <select v-model="makeType" data-testid="make-record-type" aria-label="Type of the new Record" :class="input">
          <option v-for="t in RECORD_TYPES" :key="t.type" :value="t.type">{{ RECORD_FIELDS[t.type].singular }}</option>
        </select>
        <input
          v-model="makeTitle"
          data-testid="make-record-title"
          aria-label="Title of the new Record"
          placeholder="Title of the new Record"
          :class="[input, 'min-w-0 flex-1']"
        />
        <button type="submit" :class="button">Make Record</button>
      </form>
    </template>
    <p v-if="error" role="alert" class="w-full text-xs text-destructive">{{ error }}</p>
  </div>
</template>
