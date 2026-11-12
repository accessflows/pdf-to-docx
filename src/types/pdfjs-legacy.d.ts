/**
 * pdf.js ships its legacy build (polyfilled, safe on older engines) without type
 * declarations, so mirror the typed entry point for the deep import we use.
 */
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export * from 'pdfjs-dist';
}
