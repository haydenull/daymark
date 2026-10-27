import { defineConfig, devices } from '@playwright/test'

const openOrigin = 'http://localhost:3000'
const disabledOrigin = 'http://localhost:3001'

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'open',
      testIgnore: 'registration-disabled.spec.ts',
      outputDir: 'test-results/open',
      use: { ...devices['Desktop Chrome'], baseURL: openOrigin },
    },
    {
      name: 'disabled',
      testMatch: 'registration-disabled.spec.ts',
      outputDir: 'test-results/disabled',
      use: { ...devices['Desktop Chrome'], baseURL: disabledOrigin },
    },
  ],
  webServer: [
    {
      name: 'open',
      command: 'bun --no-env-file scripts/e2e-server.ts',
      url: `${openOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
      env: {
        E2E_PORT: '3000',
        E2E_DISABLE_REGISTRATION: 'false',
      },
    },
    {
      name: 'disabled',
      command: 'bun --no-env-file scripts/e2e-server.ts',
      url: `${disabledOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
      env: {
        E2E_PORT: '3001',
        E2E_DISABLE_REGISTRATION: 'true',
      },
    },
  ],
})
