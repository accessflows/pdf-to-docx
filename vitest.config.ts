import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // pdf.js' browser build relies on very new engine features (Promise.try,
    // Uint8Array#toHex) that Node does not all provide. Its legacy build is the
    // one meant for Node, and it is what the tests use.
    alias: [{ find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' }],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
