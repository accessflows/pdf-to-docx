import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { ensurePdfjs, pdfjs, pdfjsAssetOptions } from './pdfjs';
import { extractPage } from './pdfExtract';
import { emptyPageLayout, layoutPage, type PageLayout } from './textLayout';
import { buildAnchoredLines } from './anchoredLayout';
import {
  buildLayoutDocument,
  buildTextDocument,
  buildVisualDocument,
  packDocument,
  type LayoutBlock,
  type LayoutPage,
  type PageBlockImage,
  type RenderedPage,
  type TextPage,
} from './docxBuild';
import { releaseCanvas, renderPageToCanvas, renderPageToPng } from './renderPages';
import { recognizeParagraphs, terminateOcrWorker } from './ocr';
import { analyzePageGraphics, isImageOnlyPage, resolveImageSource, type PageImage } from './pdfImages';
import { encodeImageSource, type EncodedImage } from './imageEncode';
import {
  ConvertError,
  DOCX_MIME,
  type ConvertOptions,
  type ConvertProgress,
  type ConvertResult,
  type ConvertWarning,
} from './types';

export { terminateOcrWorker };

/** Safety valve for pages built from hundreds of tiny image tiles. */
const MAX_IMAGES_PER_PAGE = 60;

export interface ConvertInput {
  data: ArrayBuffer;
  options: ConvertOptions;
  onProgress?: (progress: ConvertProgress) => void;
  /** Stops the conversion between pages when the user cancels. */
  signal?: AbortSignal;
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function translatePdfError(error: unknown): Error {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'PasswordException') return new ConvertError('password');
  if (name === 'InvalidPDFException') return new ConvertError('invalid-pdf');
  if (name === 'MissingPDFException') return new ConvertError('unreadable-pdf');
  return error instanceof Error ? error : new Error(String(error));
}

function ocrPageLayout(paragraphs: string[], width: number, height: number): PageLayout {
  const margin = 56;
  const fontSize = 11;
  return {
    width,
    height,
    margins: { top: margin, right: margin, bottom: margin, left: margin },
    paragraphs: paragraphs.map((text, index) => ({
      lines: [],
      text,
      fontSize,
      bold: false,
      italic: false,
      align: 'left',
      gapBefore: index === 0 ? 0 : 8,
      indentLeft: 0,
      lineRatio: 1.25,
      heading: false,
    })),
    charCount: paragraphs.reduce((total, text) => total + text.length, 0),
  };
}

async function convertVisual(
  pdf: PDFDocumentProxy,
  options: ConvertOptions,
  report: (progress: ConvertProgress) => void,
  signal?: AbortSignal,
): Promise<ConvertResult> {
  const total = pdf.numPages;
  const pages: RenderedPage[] = [];

  for (let index = 1; index <= total; index += 1) {
    throwIfAborted(signal);
    const page = await pdf.getPage(index);
    pages.push(await renderPageToPng(page, options.imageScale));
    page.cleanup();
    report({ page: index, pages: total, phase: 'render' });
    await yieldToEventLoop();
  }

  report({ page: total, pages: total, phase: 'write' });
  const data = await packDocument(buildVisualDocument(pages));
  return {
    blob: new Blob([data], { type: DOCX_MIME }),
    pageCount: total,
    ocrPages: 0,
    warnings: [],
  };
}

/** Reads and encodes the images painted on a page, so they can be embedded. */
async function collectPageImages(
  page: PDFPageProxy,
  images: PageImage[],
  cache: Map<string, EncodedImage | null>,
  onOverflow?: () => void,
): Promise<PageBlockImage[]> {
  const placed: PageBlockImage[] = [];
  if (images.length > MAX_IMAGES_PER_PAGE) onOverflow?.();

  for (const image of images.slice(0, MAX_IMAGES_PER_PAGE)) {
    const key = image.name ?? `inline:${Math.round(image.x)},${Math.round(image.y)}`;
    if (!cache.has(key)) {
      const source = await resolveImageSource(page, image);
      cache.set(key, source ? await encodeImageSource(source) : null);
    }

    const encoded = cache.get(key);
    if (!encoded) continue;
    placed.push({
      data: encoded.data,
      type: encoded.type,
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
    });
  }

  return placed;
}

