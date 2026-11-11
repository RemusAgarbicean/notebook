<script setup lang="ts">
import { ExternalLink, Trash2, X } from 'lucide-vue-next'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import DiagramCanvas from './diagram/DiagramCanvas.vue'
import { inDiagrams } from './diagram/links'
import MarkdownField from './MarkdownField.vue'
import { current } from './navigation'
import { PAGE_SECTIONS } from './page-sections'
import { RECORD_FIELDS } from './record-fields'
import { recordType, type RecordType } from './record-types'
import {
  addTag,
  deleteRecord,
  getRecord,
  listTags,
  recordTags,
  removeTag,
  updateRecord,
  type Value,
} from './records'

// The parent keys this component by Record, so local state starts fresh for each one.
const props = defineProps<{ type: RecordType; id: number }>()

const record = computed(() => getRecord(props.type, props.id))
const info = computed(() => ({ ...recordType(props.type), ...RECORD_FIELDS[props.type] }))
const fields = computed(() => info.value.fields.filter((f) => f.kind !== 'hidden'))
const tags = computed(() => recordTags(props.type, props.id))
const sections = (slot: 'fields' | 'below') =>
  PAGE_SECTIONS.filter((s) => s.slot === slot && (!s.types || s.types.includes(props.type)))

const error = ref('')

function save(name: string, value: Value | boolean, input?: HTMLInputElement) {
  try {
    updateRecord(props.type, props.id, { [name]: value })
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    // The refused value is not what is saved, so show the saved one again.
    if (input) input.value = String(record.value?.[name] ?? '')
  }
}
const onChange = (name: string, e: Event) => {
  const input = e.target as HTMLInputElement
  save(name, input.type === 'checkbox' ? input.checked : input.value, input)
}

function addTagFrom(e: Event) {
  const input = e.target as HTMLInputElement
  addTag(props.type, props.id, input.value)
  input.value = ''
}

function remove() {
  const n = inDiagrams(props).length
  const used = n ? ` It is used in ${n} Diagram${n > 1 ? 's' : ''}; its Nodes there become plain text.` : ''
  if (!confirm(`Delete the ${info.value.singular} "${record.value!.title}"? Its Relations and Tags go with it.${used}`)) return
  deleteRecord(props.type, props.id)
  current.value = null
}

const isWebUrl = (v: Value | undefined): v is string => typeof v === 'string' && /^https?:\/\//i.test(v)
const when = (iso: Value | undefined) => (iso ? new Date(String(iso)).toLocaleString() : '')

// A Record nobody has edited yet was just created: its title is ready to be typed over.
const title = useTemplateRef('title')
onMounted(() => {
  if (record.value && record.value.created_at === record.value.updated_at) title.value?.select()
})

const input = 'h-8 w-full rounded-md border bg-background px-2 disabled:opacity-50'
</script>

<template>
  <p v-if="!record" class="p-4 text-muted-foreground">Select a Record to see its page.</p>
  <article v-else class="mx-auto flex max-w-3xl flex-col gap-4 p-6">
    <header class="flex items-center gap-2 text-muted-foreground">
      <component :is="info.icon" class="size-4" />
      <span class="flex-1">{{ info.singular }}</span>
      <button
        type="button"
        data-testid="delete-record"
        class="flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent hover:text-destructive"
        @click="remove"
      >
        <Trash2 class="size-3.5" />
        Delete
      </button>
    </header>

    <input
      ref="title"
      data-testid="record-title"
      aria-label="Title"
      :value="record.title"
      class="w-full rounded-md bg-transparent text-2xl font-semibold"
      @change="onChange('title', $event)"
    />
    <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>

    <!-- Fixed fields as tight label/value rows, then the sections that sit with them. -->
    <div class="flex flex-col gap-1">
      <template v-for="f in fields" :key="f.name">
        <MarkdownField
          v-if="f.kind === 'markdown'"
          :data-testid="`field-${f.name}`"
          :label="f.label"
          :model-value="String(record[f.name] ?? '')"
          @update:model-value="save(f.name, $event)"
        />
        <label v-else class="flex min-h-8 items-center gap-2">
          <span class="w-28 shrink-0 text-muted-foreground">{{ f.label }}</span>
          <input
            v-if="f.kind === 'checkbox'"
            type="checkbox"
            :data-testid="`field-${f.name}`"
            :checked="!!record[f.name]"
            class="size-4"
            @change="onChange(f.name, $event)"
          />
          <select
            v-else-if="f.kind === 'choice'"
            :data-testid="`field-${f.name}`"
            :value="record[f.name]"
            :class="input"
            @change="onChange(f.name, $event)"
          >
            <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
          </select>
          <input
            v-else
            :type="f.kind"
            :data-testid="`field-${f.name}`"
            :value="record[f.name]"
            :required="f.required"
            :class="input"
            @change="onChange(f.name, $event)"
          />
          <span v-if="f.required && !record[f.name]" class="shrink-0 text-xs text-destructive">Required</span>
          <a
            v-if="f.kind === 'url' && isWebUrl(record[f.name])"
            :href="String(record[f.name])"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Open ${f.label}`"
            class="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink class="size-4" />
          </a>
        </label>
      </template>

      <component
        :is="s.component"
        v-for="(s, i) in sections('fields')"
        :key="i"
        :type="type"
        :id="id"
        :record="record"
      />

      <div class="flex min-h-8 items-center gap-2">
        <span class="w-28 shrink-0 text-muted-foreground">Tags</span>
        <div class="flex flex-1 flex-wrap items-center gap-1">
          <span
            v-for="t in tags"
            :key="t.id"
            data-testid="record-tag"
            class="flex h-6 items-center gap-1 rounded-md bg-secondary pl-2 pr-1 text-xs text-secondary-foreground"
          >
            {{ t.name }}
            <button
              type="button"
              :aria-label="`Remove Tag ${t.name}`"
              class="rounded hover:bg-background"
              @click="removeTag(type, id, t.id)"
            >
              <X class="size-3" />
            </button>
          </span>
          <input
            data-testid="tag-input"
            aria-label="Add Tag"
            placeholder="Add Tag"
            list="all-tags"
            class="h-6 w-28 rounded-md border bg-background px-2 text-xs"
            @keydown.enter="addTagFrom"
          />
          <datalist id="all-tags">
            <option v-for="t in listTags()" :key="t.id" :value="t.name" />
          </datalist>
        </div>
      </div>
    </div>

    <DiagramCanvas v-if="type === 'diagram'" :id="id" :record="record" />

    <MarkdownField
      data-testid="notes"
      label="Notes"
      :model-value="record.notes"
      @update:model-value="save('notes', $event)"
    />

    <component
      :is="s.component"
      v-for="(s, i) in sections('below')"
      :key="i"
      :type="type"
      :id="id"
      :record="record"
    />

    <footer class="border-t pt-2 text-xs text-muted-foreground">
      Created {{ when(record.created_at) }} · Updated {{ when(record.updated_at) }}
      <template v-if="record.done_at"> · Done {{ when(record.done_at) }}</template>
      <template v-if="record.answered_at"> · Answered {{ when(record.answered_at) }}</template>
    </footer>
  </article>
</template>
