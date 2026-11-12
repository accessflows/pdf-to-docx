import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { convertPdf } from '../src/core/convert';
import { buildTextDocument, packDocument } from '../src/core/docxBuild';
import { layoutPage, type PageLayout } from '../src/core/textLayout';
import { createTestPdf, PAGE_HEIGHT } from './helpers/createTestPdf';
import { createImagePdf } from './helpers/createImagePdf';
import { baselineOffset } from '../src/core/anchoredLayout';
import { ConvertError, DEFAULT_OPTIONS } from '../src/core/types';

const LONG_LINE =
  'Day la mot dong van ban du dai de trinh phat hien biet day la mot doan van lien tuc trong tai lieu.';

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml not found');
  return file.async('string');
}

async function mediaFiles(blob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
}

describe('convertPdf (text mode)', () => {
  it('writes every page as a separate section with its text', async () => {
    const pdf = createTestPdf([
      [
        { text: 'Bao cao thu nghiem', x: 72, y: PAGE_HEIGHT - 80, size: 24, bold: true },
        { text: LONG_LINE, x: 72, y: PAGE_HEIGHT - 140, size: 12 },
        { text: 'Dong thu hai cua doan van dau tien.', x: 72, y: PAGE_HEIGHT - 155, size: 12 },
      ],
      [
        { text: 'Trang hai', x: 72, y: PAGE_HEIGHT - 80, size: 24, bold: true },
        { text: 'Noi dung cua trang so hai.', x: 72, y: PAGE_HEIGHT - 140, size: 12 },
      ],
    ]);

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'text', ocr: 'off' },
    });

    expect(result.pageCount).toBe(2);
    expect(result.blob.size).toBeGreaterThan(0);

    const xml = await documentXml(result.blob);
    expect(xml).toContain('Bao cao thu nghiem');
    expect(xml).toContain('Dong thu hai cua doan van dau tien.');
    expect(xml).toContain('Noi dung cua trang so hai.');
    expect(xml.match(/<w:sectPr/g)).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns about pages without a text layer when OCR is off', async () => {
    const pdf = createTestPdf([[], [{ text: 'Chi co mot trang co chu', x: 72, y: 700, size: 12 }]]);

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'text', ocr: 'off' },
    });

    expect(result.warnings).toEqual([{ code: 'blank-pages', pages: [1] }]);
  });

  it('rejects files that are not valid PDFs', async () => {
    const attempt = convertPdf({
      data: new TextEncoder().encode('not a pdf at all').buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'text', ocr: 'off' },
    });

    await expect(attempt).rejects.toBeInstanceOf(ConvertError);
    await expect(attempt).rejects.toMatchObject({ code: 'invalid-pdf' });
  });

  it('keeps a page that is one big picture instead of dropping it', async () => {
    const pdf = createImagePdf([{ imageWidth: 64, imageHeight: 96 }]);

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'text', ocr: 'off' },
    });

    const xml = await documentXml(result.blob);
    expect(xml).toContain('<w:drawing>');
    expect(await mediaFiles(result.blob)).toHaveLength(1);
    expect(result.warnings).toEqual([{ code: 'picture-pages', pages: [1] }]);
  });

  it('keeps pictures on pages that also have text', async () => {
    const pdf = createImagePdf([
      {
        imageWidth: 32,
        imageHeight: 32,
        topHalf: true,
        lines: [
          { text: 'Anh o phia tren', x: 72, y: 120, size: 14 },
          { text: LONG_LINE, x: 72, y: 90, size: 12 },
        ],
      },
    ]);

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'text', ocr: 'off' },
    });

    const xml = await documentXml(result.blob);
    expect(xml).toContain('Anh o phia tren');
    expect(xml).toContain('<w:drawing>');
    expect(await mediaFiles(result.blob)).toHaveLength(1);
  });

  it('anchors every line where the PDF had it in layout mode', async () => {
    const pdf = createTestPdf([
      [
        { text: 'Tieu de', x: 72, y: PAGE_HEIGHT - 80, size: 24, bold: true },
        { text: LONG_LINE, x: 72, y: PAGE_HEIGHT - 140, size: 12 },
      ],
    ]);

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'layout', ocr: 'off' },
    });

    const xml = await documentXml(result.blob);
    const frames = [...xml.matchAll(/<w:framePr [^/]*w:x="(-?\d+)" w:y="(-?\d+)"/g)].map((match) => ({
      x: Number(match[1]) / 20,
      y: Number(match[2]) / 20,
    }));

    expect(frames).toHaveLength(2);
    // Both lines start on the same left edge, at the baseline minus the ascent.
    expect(frames[0].x).toBeCloseTo(72, 1);
    expect(frames[0].y).toBeCloseTo(80 - baselineOffset(24), 1);
    expect(frames[1].y).toBeCloseTo(140 - baselineOffset(12), 1);
    expect(xml).toContain('Tieu de');
    expect((xml.match(/<w:sectPr/g) ?? [])).toHaveLength(1);
  });

  it('anchors pictures instead of reflowing them in layout mode', async () => {    const pdf = createImagePdf([
      {
        imageWidth: 32,
        imageHeight: 32,
        topHalf: true,
        lines: [{ text: 'Chu ben duoi anh', x: 72, y: 120, size: 14 }],
      },
    ]);

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'layout', ocr: 'off' },
    });

    const xml = await documentXml(result.blob);
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('behindDoc="1"');
    expect(xml).toContain('<w:framePr');
    expect(await mediaFiles(result.blob)).toHaveLength(1);
  });

  it('keeps a stencil mask page instead of dropping it', async () => {
    const pdf = createImagePdf([{ imageWidth: 32, imageHeight: 32, maskColor: [0, 0, 0] }]);

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'text', ocr: 'off' },
    });

    const xml = await documentXml(result.blob);
    expect(xml).toContain('<w:drawing>');
    expect(await mediaFiles(result.blob)).toHaveLength(1);
    expect(result.warnings).toEqual([{ code: 'picture-pages', pages: [1] }]);
  });

  it('lays a rotated page out in display space', async () => {    const pdf = createTestPdf(
      [[{ text: 'Trang xoay', x: 72, y: PAGE_HEIGHT - 80, size: 24 }]],
      { rotate: 90 },
    );

    const result = await convertPdf({
      data: pdf.buffer as ArrayBuffer,
      options: { ...DEFAULT_OPTIONS, mode: 'layout', ocr: 'off' },
    });

    // MediaBox 595x842 with /Rotate 90 displays as 842x595 (twips 16840x11900).
    const xml = await documentXml(result.blob);
    expect(xml).toContain('<w:pgSz w:w="16840" w:h="11900"');
    expect(xml).toContain('Trang xoay');
  });

  it('keeps the text colour in both text and layout modes', async () => {
    const pdf = createTestPdf([
      [
        { text: 'Doan mau do', x: 72, y: PAGE_HEIGHT - 80, size: 18, color: [1, 0, 0] },
        { text: 'Doan mau xanh', x: 72, y: PAGE_HEIGHT - 120, size: 12, color: [0, 0, 1] },
      ],
    ]);

    for (const mode of ['text', 'layout'] as const) {
      const result = await convertPdf({
        data: pdf.buffer.slice(0) as ArrayBuffer,
        options: { ...DEFAULT_OPTIONS, mode, ocr: 'off' },
      });
      const xml = await documentXml(result.blob);
      expect(xml, mode).toContain('<w:color w:val="FF0000"/>');
      expect(xml, mode).toContain('<w:color w:val="0000FF"/>');
    }
  });
});

