<script setup lang="ts">
import { NotebookText } from 'lucide-vue-next'
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
  busy.value = true
  try {
    const folder = await getFolder()
    if (!folder) error.value = refused
    else if (!(await openNotebook(folder, create))) {
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
  'h-8 rounded-md border px-3 font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50'
</script>

<template>
  <main class="flex h-screen items-center justify-center p-4">
    <div class="flex w-full max-w-sm flex-col gap-3">
      <h1 class="flex items-center gap-2 font-semibold">
        <NotebookText class="size-4" />
        Notebook
      </h1>

      <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>

      <template v-if="lastName">
        <p class="text-muted-foreground">
          Last opened: <span class="font-medium text-foreground">{{ lastName }}</span>
        </p>
        <button
          type="button"
          :disabled="busy"
          :class="[button, 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground']"
          @click="open(storage.reopen, false, 'The browser did not give permission to open the folder. Click Reopen and allow it, or pick the folder again.')"
        >
          Reopen
        </button>
      </template>
      <p v-else class="text-muted-foreground">
        Pick the folder that holds your notebook.sqlite, or create a new Notebook in an empty
        folder.
      </p>

      <button type="button" :disabled="busy" :class="button" @click="open(storage.pick)">
        Pick folder
      </button>
      <button type="button" :disabled="busy" :class="button" @click="open(storage.pick, true)">
        Create new Notebook
      </button>
    </div>
  </main>
</template>
