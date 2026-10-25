import { defineConfig, devices } from '@playwright/test'

const origin = 'http://localhost:3000'

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: origin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun --no-env-file scripts/e2e-server.ts',
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    // 默认会 SIGKILL 整个进程组，启动脚本来不及删除临时库。
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
})
