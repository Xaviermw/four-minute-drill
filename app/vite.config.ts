/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // e2e/ holds Playwright specs (also *.spec.ts) -- keep them out of vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
