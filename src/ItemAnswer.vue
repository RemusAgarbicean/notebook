<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import MarkdownField from './MarkdownField.vue'
import { setAnswer, type Answer, type Item } from './questionnaires'

// The answer control for one Item, by its Answer type, saved on every keystroke or click; plus Clear.
// Every control is labelled with the question, so a screen reader says what is being answered.
const props = defineProps<{ item: Item }>()

const error = ref('')
const owner = computed(() => ({ type: 'questionnaire' as const, id: props.item.questionnaireId }))
const a = computed(() => props.item.answer as Record<string, unknown> | null)
const name = computed(() => `answer-${props.item.id}`)

function save(answer: Answer | null) {
  try {
    setAnswer(props.item.id, answer)
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
const value = (e: Event) => (e.target as HTMLInputElement).value

// Text: an emptied answer is no answer.
const saveText = (text: string) => save(text ? { text } : null)

// Yes/No: the comment is kept when the choice changes.
const yes = computed(() => (a.value && typeof a.value.yes === 'boolean' ? a.value.yes : null))
const comment = computed(() => String(a.value?.comment ?? ''))
const saveYes = (y: boolean, c = comment.value) => save({ yes: y, ...(c ? { comment: c } : {}) })

// Choices. "Other" on a single choice is picked by its radio or by typing in it; until its text is typed nothing is saved.
const otherPicked = ref(false)
const other = computed(() => String(a.value?.other ?? ''))
const choice = computed(() => String(a.value?.choice ?? ''))
const choices = computed(() => (Array.isArray(a.value?.choices) ? (a.value.choices as string[]) : []))
const otherOn = computed(() => otherPicked.value || !!other.value)
function pickOption(o: string) {
  otherPicked.value = false
  save({ choice: o })
}
function saveOther(text: string) {
  if (props.item.answerType === 'single_choice') {
    otherPicked.value = true
    save(text ? { choice: '', other: text } : null)
  } else saveChoices(choices.value, text)
}
function toggleOption(o: string, on: boolean) {
  saveChoices(
    props.item.options.filter((x) => (x === o ? on : choices.value.includes(x))),
    other.value,
  )
}
const saveChoices = (cs: string[], o: string) => save(cs.length || o ? { choices: cs, ...(o ? { other: o } : {}) } : null)

function saveNumber(v: string) {
  if (v.trim() === '') return save(null)
  const n = Number(v)
  if (Number.isFinite(n)) save({ number: n })
}
const saveDate = (v: string) => save(v ? { date: v } : null)

function clear() {
  otherPicked.value = false
  save(null)
}

const input = 'h-8 rounded-md border bg-background px-2'
const choiceRow = 'flex min-h-7 cursor-pointer items-center gap-2'
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <input
          v-if="item.answerType === 'short_text'"
          data-testid="answer-text"
          :aria-label="item.text"
          :value="a?.text ?? ''"
          :class="[input, 'w-full']"
          @input="saveText(value($event))"
        />

        <MarkdownField
          v-else-if="item.answerType === 'long_text'"
          data-testid="answer-long"
          compact
          :label="`Answer to ${item.text}`"
          :owner="owner"
          :model-value="String(a?.text ?? '')"
          @update:model-value="saveText"
        />

        <template v-else-if="item.answerType === 'yes_no'">
          <div role="radiogroup" :aria-label="item.text" class="flex gap-4">
            <label :class="choiceRow">
              <input type="radio" data-testid="answer-yes" :name="name" :checked="yes === true" @change="saveYes(true)" />
              Yes
            </label>
            <label :class="choiceRow">
              <input type="radio" data-testid="answer-no" :name="name" :checked="yes === false" @change="saveYes(false)" />
              No
            </label>
          </div>
          <MarkdownField
            v-if="yes !== null"
            data-testid="answer-comment"
            compact
            :label="`Comment on ${item.text}`"
            :owner="owner"
            :model-value="comment"
            @update:model-value="saveYes(yes!, $event)"
          />
        </template>

        <div v-else-if="item.answerType === 'single_choice'" role="radiogroup" :aria-label="item.text" class="flex flex-col">
          <label v-for="o in item.options" :key="o" :class="choiceRow">
            <input
              type="radio"
              data-testid="answer-option"
              :name="name"
              :value="o"
              :checked="!otherOn && choice === o"
              @change="pickOption(o)"
            />
            {{ o }}
          </label>
          <div v-if="item.allowOther" :class="choiceRow">
            <input
              :id="`${name}-other`"
              type="radio"
              data-testid="answer-other"
              :name="name"
              :checked="otherOn"
              @change="saveOther(other)"
            />
            <label :for="`${name}-other`">Other</label>
            <input
              data-testid="answer-other-text"
              :aria-label="`Other answer to ${item.text}`"
              :value="other"
              :class="[input, 'h-7 min-w-0 flex-1']"
              @input="saveOther(value($event))"
            />
          </div>
        </div>

        <div v-else-if="item.answerType === 'multi_choice'" role="group" :aria-label="item.text" class="flex flex-col">
          <label v-for="o in item.options" :key="o" :class="choiceRow">
            <input
              type="checkbox"
              data-testid="answer-option"
              :value="o"
              :checked="choices.includes(o)"
              @change="toggleOption(o, ($event.target as HTMLInputElement).checked)"
            />
            {{ o }}
          </label>
          <label v-if="item.allowOther" :class="choiceRow">
            Other
            <input
              data-testid="answer-other-text"
              :aria-label="`Other answer to ${item.text}`"
              :value="other"
              :class="[input, 'h-7 min-w-0 flex-1']"
              @input="saveOther(value($event))"
            />
          </label>
        </div>

        <div v-else-if="item.answerType === 'number'" class="flex items-center gap-2">
          <input
            type="number"
            data-testid="answer-number"
            :aria-label="item.text"
            :value="a?.number ?? ''"
            :class="[input, 'w-40']"
            @input="saveNumber(value($event))"
          />
          <span v-if="item.unit" class="text-muted-foreground">{{ item.unit }}</span>
        </div>

        <input
          v-else-if="item.answerType === 'date'"
          type="date"
          data-testid="answer-date"
          :aria-label="item.text"
          :value="a?.date ?? ''"
          :class="input"
          @input="saveDate(value($event))"
        />

        <div v-else-if="item.answerType === 'scale'" role="radiogroup" :aria-label="item.text" class="flex flex-wrap items-center gap-3">
          <span v-if="item.scaleLow" class="text-xs text-muted-foreground">{{ item.scaleLow }}</span>
          <label v-for="n in 5" :key="n" class="flex cursor-pointer flex-col items-center text-xs">
            <input
              type="radio"
              data-testid="answer-scale"
              :name="name"
              :value="n"
              :checked="a?.scale === n"
              :aria-label="`${n}${n === 1 && item.scaleLow ? ` (${item.scaleLow})` : ''}${n === 5 && item.scaleHigh ? ` (${item.scaleHigh})` : ''}`"
              @change="save({ scale: n as 1 | 2 | 3 | 4 | 5 })"
            />
            {{ n }}
          </label>
          <span v-if="item.scaleHigh" class="text-xs text-muted-foreground">{{ item.scaleHigh }}</span>
        </div>
      </div>

      <button
        v-if="item.answer"
        type="button"
        data-testid="answer-clear"
        :aria-label="`Clear the answer to ${item.text}`"
        title="Clear the answer"
        class="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        @click="clear"
      >
        <X class="size-4" />
      </button>
    </div>
    <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
