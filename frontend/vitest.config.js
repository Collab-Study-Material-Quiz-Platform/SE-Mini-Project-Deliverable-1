import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Unit tests for the React client. Browser end-to-end tests live in e2e/ and run with Playwright instead.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    reporters: ['default', 'junit'],
    outputFile: { junit: './coverage/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**', 'src/main.jsx'],
      reporter: ['text', 'html', 'lcov', 'json-summary', 'json'],
      reportsDirectory: './coverage',
    },
  },
})
