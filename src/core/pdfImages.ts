import type { PDFPageProxy } from 'pdfjs-dist';
import { pdfjs } from './pdfjs';

/** The parts of pdf.js' operator list this module needs. */
export interface OperatorListLike {
  fnArray: number[];
  argsArray: unknown[];
}

/** Raw pixels handed over by pdf.js for one image XObject. */
export interface PdfImageSource {
  width: number;
  height: number;
  /** One of `pdfjs.ImageKind` (1 = 1bpp grey, 2 = RGB, 3 = RGBA) when `data` is set. */
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  /** pdf.js sometimes hands over an already decoded bitmap instead of pixels. */
  bitmap?: ImageBitmap;
}

/** An image painted on a page, positioned in points from the page's top-left corner. */
export interface PageImage {
  /** pdf.js object name for XObject images, `null` for inline images. */
  name: string | null;
  /** Pixels that come straight from the operator list (inline images). */
  inline?: PdfImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageGraphics {
  images: PageImage[];
  /** The page paints glyphs but all of them are invisible (hidden OCR layer of a scan). */
  hiddenText: boolean;
  /** Share of the page area covered by painted images, 0..1. */
  imageCoverage: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Smaller than this (in square points) an image is decoration, not content. */
const MIN_IMAGE_AREA = 64;

const TEXT_RENDERING_INVISIBLE = 3;
const TEXT_RENDERING_CLIP = 7;

function multiply(m: Matrix, n: ArrayLike<number>): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/**
 * Collects the images a page paints, with the rectangle each one occupies.
 * Only the operator list is needed, so this runs without a canvas.
 */
export function analyzePageGraphics(
  operatorList: OperatorListLike,
  view: readonly number[],
): PageGraphics {
  const { OPS } = pdfjs;
  const originX = view[0];
  const originTop = view[3];
  const pageWidth = view[2] - originX;
  const pageHeight = view[3] - view[1];

  const images: PageImage[] = [];
  const seen = new Set<string>();
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  let textRenderingMode = 0;
  let visibleText = 0;
  let invisibleText = 0;
  let coveredArea = 0;

  const rectFor = (matrix: Matrix) => {
    const xs = [0, 0, 0, 0];
    const ys = [0, 0, 0, 0];
    const corners = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    for (let index = 0; index < corners.length; index += 1) {
      const [u, v] = corners[index];
      xs[index] = matrix[0] * u + matrix[2] * v + matrix[4];
      ys[index] = matrix[1] * u + matrix[3] * v + matrix[5];
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: minX - originX,
      // PDF space has its origin bottom-left; convert to a top-down offset.
      y: originTop - maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const record = (name: string | null, matrix: Matrix, inline?: PdfImageSource) => {
    const rect = rectFor(matrix);
    if (rect.width * rect.height < MIN_IMAGE_AREA) return;

    const overlapWidth =
      Math.min(rect.x + rect.width, pageWidth) - Math.max(rect.x, 0);
    const overlapHeight =
      Math.min(rect.y + rect.height, pageHeight) - Math.max(rect.y, 0);
    const visibleArea = Math.max(0, overlapWidth) * Math.max(0, overlapHeight);
    if (visibleArea < MIN_IMAGE_AREA) return;

    const key = `${name ?? 'inline'}:${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(
      rect.width,
    )},${Math.round(rect.height)}`;
    if (seen.has(key)) return;
    seen.add(key);

    images.push({ name, inline, ...rect });
    coveredArea += visibleArea;
  };

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] as unknown[] | undefined;

    switch (fn) {
      case OPS.save:
        stack.push(ctm);
        break;
      case OPS.restore:
        ctm = stack.pop() ?? IDENTITY;
        break;
      case OPS.transform:
        if (args) ctm = multiply(ctm, args as number[]);
        break;
      case OPS.paintFormXObjectBegin:
        stack.push(ctm);
        if (Array.isArray(args?.[0])) ctm = multiply(ctm, args[0] as number[]);
        break;
      case OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? IDENTITY;
        break;
      case OPS.setTextRenderingMode:
        textRenderingMode = Number(args?.[0] ?? 0);
        break;
      case OPS.showText:
      case OPS.showSpacedText:
      case OPS.nextLineShowText:
      case OPS.nextLineSetSpacingShowText:
        if (
          textRenderingMode === TEXT_RENDERING_INVISIBLE ||
          textRenderingMode === TEXT_RENDERING_CLIP
        ) {
          invisibleText += 1;
        } else {
          visibleText += 1;
        }
        break;
      case OPS.paintImageXObject:
        record(typeof args?.[0] === 'string' ? (args[0] as string) : null, ctm);
        break;
      case OPS.paintImageXObjectRepeat: {
        const [name, scaleX, scaleY, positions] = args ?? [];
        if (typeof name !== 'string' || !Array.isArray(positions)) break;
        for (let at = 0; at + 1 < positions.length; at += 2) {
          record(
            name,
            multiply(ctm, [
              Number(scaleX),
              0,
              0,
              Number(scaleY),
              Number(positions[at]),
              Number(positions[at + 1]),
            ]),
          );
        }
        break;
      }
      case OPS.paintInlineImageXObject:
        if (args?.[0]) record(null, ctm, args[0] as PdfImageSource);
        break;
      default:
        break;
    }
  }

  const pageArea = Math.max(1, pageWidth * pageHeight);
  return {
    images,
    hiddenText: invisibleText > 0 && visibleText === 0,
    imageCoverage: Math.min(1, coveredArea / pageArea),
  };
}

/**
 * Waits for pdf.js to hand over the pixels of one image. Image data is streamed
 * in after the operator list, so it may not be available synchronously.
 */
export async function resolveImageSource(
  page: PDFPageProxy,
  image: PageImage,
): Promise<PdfImageSource | null> {
  if (image.inline) return image.inline;
  const name = image.name;
  if (!name) return null;

  const store = name.startsWith('g_') ? page.commonObjs : page.objs;
  return new Promise<PdfImageSource | null>((resolve) => {
    let settled = false;
    const finish = (value: PdfImageSource | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    // Never let a single broken image stall the whole conversion.
    const timer = setTimeout(() => finish(null), 10_000);

    try {
      if (store.has(name)) {
        finish(store.get(name) as PdfImageSource);
        return;
      }
      store.get(
        name,
        (data: unknown) => finish((data as PdfImageSource) ?? null),
        () => finish(null),
      );
    } catch {
      finish(null);
    }
  });
}

/** Coverage above which the page is basically one picture (book cover, scan, poster). */
const IMAGE_PAGE_COVERAGE = 0.9;

/**
 * True when the page should be kept as a single picture: it has no usable text
 * layer and a picture covers (almost) the whole page.
 */
export function isImageOnlyPage(graphics: PageGraphics, hasTextLayer: boolean): boolean {
  return !hasTextLayer && graphics.imageCoverage >= IMAGE_PAGE_COVERAGE;
}
