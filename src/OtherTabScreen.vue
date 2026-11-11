<script setup lang="ts">
import { tabLock } from './tab-lock'
</script>

<template>
  <main class="flex h-screen items-center justify-center p-4">
    <div class="flex w-full max-w-sm flex-col gap-3">
      <h1 class="font-semibold">Notebook is open in another tab</h1>
      <p class="text-muted-foreground">
        Only one tab can edit at a time. Use it here saves the other tab and closes the Notebook
        there.
      </p>
      <p v-if="tabLock.refused.value" role="alert" class="text-destructive">
        The other tab could not save its changes, so it is still editing. Fix the save problem in
        that tab first, then click Use it here again.
      </p>
      <button
        type="button"
        class="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90"
        @click="tabLock.useHere()"
      >
        Use it here
      </button>
    </div>
  </main>
</template>
