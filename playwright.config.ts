import { defineConfig } from '@playwright/test';

/**
 * Browser smoke test for the built site. It runs the real bundle (not the Node
 * friendly legacy build), which is how the pdf.js/engine problems of the past
 * were caught.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: 'http://localhost:4175',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4175 --strictPort',
    url: 'http://localhost:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
