import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./src/shared/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts'],
      exclude: ['src/shared/**/*.test.ts', 'src/shared/test-setup.ts', 'src/shared/**/types.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 80 }
    }
  }
})
