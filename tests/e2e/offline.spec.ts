import { expect, test } from '@playwright/test';

/**
 * The service worker is registered lazily, so this checks the precache contract
 * rather than emulating an offline browser: Playwright's offline mode does not
 * route service-worker navigations, so `setOffline` cannot exercise that path.
 */
test('precaches the app shell so it can start offline', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PDF → DOCX/);

  const cache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const entry = await caches.open(names[names.length - 1]);
    return {
      active: !!registration.active,
      name: names[names.length - 1],
      entries: (await entry.keys()).map((request) => new URL(request.url).pathname),
    };
  });

  expect(cache.active).toBe(true);
  expect(cache.name).toMatch(/^pdf2docx-/);
  expect(cache.entries).toContain('/index.html');
  expect(cache.entries.some((entry) => /assets\/.*\.js$/.test(entry))).toBe(true);
  expect(cache.entries.some((entry) => /assets\/.*\.css$/.test(entry))).toBe(true);
  expect(cache.entries.some((entry) => entry.includes('pdf.worker'))).toBe(true);
});
