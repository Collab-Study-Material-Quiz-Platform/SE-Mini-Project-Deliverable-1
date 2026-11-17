import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// System validation (Test Plan level 3): end-to-end user flows against the real backend, a real MongoDB
// database and the React client. The backend and frontend are started here; MongoDB must already be running.
export const E2E_MONGO_URI = process.env.E2E_MONGO_URI || 'mongodb://127.0.0.1:27017/studyplatform_e2e'
export const API_URL = 'http://localhost:5000'
const uploadDir = fileURLToPath(new URL('./test-results/e2e-uploads', import.meta.url))

const widths = { 'mobile-360': { width: 360, height: 740 }, 'tablet-768': { width: 768, height: 1024 }, 'desktop-1920': { width: 1920, height: 1080 } }
const browsers = { chromium: devices['Desktop Chrome'], firefox: devices['Desktop Firefox'], webkit: devices['Desktop Safari'] }

// TC-Comp-01: the core workflows on each browser engine at 360, 768 and 1920 px.
const compatibilityProjects = Object.entries(browsers).flatMap(([browser, device]) => Object.entries(widths).map(([name, viewport]) => ({
  name: `compat-${browser}-${name}`,
  testMatch: /compatibility\.spec\.js/,
  use: { ...device, viewport },
})))

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup.js',
  // The tests share one database and include timing checks, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'system-chromium', testIgnore: /compatibility\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    ...compatibilityProjects,
  ],
  webServer: [
    {
      command: 'node ../backend/server.js',
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { NODE_ENV: 'development', PORT: '5000', MONGO_URI: E2E_MONGO_URI, UPLOAD_DIR: uploadDir },
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    // The production build, for the page-load measurement (TC-Perf-03). Preview reuses the dev proxy settings.
    {
      command: 'npx vite build --outDir test-results/preview-dist && npx vite preview --outDir test-results/preview-dist --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
