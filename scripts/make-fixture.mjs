/**
 * Generates a small text-based PDF used for manual smoke tests: `npm run fixtures`.
 * Output: .tmp/sample.pdf
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

const paragraphs = [
  'PDF to DOCX conversion happens entirely in the browser. The file is parsed with pdf.js,',
  'rebuilt into paragraphs with a small layout engine, and written as an Office Open XML',
  'document with the docx library. Nothing is uploaded to a server at any point.',
  '',
  'Because everything runs on the client, the tool keeps working offline after the first',
  'visit and can be hosted on any static file host such as GitHub Pages or Netlify.',
];

function contentLines() {
  const commands = [];
  let y = PAGE_HEIGHT - 90;

  commands.push(`BT /F2 24 Tf 72 ${y} Td (Quarterly report) Tj ET`);
  y -= 34;
  commands.push(`BT /F1 12 Tf 72 ${y} Td (Prepared for the internal review meeting) Tj ET`);
  y -= 40;

  commands.push(`BT /F2 14 Tf 72 ${y} Td (1. How it works) Tj ET`);
  y -= 24;

  for (const line of paragraphs) {
    if (line) commands.push(`BT /F1 12 Tf 72 ${y} Td (${line}) Tj ET`);
    y -= 16;
  }

  y -= 24;
  commands.push(`BT /F2 14 Tf 72 ${y} Td (2. Limitations) Tj ET`);
  y -= 24;
  commands.push(
    `BT /F1 12 Tf 72 ${y} Td (Tables, vector graphics and scanned pages are handled by the image mode.) Tj ET`,
  );

  return commands.join('\n');
}

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [5 0 R 7 0 R] /Count 2 >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
];

const pageContent = contentLines();
const secondPage = [
  'BT /F2 20 Tf 72 752 Td (Appendix) Tj ET',
  'BT /F1 12 Tf 72 716 Td (Page two only contains a short paragraph so the layout is easy to inspect.) Tj ET',
].join('\n');

objects.push(
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`,
);
objects.push(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}\nendstream`);
objects.push(
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 8 0 R >>`,
);
objects.push(`<< /Length ${secondPage.length} >>\nstream\n${secondPage}\nendstream`);

const header = '%PDF-1.4\n';
let body = '';
const offsets = [];

objects.forEach((object, index) => {
  offsets.push(header.length + body.length);
  body += `${index + 1} 0 obj\n${object}\nendobj\n`;
});

const startxref = header.length + body.length;
let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

const target = join(process.cwd(), '.tmp', 'sample.pdf');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, header + body + xref, 'latin1');
console.log(`[fixtures] wrote ${target}`);
