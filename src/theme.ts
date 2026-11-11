import { ref, watch } from 'vue'
import { db } from './notebook'
import { getSetting, setSetting } from './settings'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

/** The open Notebook's theme choice. Change it with `setTheme`. */
export const theme = ref<Theme>('system')

const osDark = window.matchMedia('(prefers-color-scheme: dark)')

// Dark mode is the `dark` class on <html>; style.css keys its dark tokens on it.
const apply = () =>
  document.documentElement.classList.toggle(
    'dark',
    theme.value === 'dark' || (theme.value === 'system' && osDark.matches),
  )

export function setTheme(value: Theme) {
  theme.value = value
  setSetting('theme', value)
  apply()
}

osDark.addEventListener('change', apply)

// The choice lives in the Notebook file, so it is re-read whenever one opens or closes.
watch(
  db,
  () => {
    const saved = getSetting('theme') as Theme | null
    theme.value = saved && THEMES.includes(saved) ? saved : 'system'
    apply()
  },
  { immediate: true, flush: 'sync' },
)
