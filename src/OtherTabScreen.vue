<script setup lang="ts">
import { NotebookText } from 'lucide-vue-next'
import { tabLock } from './tab-lock'
</script>

<template>
  <!-- Looks like the start screen: same header, card and primary button. -->
  <main class="flex min-h-screen items-center justify-center bg-muted/40 p-4">
    <div class="flex w-full max-w-sm flex-col gap-4">
      <header class="flex items-center gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <NotebookText class="size-5" />
        </span>
        <h1 class="text-xl leading-tight font-semibold tracking-tight">The Notebook is open in another tab</h1>
      </header>
      <p
        v-if="tabLock.refused.value"
        role="alert"
        class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
      >
        The other tab could not save its changes, so it is still editing. Fix the save problem in
        that tab first, then click Use it here again.
      </p>
      <section class="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground">
        <p class="text-muted-foreground">
          Only one tab can edit at a time. Use it here saves the other tab and closes the Notebook
          there.
        </p>
        <button
          type="button"
          class="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90"
          @click="tabLock.useHere()"
        >
          Use it here
        </button>
      </section>
    </div>
  </main>
</template>
