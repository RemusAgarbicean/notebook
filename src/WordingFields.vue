<script lang="ts">
import type { AnswerType, Wording } from './answer-types'

/** The wording fields as a form holds them: options as one per line, the type's own fields as text. */
export type WordingForm = {
  text: string
  help: string
  answerType: AnswerType
  options: string
  allowOther: boolean
  unit: string
  scaleLow: string
  scaleHigh: string
}

/** The form for a wording, empty (a short text) when there is none. */
export const wordingForm = (w?: Wording | null): WordingForm => ({
  text: w?.text ?? '',
  help: w?.help ?? '',
  answerType: w?.answerType ?? 'short_text',
  options: w?.options.join('\n') ?? '',
  allowOther: w?.allowOther ?? false,
  unit: w?.unit ?? '',
  scaleLow: w?.scaleLow ?? '',
  scaleHigh: w?.scaleHigh ?? '',
})

/** The wording a form says, for the domain to check and tidy. */
export const formWording = (f: WordingForm): Wording => ({ ...f, options: f.options.split('\n') })
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { ANSWER_TYPES, isChoice } from './answer-types'
import { vFocus } from './dialog'

// The wording and Answer type fields that a bank Question and an Item share; the type's own fields
// (options, Other, unit, end labels) show only for that type. The `group` slot holds the field that
// differs: an Item's section or a Question's category. Test ids are `<testid>-text`, `<testid>-type`, and so on.
const props = defineProps<{ testid: string }>()
const form = defineModel<WordingForm>({ required: true })

const choice = computed(() => isChoice(form.value.answerType))
const id = (field: string) => `${props.testid}-${field}`

const input = 'h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground'
const label = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
</script>

<template>
  <label :class="label">
    Question
    <input v-model="form.text" v-focus :data-testid="id('text')" :class="input" />
  </label>
  <label :class="label">
    Help text
    <input v-model="form.help" :data-testid="id('help')" placeholder="Optional" :class="input" />
  </label>
  <div class="flex flex-wrap gap-2">
    <label :class="label" class="min-w-40 flex-1">
      Answer type
      <select v-model="form.answerType" :data-testid="id('type')" :class="input">
        <option v-for="t in ANSWER_TYPES" :key="t.type" :value="t.type">{{ t.label }}</option>
      </select>
    </label>
    <slot name="group" :label="label" :input="input" />
  </div>
  <template v-if="choice">
    <label :class="label">
      Options, one per line
      <textarea v-model="form.options" :data-testid="id('options')" rows="4" class="rounded-md border bg-background p-2 text-sm text-foreground" />
    </label>
    <label class="flex items-center gap-2 text-xs">
      <input v-model="form.allowOther" type="checkbox" :data-testid="id('allow-other')" />
      Allow "Other" with free text
    </label>
  </template>
  <label v-if="form.answerType === 'number'" :class="label">
    Unit
    <input v-model="form.unit" :data-testid="id('unit')" placeholder="users, €, GB" :class="input" class="max-w-40" />
  </label>
  <div v-if="form.answerType === 'scale'" class="flex flex-wrap gap-2">
    <label :class="label" class="flex-1">
      Label at 1
      <input v-model="form.scaleLow" :data-testid="id('scale-low')" placeholder="Low" :class="input" />
    </label>
    <label :class="label" class="flex-1">
      Label at 5
      <input v-model="form.scaleHigh" :data-testid="id('scale-high')" placeholder="High" :class="input" />
    </label>
  </div>
</template>
