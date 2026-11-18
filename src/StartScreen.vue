<script setup lang="ts">
import { FilePlus, Folder, FolderOpen, NotebookText } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import type { NotebookFolder, NotebookStorage, RecentNotebook } from './storage'
import { openFrom, type OpenOutcome } from './switch-notebook'

const props = defineProps<{ storage: NotebookStorage }>()

const recent = ref<RecentNotebook[]>([])
const problem = ref<OpenOutcome>({ error: '' })
const busy = ref(false)

const load = async () => (recent.value = await props.storage.recent())
onMounted(load)

async function open(getFolder: () => Promise<NotebookFolder | null>, create = false, entry?: RecentNotebook) {
  problem.value = { error: '' }
  // Not busy while the chooser is open: one that is cancelled may never answer, and the buttons must keep working.
  problem.value = await openFrom(props.storage, async () => {
    const folder = await getFolder()
    busy.value = true
    return folder
  }, { create, recent: entry })
  busy.value = false
}

const reopen = (entry: RecentNotebook) => open(() => props.storage.reopen(entry.id), false, entry)

async function forget(id: string) {
  await props.storage.forget(id)
  if (problem.value.missing === id) problem.value = { error: '' }
  await load()
}

const button =
  'flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 font-medium disabled:opacity-50 [&>svg]:size-4'
// One per variant: the action most people want.
const primary = `${button} border-primary bg-primary text-primary-foreground hover:bg-primary/90`
const plain = `${button} bg-background hover:bg-accent hover:text-accent-foreground`
const card = 'flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground'
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-muted/40 p-4">
    <div class="flex w-full max-w-sm flex-col gap-4">
      <header class="flex items-center gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <NotebookText class="size-5" />
        </span>
        <div>
          <h1 class="text-xl leading-tight font-semibold tracking-tight">Notebook</h1>
          <p class="text-xs text-muted-foreground">Kept in one file on this computer: notebook.sqlite</p>
        </div>
      </header>

      <div
        v-if="problem.error"
        role="alert"
        class="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
      >
        <p>{{ problem.error }}</p>
        <button
          v-if="problem.missing"
          type="button"
          class="rounded-md border border-destructive/40 px-2 py-0.5 text-xs font-medium hover:bg-destructive/10"
          @click="forget(problem.missing)"
        >
          Remove from list
        </button>
      </div>

      <template v-if="storage.blank">
        <section class="text-muted-foreground">
          <p>
            This browser can't open folders, so nothing is saved automatically and there are no
            Backups: after editing you download notebook.sqlite yourself, as a new file each time.
          </p>
          <p class="mt-2">
            Chrome or Edge give the full experience. In Brave, enable
            <code class="rounded bg-muted px-1 text-foreground select-all">brave://flags/#file-system-access-api</code>
            and restart it.
          </p>
        </section>
        <section :class="card">
          <h2 class="font-medium">Open your Notebook</h2>
          <p class="text-muted-foreground">Pick the notebook.sqlite you downloaded last.</p>
          <button type="button" :disabled="busy" :class="primary" @click="open(storage.pick)">
            <FolderOpen />
            Open notebook.sqlite
          </button>
        </section>
        <section :class="card">
          <h2 class="font-medium">Start a new one</h2>
          <p class="text-muted-foreground">An empty Notebook, held in this tab until you download it.</p>
          <button type="button" :disabled="busy" :class="plain" @click="open(async () => storage.blank!(), true)">
            <FilePlus />
            Create new Notebook
          </button>
        </section>
      </template>
      <template v-else>
        <section :class="card">
          <h2 class="font-medium">Open your Notebook</h2>
          <ul v-if="recent.length" class="flex flex-col gap-2" aria-label="Recent Notebooks">
            <li v-for="(entry, i) in recent" :key="entry.id" data-testid="recent" class="flex flex-col gap-1">
              <p class="flex items-center gap-2 text-muted-foreground">
                <Folder class="size-4 shrink-0" />
                <span class="truncate font-medium text-foreground" :title="entry.name">{{ entry.name }}</span>
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  :disabled="busy"
                  :aria-label="`Reopen ${entry.name}`"
                  :class="i === 0 ? primary : plain"
                  @click="reopen(entry)"
                >
                  Reopen
                </button>
                <button
                  type="button"
                  :disabled="busy"
                  :aria-label="`Remove ${entry.name} from the list`"
                  :title="`Remove ${entry.name} from this list. The folder stays as it is.`"
                  class="h-9 shrink-0 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  @click="forget(entry.id)"
                >
                  Remove
                </button>
              </div>
            </li>
          </ul>
          <p class="text-muted-foreground">
            {{ recent.length ? 'Somewhere else? Pick' : 'Pick' }} the folder that holds your notebook.sqlite.
          </p>
          <button type="button" :disabled="busy" :class="recent.length ? plain : primary" @click="open(storage.pick)">
            <FolderOpen />
            Pick folder
          </button>
        </section>
        <section :class="card">
          <h2 class="font-medium">Start a new one</h2>
          <p class="text-muted-foreground">
            Pick an empty folder: the new notebook.sqlite and its Backups are kept there.
          </p>
          <button type="button" :disabled="busy" :class="plain" @click="open(storage.pick, true)">
            <FilePlus />
            Create new Notebook
          </button>
        </section>
      </template>
    </div>
  </main>
</template>
