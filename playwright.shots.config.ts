import { defineConfig } from '@playwright/test'

/** Screenshot capture for the RTL audit and the README (`npm run screenshots`). */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.shots.ts',
  timeout: 300_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results'
})
