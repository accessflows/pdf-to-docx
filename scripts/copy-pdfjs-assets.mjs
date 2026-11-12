/**
 * Copies the pdf.js runtime assets (standard font substitutes + CJMaps) into
 * `public/pdfjs` so the app can serve them itself instead of hitting a CDN.
 * Run automatically by the `predev` / `prebuild` npm scripts.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

function pdfjsRoot() {
  try {
    return dirname(require.resolve('pdfjs-dist/package.json'));
  } catch {
    return resolve(dirname(require.resolve('pdfjs-dist')), '..');
  }
}

const root = pdfjsRoot();
const target = join(process.cwd(), 'public', 'pdfjs');
mkdirSync(target, { recursive: true });

for (const entry of ['standard_fonts', 'cmaps']) {
  const source = join(root, entry);
  if (!existsSync(source)) {
    console.warn(`[pdfjs-assets] missing ${source}, skipping`);
    continue;
  }
  cpSync(source, join(target, entry), { recursive: true });
  console.log(`[pdfjs-assets] copied ${entry}`);
}
