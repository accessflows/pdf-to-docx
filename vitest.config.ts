import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Unit tests only; the browser smoke test lives in tests/e2e and runs with Playwright.
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
