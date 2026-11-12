import type { PDFPageProxy } from 'pdfjs-dist';
import type { RenderedPage } from './docxBuild';
import { ConvertError } from './types';

export async function renderPageToCanvas(
  page: PDFPageProxy,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new ConvertError('canvas');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export async function renderPageToPng(page: PDFPageProxy, scale: number): Promise<RenderedPage> {
  const canvas = await renderPageToCanvas(page, scale);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  releaseCanvas(canvas);
  if (!blob) throw new ConvertError('page-image');

  const base = page.getViewport({ scale: 1 });
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    widthPt: base.width,
    heightPt: base.height,
  };
}