describe('docx writer', () => {
  it('keeps Vietnamese diacritics intact in the output document', async () => {
    const page = layoutPage(
      [
        {
          str: 'Báo cáo tài chính quý III',
          x: 72,
          y: 80,
          w: 200,
          h: 20,
          bold: true,
          italic: false,
        },
        {
          str: 'Doanh thu tăng trưởng ấn tượng so với cùng kỳ năm trước.',
          x: 72,
          y: 130,
          w: 330,
          h: 12,
          bold: false,
          italic: false,
        },
      ],
      595,
      842,
      { detectColumns: false },
    );

    const blob = new Blob([await packDocument(buildTextDocument([{ layout: page }]))]);
    const xml = await documentXml(blob);

    expect(xml).toContain('Báo cáo tài chính quý III');
    expect(xml).toContain('Doanh thu tăng trưởng ấn tượng so với cùng kỳ năm trước.');
  });

  it('writes OCR paragraphs that have no layout lines', async () => {
    const page: PageLayout = {
      width: 595,
      height: 842,
      margins: { top: 56, right: 56, bottom: 56, left: 56 },
      charCount: 14,
      paragraphs: [
        {
          lines: [],
          text: 'Hello OCR test',
          fontSize: 11,
          bold: false,
          italic: false,
          align: 'left',
          gapBefore: 0,
          indentLeft: 0,
          lineRatio: 1.25,
          heading: false,
        },
      ],
    };

    const blob = new Blob([await packDocument(buildTextDocument([{ layout: page }]))]);
    expect(await documentXml(blob)).toContain('Hello OCR test');
  });
});
