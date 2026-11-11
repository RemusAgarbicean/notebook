import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // The polyfill fetches; the page must make zero network requests.
    modulePreload: { polyfill: false },
    rollupOptions: { input: 'notebook.html' },
  },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'] },
})