/** A page kept as one picture: no margins, no text, just the image at full page size. */
function picturePage(width: number, height: number, picture: PageBlockImage): TextPage {
  return {
    layout: {
      width,
      height,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      paragraphs: [],
      charCount: 0,
    },
    images: [{ ...picture, x: 0, y: 0, width, height }],
  };
}

async function ocrPage(page: PDFPageProxy, options: ConvertOptions): Promise<string[]> {
  const canvas = await renderPageToCanvas(page, Math.min(3, Math.max(1.5, options.imageScale)));
  try {
    return await recognizeParagraphs(canvas, options.ocrLangs);
  } catch (error) {
    // Tesseract errors are English internals; the UI shows a localized message.
    throw new ConvertError('ocr-failed', { cause: error });
  } finally {
    releaseCanvas(canvas);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ConvertError('cancelled');
}

async function convertText(
  pdf: PDFDocumentProxy,
  options: ConvertOptions,
  report: (progress: ConvertProgress) => void,
  signal?: AbortSignal,
): Promise<ConvertResult> {
  const total = pdf.numPages;
  const pages: TextPage[] = [];
  const blankPages: number[] = [];
  const picturePages: number[] = [];
  const ocrPageNumbers: number[] = [];
  const limitedPages: number[] = [];
  // An image XObject can be painted on many pages; encode each one only once.
  const imageCache = new Map<string, EncodedImage | null>();
  let ocrPages = 0;

  for (let index = 1; index <= total; index += 1) {
    throwIfAborted(signal);
    const page = await pdf.getPage(index);
    const graphics = analyzePageGraphics(await page.getOperatorList(), page.view);
    const extracted = await extractPage(page, graphics.textColors);
    // A page without glyphs, or whose glyphs are all invisible, has no usable text layer.
    const hasTextLayer = extracted.charCount > 0 && !graphics.hiddenText;
    const useOcr = options.ocr === 'force' || (options.ocr === 'auto' && !hasTextLayer);
    const noteLimit = () => limitedPages.push(index);

    // Scans and covers are one big picture: keep them as a picture instead of
    // dropping the artwork for a handful of (often invisible) characters.
    if (options.ocr !== 'force' && isImageOnlyPage(graphics, hasTextLayer)) {
      const [picture] = await collectPageImages(page, graphics.images, imageCache, noteLimit);
      if (picture) {
        pages.push(picturePage(extracted.width, extracted.height, picture));
        picturePages.push(index);
        page.cleanup();
        report({ page: index, pages: total, phase: 'text' });
        await yieldToEventLoop();
        continue;
      }
    }

    if (useOcr) report({ page: index, pages: total, phase: 'ocr' });
    const paragraphs = useOcr ? await ocrPage(page, options) : [];

    if (paragraphs.length) {
      ocrPages += 1;
      ocrPageNumbers.push(index);
      // OCR already turned the page into text; the picture would only duplicate it.
      pages.push({ layout: ocrPageLayout(paragraphs, extracted.width, extracted.height) });
    } else if (hasTextLayer) {
      const layout = layoutPage(extracted.fragments, extracted.width, extracted.height, {
        detectColumns: options.detectColumns,
      });
      const images = await collectPageImages(page, graphics.images, imageCache, noteLimit);
      pages.push({ layout, images });
    } else {
      blankPages.push(index);
      pages.push({ layout: emptyPageLayout(extracted.width, extracted.height) });
    }

    page.cleanup();
    report({ page: index, pages: total, phase: 'text' });
    await yieldToEventLoop();
  }

  throwIfAborted(signal);
  const warnings: ConvertWarning[] = [];
  if (blankPages.length) warnings.push({ code: 'blank-pages', pages: blankPages });
  if (picturePages.length) warnings.push({ code: 'picture-pages', pages: picturePages });
  if (ocrPages) warnings.push({ code: 'ocr-pages', pages: ocrPageNumbers });
  if (limitedPages.length) warnings.push({ code: 'image-limit', pages: limitedPages });

  report({ page: total, pages: total, phase: 'write' });
  const data = await packDocument(buildTextDocument(pages));
  return {
    blob: new Blob([data], { type: DOCX_MIME }),
    pageCount: total,
    ocrPages,
    warnings,
  };
}

/** Keeps every line and picture where the PDF had it instead of reflowing text. */
async function convertLayout(
  pdf: PDFDocumentProxy,
  options: ConvertOptions,
  report: (progress: ConvertProgress) => void,
  signal?: AbortSignal,
): Promise<ConvertResult> {
  const total = pdf.numPages;
  const pages: LayoutPage[] = [];
  const blankPages: number[] = [];
  const picturePages: number[] = [];
  const ocrPageNumbers: number[] = [];
  const limitedPages: number[] = [];
  const imageCache = new Map<string, EncodedImage | null>();

  for (let index = 1; index <= total; index += 1) {
    throwIfAborted(signal);
    const page = await pdf.getPage(index);
    const graphics = analyzePageGraphics(await page.getOperatorList(), page.view);
    const extracted = await extractPage(page, graphics.textColors);
    const hasTextLayer = extracted.charCount > 0 && !graphics.hiddenText;
    const useOcr = options.ocr === 'force' || (options.ocr === 'auto' && !hasTextLayer);
    const noteLimit = () => limitedPages.push(index);

    if (options.ocr !== 'force' && isImageOnlyPage(graphics, hasTextLayer)) {
      const [picture] = await collectPageImages(page, graphics.images, imageCache, noteLimit);
      if (picture) {
        pages.push({
          width: extracted.width,
          height: extracted.height,
          lines: [],
          images: [{ ...picture, x: 0, y: 0, width: extracted.width, height: extracted.height }],
        });
        picturePages.push(index);
        page.cleanup();
        report({ page: index, pages: total, phase: 'text' });
        await yieldToEventLoop();
        continue;
      }
    }

    const images = await collectPageImages(page, graphics.images, imageCache, noteLimit);
    const lines = hasTextLayer ? buildAnchoredLines(extracted.fragments) : [];
    const blocks: LayoutBlock[] = [];

    // OCR text has no coordinates of its own, so it goes into one anchored box.
    if (!lines.length && useOcr) {
      report({ page: index, pages: total, phase: 'ocr' });
      const paragraphs = await ocrPage(page, options);
      if (paragraphs.length) {
        ocrPageNumbers.push(index);
        blocks.push({
          x: 56,
          y: 56,
          width: Math.max(72, extracted.width - 112),
          lines: paragraphs,
        });
      }
    }

    if (!lines.length && !blocks.length && !images.length) blankPages.push(index);
    pages.push({ width: extracted.width, height: extracted.height, lines, images, blocks });

    page.cleanup();
    report({ page: index, pages: total, phase: 'text' });
    await yieldToEventLoop();
  }

  throwIfAborted(signal);
  const warnings: ConvertWarning[] = [];
  if (blankPages.length) warnings.push({ code: 'blank-pages', pages: blankPages });
  if (picturePages.length) warnings.push({ code: 'picture-pages', pages: picturePages });
  if (ocrPageNumbers.length) warnings.push({ code: 'ocr-pages', pages: ocrPageNumbers });
  if (limitedPages.length) warnings.push({ code: 'image-limit', pages: limitedPages });

  report({ page: total, pages: total, phase: 'write' });
  const data = await packDocument(buildLayoutDocument(pages));
  return {
    blob: new Blob([data], { type: DOCX_MIME }),
    pageCount: total,
    ocrPages: ocrPageNumbers.length,
    warnings,
  };
}

export async function convertPdf({
  data,
  options,
  onProgress,
  signal,
}: ConvertInput): Promise<ConvertResult> {
  await ensurePdfjs();
  const report = (progress: ConvertProgress) => onProgress?.(progress);

  throwIfAborted(signal);

  const task = pdfjs.getDocument({ data: new Uint8Array(data), ...pdfjsAssetOptions() });
  let pdf: PDFDocumentProxy;
  try {
    pdf = await task.promise;
  } catch (error) {
    throw translatePdfError(error);
  }

  try {
    if (options.mode === 'visual') return await convertVisual(pdf, options, report, signal);
    if (options.mode === 'layout') return await convertLayout(pdf, options, report, signal);
    return await convertText(pdf, options, report, signal);
  } finally {
    await task.destroy();
  }
}
