<script setup lang="ts">
import { History, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { formatSize } from './backups'
import { listBackups, restoreBackup, takeBackup, type BackupFile } from './notebook'
import { manualSave } from './save-status'

// The sidebar's "Backups" button and the screen it opens: the Backups in the folder, Restore and Back up now.
const open = ref(false)
const backups = ref<BackupFile[]>([])
const pending = ref<BackupFile | null>(null)
const error = ref('')
const busy = ref(false)

// Runs one action at a time and shows why it failed. True when it worked.
async function attempt(action: () => Promise<unknown>) {
  error.value = ''
  busy.value = true
  try {
    await action()
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    return false
  } finally {
    busy.value = false
  }
}

const refresh = () => attempt(async () => (backups.value = await listBackups()))

function show() {
  open.value = true
  pending.value = null
  backups.value = []
  return refresh()
}

async function backUpNow() {
  if (await attempt(() => takeBackup('manual'))) await refresh()
}

async function restore() {
  const { name } = pending.value!
  pending.value = null
  if (await attempt(() => restoreBackup(name))) open.value = false
  // A failed attempt may still have added the Backup of the current state, or found a file gone.
  else backups.value = await listBackups().catch(() => backups.value)
}

const when = (b: BackupFile) => (b.time ? `${b.date} ${b.time}` : b.date)
const button = 'h-7 shrink-0 rounded-md border px-3 font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50'
</script>

<template>
  <button
    type="button"
    data-testid="open-backups"
    class="mb-1 flex h-7 w-full items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    @click="show"
  >
    <History class="size-4" />
    Backups
  </button>

  <div
    v-if="open"
    class="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4 text-sm text-foreground"
    @click.self="open = false"
    @keydown.esc="open = false"
  >
    <div
      data-testid="backups-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backups-title"
      class="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4"
    >
      <header class="flex items-center">
        <h2 id="backups-title" class="flex-1 font-semibold">Backups</h2>
        <button
          v-focus
          type="button"
          data-testid="close-backups"
          aria-label="Close"
          class="rounded-md p-1 hover:bg-accent"
          @click="open = false"
        >
          <X class="size-4" />
        </button>
      </header>

      <p v-if="manualSave" class="text-muted-foreground">
        This Notebook is saved by download, so there is no backups folder. Every notebook.sqlite you downloaded is a
        Backup: to go back to one, open that file from the start screen.
      </p>
      <template v-else>
        <p class="text-muted-foreground">
          Copies of the Notebook kept in the folder's backups: one per day, and one before each import, upgrade and
          restore. Restoring one replaces everything in the Notebook with what the Backup holds.
        </p>

        <table v-if="backups.length" class="w-full">
          <thead class="text-left text-xs text-muted-foreground">
            <tr>
              <th class="font-medium">Date</th>
              <th class="font-medium">Time</th>
              <th class="font-medium">Kind</th>
              <th class="px-2 text-right font-medium">Size</th>
              <th><span class="sr-only">Restore</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in backups" :key="b.name" data-testid="backup-row" :title="b.name" class="border-t">
              <td class="py-1 pr-2 tabular-nums">{{ b.date }}</td>
              <td class="py-1 pr-2 tabular-nums">{{ b.time }}</td>
              <td class="py-1 pr-2">{{ b.kind }}</td>
              <td class="px-2 py-1 text-right tabular-nums">{{ formatSize(b.size) }}</td>
              <td class="py-1 text-right">
                <button
                  type="button"
                  data-testid="restore-backup"
                  :disabled="busy"
                  :aria-label="`Restore the Backup of ${when(b)}`"
                  :class="button"
                  @click="pending = b"
                >
                  Restore
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!busy" class="text-muted-foreground">No Backups yet.</p>

        <div
          v-if="pending"
          data-testid="confirm-restore"
          role="alertdialog"
          aria-labelledby="confirm-restore-title"
          class="flex flex-col gap-2 rounded-md border border-destructive/50 p-3"
        >
          <p id="confirm-restore-title" class="font-medium">
            Restore the Backup of {{ when(pending) }} ({{ pending.kind }})?
          </p>
          <p class="text-muted-foreground">
            Everything in the Notebook is replaced with what this Backup holds. The Notebook as it is now is backed up
            first, so this can be undone from this screen.
          </p>
          <div class="flex justify-end gap-2">
            <button v-focus type="button" :class="button" @click="pending = null">Cancel</button>
            <button
              type="button"
              data-testid="confirm-restore-yes"
              class="h-7 rounded-md bg-destructive px-3 font-medium text-white hover:bg-destructive/90"
              @click="restore"
            >
              Restore
            </button>
          </div>
        </div>
      </template>

      <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>

      <footer v-if="!manualSave" class="flex justify-end border-t pt-3">
        <button type="button" data-testid="backup-now" :disabled="busy" :class="button" @click="backUpNow">
          Back up now
        </button>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
// The dialog takes the focus when it opens, so Escape closes it.
const vFocus = { mounted: (el: HTMLElement) => el.focus() }
</script>
