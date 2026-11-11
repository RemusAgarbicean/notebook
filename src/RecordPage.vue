<script setup lang="ts">
import { CircleAlert, ExternalLink, Trash2, X } from 'lucide-vue-next'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
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
  type Patch,
  type Value,
} from './records'
import { getTemplate, templateKey, untouched } from './templates'

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
    const patch: Patch = { [name]: value }
    // A Journal entry whose notes are still untouched takes the template of its new kind.
    if (name === 'kind' && untouched(record.value?.notes ?? '')) patch.notes = getTemplate(templateKey(props.type, value))
    updateRecord(props.type, props.id, patch)
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

// Delete asks first, in a dialog.
const deleting = ref(false)
const usedIn = computed(() => (deleting.value ? inDiagrams(props).length : 0))
function remove() {
  deleting.value = false
  deleteRecord(props.type, props.id)
  current.value = null
}

const isWebUrl = (v: Value | undefined): v is string => typeof v === 'string' && /^https?:\/\//i.test(v)
const when = (iso: Value | undefined) => (iso ? new Date(String(iso)).toLocaleString() : '')

// A Record nobody has edited yet was just created: its title is ready to be typed over.
// One that already has its title (made in the palette or a picker) starts at its empty required field instead.
const title = useTemplateRef('title')
const page = useTemplateRef('page')
/** Moves the focus to the first required field that is still empty; false when there is none. */
function leadToRequired() {
  const empty = page.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  empty?.focus()
  return !!empty
}
onMounted(() => {
  const r = record.value
  if (!r) return
  const fresh = r.created_at === r.updated_at
  if (!(fresh && r.title === `New ${info.value.singular}`) && leadToRequired()) return
  if (fresh) {
    title.value?.focus()
    title.value?.select()
  }
})

const input = 'h-8 w-full rounded-md border bg-background px-2 disabled:opacity-50'
</script>

<template>
  <p v-if="!record" class="p-4 text-muted-foreground">Select a Record to see its page.</p>
  <article v-else ref="page" class="mx-auto flex max-w-3xl min-w-0 flex-col gap-4 p-6">
    <header class="flex items-center gap-2 text-muted-foreground">
      <component :is="info.icon" class="size-4" />
      <span class="flex-1">{{ info.singular }}</span>
      <button
        type="button"
        data-testid="delete-record"
        class="flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent hover:text-destructive"
        @click="deleting = true"
      >
        <Trash2 class="size-3.5" />
        Delete
      </button>
    </header>
    <ConfirmDialog
      v-if="deleting"
      data-testid="confirm-dialog"
      :title="`Delete the ${info.singular} &quot;${record.title}&quot;?`"
      confirm-label="Delete"
      destructive
      @confirm="remove"
      @cancel="deleting = false"
    >
      <p class="text-muted-foreground">
        Its Relations and Tags go with it.
        <template v-if="usedIn">
          It is used in {{ usedIn }} {{ usedIn > 1 ? 'Diagrams' : 'Diagram' }}; its Nodes there become free text.
        </template>
      </p>
    </ConfirmDialog>

    <input
      ref="title"
      data-testid="record-title"
      aria-label="Title"
      :value="record.title"
      :title="record.title"
      class="w-full rounded-md bg-transparent text-2xl font-semibold"
      @change="onChange('title', $event)"
      @keydown.enter="leadToRequired"
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
            :aria-invalid="f.required && !record[f.name] ? 'true' : undefined"
            :class="[input, 'aria-invalid:border-destructive']"
            @change="onChange(f.name, $event)"
          />
          <span
            v-if="f.required && !record[f.name]"
            class="flex shrink-0 items-center gap-1 text-xs text-destructive"
          >
            <CircleAlert class="size-3.5" />
            Required
          </span>
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
        v-bind="s.props"
      />

      <div class="flex min-h-8 items-center gap-2">
        <span class="w-28 shrink-0 text-muted-foreground">Tags</span>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span
            v-for="t in tags"
            :key="t.id"
            data-testid="record-tag"
            class="flex h-6 max-w-full items-center gap-1 rounded-md bg-secondary pl-2 pr-1 text-xs text-secondary-foreground"
          >
            <span class="truncate">{{ t.name }}</span>
            <button
              type="button"
              :aria-label="`Remove Tag ${t.name}`"
              class="shrink-0 rounded hover:bg-background"
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
      v-bind="s.props"
    />

    <footer class="border-t pt-2 text-xs text-muted-foreground">
      Created {{ when(record.created_at) }} · Updated {{ when(record.updated_at) }}
      <template v-if="record.done_at"> · Done {{ when(record.done_at) }}</template>
      <template v-if="record.answered_at"> · Answered {{ when(record.answered_at) }}</template>
    </footer>
  </article>
</template>
