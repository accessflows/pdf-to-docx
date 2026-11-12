import { DEFAULT_LOCALE, type Locale } from '../i18n';

export type ConvertMode = 'text' | 'layout' | 'visual';
export type OcrMode = 'off' | 'auto' | 'force';

export interface ConvertOptions {
  /**
   * `text` rebuilds editable paragraphs, `layout` keeps every line where the PDF
   * had it, `visual` embeds one image per page.
   */
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
  /** Interface language. The conversion itself does not depend on it. */
  locale: Locale;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  mode: 'text',
  imageScale: 2,
  ocr: 'auto',
  ocrLangs: 'vie+eng',
  detectColumns: true,
  autoStart: true,
  locale: DEFAULT_LOCALE,
};

/** OCR language combinations offered in the interface. */
export const OCR_LANGS = ['vie+eng', 'chi_sim+eng', 'jpn+eng', 'kor+eng', 'rus+eng', 'eng'];

export const OPTIONS_STORAGE_KEY = 'pdf2docx:options';

export interface ConvertProgress {
  page: number;
  pages: number;
  phase: 'text' | 'render' | 'ocr' | 'write';
}

export type ConvertWarningCode = 'blank-pages' | 'picture-pages' | 'ocr-pages';

/** Something worth telling the user about; the UI turns it into a sentence. */
export interface ConvertWarning {
  code: ConvertWarningCode;
  pages: number[];
}

export type ConvertErrorCode =
  | 'password'
  | 'invalid-pdf'
  | 'unreadable-pdf'
  | 'canvas'
  | 'page-image';

/** Error carrying a stable code so the UI can show it in the selected language. */
export class ConvertError extends Error {
  constructor(readonly code: ConvertErrorCode) {
    super(code);
    this.name = 'ConvertError';
  }
}

export interface ConvertResult {
  blob: Blob;
  pageCount: number;
  ocrPages: number;
  warnings: ConvertWarning[];
}

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.pdf$/i, '') || 'document';
  return `${base}.${ext}`;
}
