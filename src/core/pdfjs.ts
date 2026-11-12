import * as pdfjs from 'pdfjs-dist';

let ready: Promise<void> | undefined;

/**
 * Points pdf.js at its worker script (bundled by Vite) the first time we need it.
 * In Node (tests) pdf.js runs with its built-in fake worker, so no setup is required.
 */
export function ensurePdfjs(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (typeof window === 'undefined') return;
      if (pdfjs.GlobalWorkerOptions.workerSrc) return;
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    })().catch(() => {
      // Fall back to pdf.js' main-thread worker; conversion still works, just slower.
    });
  }
  return ready;
}

export { pdfjs };

/**
 * pdf.js needs substitute fonts and CJMaps to measure non-embedded fonts and to
 * decode CJK text. They are copied into `public/pdfjs` by `npm run assets`.
 */
export function pdfjsAssetOptions(): {
  standardFontDataUrl?: string;
  cMapUrl?: string;
  cMapPacked?: boolean;
} {
  if (typeof window === 'undefined') return {};
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  return {
    standardFontDataUrl: new URL('pdfjs/standard_fonts/', base).href,
    cMapUrl: new URL('pdfjs/cmaps/', base).href,
    cMapPacked: true,
  };
}
