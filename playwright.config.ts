import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  webServer: {
    // Port 3100 instead of Next's default 3000 so the suite never collides
    // with (or silently reuses) an unrelated dev server on the default port.
    command: 'GLIM_FIXTURE=1 pnpm --filter harbor-demo dev --port 3100',
    port: 3100,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:3100',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
})
