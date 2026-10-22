import { defineConfig } from '@playwright/test';

// Uses the locally installed Chrome (channel 'chrome'); runs against the Vite dev server so test hooks exist.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: 'http://localhost:5179',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    url: 'http://localhost:5179',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
