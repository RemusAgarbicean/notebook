<script setup lang="ts">
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { setTheme, theme, type Theme } from './theme'

const LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }
</script>

<template>
  <Tabs
    data-testid="theme-switch"
    aria-label="Theme"
    :model-value="theme"
    @update:model-value="setTheme($event as Theme)"
  >
    <TabsList class="h-7 w-full">
      <TabsTrigger v-for="(label, value) in LABELS" :key="value" :value="value" class="text-xs">
        {{ label }}
      </TabsTrigger>
    </TabsList>
  </Tabs>
</template>
