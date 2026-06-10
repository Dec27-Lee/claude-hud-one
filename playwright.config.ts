import { defineConfig, devices } from '@playwright/test'

const webServer = process.env.CLAUDE_HUD_ONE_EXTERNAL_SERVER === '1'
  ? undefined
  : {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:1420',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:1420',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 900, height: 720 } },
    },
  ],
})
