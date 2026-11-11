import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// The source entry is index.html; only the built file is called notebook.html,
// so there is one file by that name to open.
const nameOutput: Plugin = {
  name: 'notebook-html',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html']
    if (html) html.fileName = 'notebook.html'
  },
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), viteSingleFile(), nameOutput],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // The polyfill fetches; the page must make zero network requests.
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    // Opening a Notebook loads SQLite, which takes more than the default second on a busy machine.
    expect: { poll: { timeout: 10_000 } },
    testTimeout: 20_000,
  },
})
