import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createTestPdf, PAGE_HEIGHT } from '../helpers/createTestPdf';

test('converts a PDF in the real browser bundle and offers the DOCX', async ({ page }) => {
  const file = path.join(os.tmpdir(), `pdf2docx-e2e-${Date.now()}.pdf`);
  fs.writeFileSync(
    file,
    createTestPdf([
      [
        { text: 'Playwright smoke test', x: 72, y: PAGE_HEIGHT - 80, size: 18, bold: true },
        { text: 'Second line of the same page.', x: 72, y: PAGE_HEIGHT - 120, size: 12 },
      ],
    ]),
  );

  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/PDF → DOCX/);

  await page.setInputFiles('#file-input', file);
  const download = page.getByRole('button', { name: /Download \.docx/ });
  await expect(download).toBeVisible();
  await expect(page.locator('.warnings')).toHaveCount(0);

  const saved = page.waitForEvent('download');
  await download.click();
  const downloadFile = await saved;
  expect(downloadFile.suggestedFilename()).toBe(`${path.parse(file).name}.docx`);

  const docxPath = await downloadFile.path();
  const bytes = fs.readFileSync(docxPath!);
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');

  expect(problems).toEqual([]);
  fs.unlinkSync(file);
});
