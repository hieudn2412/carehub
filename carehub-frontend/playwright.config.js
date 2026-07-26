import { defineConfig, devices } from '@playwright/test'

/**
 * L4 E2E — see docs/l4-e2e-tests/README.md for what has to be running first.
 *
 * The suite talks to a real browser, a real frontend and a real backend; nothing is mocked. Only the
 * Vite dev server is started here — the backend on 8081 is an external precondition because it needs
 * a database, and pointing it at the wrong one writes test data into a shared environment.
 */
export default defineConfig({
  testDir: './e2e',
  // E2E is slower than unit tests and each spec drives several screens.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Journeys create rows the next step reads back; parallel workers on one database interleave badly.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // scripts/l4-testcases.py reads this file to fill the Status column of the workbook.
    ['json', { outputFile: 'playwright-report.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
