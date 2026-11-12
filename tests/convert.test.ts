import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { convertPdf } from '../src/core/convert';
import { buildTextDocument, packDocument } from '../src/core/docxBuild';
import { layoutPage, type PageLayout } from '../src/core/textLayout';
import { createTestPdf, PAGE_HEIGHT } from './helpers/createTestPdf';
import { createImagePdf } from './helpers/createImagePdf';
import { DEFAULT_OPTIONS } from '../src/core/types';

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

    expect(result.warnings.join(' ')).toContain('1 trang không có lớp văn bản');
  });

  it('rejects files that are not valid PDFs', async () => {
    await expect(
      convertPdf({
        data: new TextEncoder().encode('not a pdf at all').buffer as ArrayBuffer,
        options: { ...DEFAULT_OPTIONS, mode: 'text', ocr: 'off' },
      }),
    ).rejects.toThrow(/PDF/);
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
    expect(result.warnings.join(' ')).toContain('giữ nguyên dưới dạng ảnh');
    expect(result.warnings.join(' ')).not.toContain('bị bỏ trống');
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
