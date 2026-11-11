<script setup lang="ts">
import { FilePlus, Folder, FolderOpen, NotebookText } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { openNotebook } from './notebook'
import type { NotebookFolder, NotebookStorage } from './storage'

const props = defineProps<{ storage: NotebookStorage }>()

const lastName = ref<string | null>(null)
const error = ref('')
const busy = ref(false)

onMounted(async () => (lastName.value = await props.storage.lastName()))

// `refused` is what to say when no folder comes back; left out for the picker, where that means Cancel.
async function open(getFolder: () => Promise<NotebookFolder | null>, create = false, refused = '') {
  error.value = ''
  try {
    // Not busy yet: a file chooser that is cancelled may never answer, and the buttons must keep working.
    const folder = await getFolder()
    busy.value = true
    if (!folder) error.value = refused
    else if (!(await openNotebook(folder, create))) {
      // Not reached on the fallback: a picked file always has bytes.
      error.value = `Can't find it: there is no notebook.sqlite in the folder "${folder.name}".`
      lastName.value = null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
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

      <p
        v-if="error"
        role="alert"
        class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
      >
        {{ error }}
      </p>

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
          <template v-if="lastName">
            <p class="flex items-center gap-2 text-muted-foreground">
              <Folder class="size-4 shrink-0" />
              <span class="shrink-0">Last opened:</span>
              <span class="truncate font-medium text-foreground" :title="lastName">{{ lastName }}</span>
            </p>
            <button
              type="button"
              :disabled="busy"
              :class="primary"
              @click="open(storage.reopen, false, 'The browser did not give permission to open the folder. Click Reopen and allow it, or pick the folder again.')"
            >
              Reopen
            </button>
          </template>
          <p class="text-muted-foreground">
            {{ lastName ? 'Somewhere else? Pick' : 'Pick' }} the folder that holds your notebook.sqlite.
          </p>
          <button type="button" :disabled="busy" :class="lastName ? plain : primary" @click="open(storage.pick)">
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
