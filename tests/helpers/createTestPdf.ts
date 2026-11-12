/**
 * Minimal PDF writer used by tests: produces a text-only PDF (Helvetica) with
 * one content stream per page, so the conversion pipeline can be exercised
 * without shipping binary fixtures.
 */

export interface PdfTextLine {
  text: string;
  /** Left position in points. */
  x: number;
  /** Baseline position in points, from the bottom of the page. */
  y: number;
  size: number;
  bold?: boolean;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function contentStream(lines: PdfTextLine[]): string {
  const commands = lines.map((line) => {
    const font = line.bold ? '/F2' : '/F1';
    return `BT ${font} ${line.size} Tf ${line.x} ${line.y} Td (${escapeText(line.text)}) Tj ET`;
  });
  return commands.join('\n');
}

export function createTestPdf(pages: PdfTextLine[][]): Uint8Array {
  const objects: string[] = [];

  const pageIds = pages.map((_, index) => 5 + index * 2);
  const kids = pageIds.map((id) => `${id} 0 R`).join(' ');

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  pages.forEach((lines, index) => {
    const contentId = 6 + index * 2;
    const stream = contentStream(lines);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(header.length + body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const startxref = header.length + body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return new TextEncoder().encode(header + body + xref);
}

export { PAGE_HEIGHT, PAGE_WIDTH };
