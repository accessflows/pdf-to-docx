export type ConvertMode = 'text' | 'visual';
export type OcrMode = 'off' | 'auto' | 'force';

export interface ConvertOptions {
  /** `text` rebuilds editable paragraphs, `visual` embeds one image per page. */
  mode: ConvertMode;
  /** Raster scale used by visual mode (1 = 72 dpi, 2 = 144 dpi, ...). */
  imageScale: number;
  ocr: OcrMode;
  /** Tesseract language string, e.g. `vie+eng`. */
  ocrLangs: string;
  /** Try to recover two-column layouts. */
  detectColumns: boolean;
  /** Start converting as soon as files are added. */
  autoStart: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  mode: 'text',
  imageScale: 2,
  ocr: 'auto',
  ocrLangs: 'vie+eng',
  detectColumns: true,
  autoStart: true,
};

export const OPTIONS_STORAGE_KEY = 'pdf2docx:options';

export interface ConvertProgress {
  page: number;
  pages: number;
  phase: 'text' | 'render' | 'ocr' | 'write';
}

export interface ConvertResult {
  blob: Blob;
  pageCount: number;
  ocrPages: number;
  warnings: string[];
}

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.pdf$/i, '') || 'document';
  return `${base}.${ext}`;
}
