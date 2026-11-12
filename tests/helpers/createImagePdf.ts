/**
 * Minimal PDF writer used by tests: builds pages that paint one RGB image
 * XObject, optionally together with text, so the image path can be exercised
 * without shipping binary fixtures.
 */

export interface PdfImagePage {
  /** Text lines drawn on top of the picture, in PDF coordinates. */
  lines?: { text: string; x: number; y: number; size: number }[];
  /** Image size in pixels. */
  imageWidth: number;
  imageHeight: number;
  /** Paints the image over the top half of the page instead of filling it. */
  topHalf?: boolean;
  /** Paints a 1bpp stencil mask with this fill colour instead of an RGB image. */
  maskColor?: [number, number, number];
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Vertical gradient, so the encoded picture is not a single flat colour. */
function imagePixels(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      pixels[offset] = Math.round((x / Math.max(1, width - 1)) * 255);
      pixels[offset + 1] = Math.round((y / Math.max(1, height - 1)) * 255);
      pixels[offset + 2] = 128;
    }
  }
  return pixels;
}

/** 1bpp stencil: the left half paints (bit 0), the right half stays transparent (bit 1). */
function maskPixels(width: number, height: number): Uint8Array {
  const rowBytes = (width + 7) >> 3;
  const pixels = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x * 2 < width) continue;
      pixels[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return pixels;
}

export function createImagePdf(pages: PdfImagePage[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (bytes: Uint8Array | string) => {
    const chunk = typeof bytes === 'string' ? encoder.encode(bytes) : bytes;
    chunks.push(chunk);
    length += chunk.length;
  };

  // Object layout: 1 catalog, 2 pages, 3-4 fonts, then [page, contents, image] per page.
  const pageObjectIds = pages.map((_, index) => 5 + index * 3);
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ');

  const objects: Uint8Array[] = [];
  const text = (value: string) => encoder.encode(value);

  objects.push(text('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(text(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
  objects.push(
    text('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
  );
  objects.push(
    text('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
  );

  pages.forEach((page, index) => {
    const contentId = 6 + index * 3;
    const imageId = 7 + index * 3;
    const height = page.topHalf ? PAGE_HEIGHT / 2 : PAGE_HEIGHT;
    const y = page.topHalf ? PAGE_HEIGHT / 2 : 0;

    const commands = [
      page.maskColor ? `${page.maskColor.join(' ')} rg` : '',
      'q',
      `${PAGE_WIDTH} 0 0 ${height} 0 ${y} cm`,
      '/Im1 Do',
      'Q',
      ...(page.lines ?? []).map(
        (line) =>
          `BT /F1 ${line.size} Tf ${line.x} ${line.y} Td (${escapeText(line.text)}) Tj ET`,
      ),
    ]
      .filter(Boolean)
      .join('\n');

    objects.push(
      text(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>`,
      ),
    );
    objects.push(text(`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`));

    const pixels = page.maskColor
      ? maskPixels(page.imageWidth, page.imageHeight)
      : imagePixels(page.imageWidth, page.imageHeight);
    const dictionary = page.maskColor
      ? `<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} ` +
        `/ImageMask true /BitsPerComponent 1 /Length ${pixels.length} >>`
      : `<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${pixels.length} >>`;
    const header = text(`${dictionary}\nstream\n`);
    const footer = text('\nendstream');
    const stream = new Uint8Array(header.length + pixels.length + footer.length);
    stream.set(header, 0);
    stream.set(pixels, header.length);
    stream.set(footer, header.length + pixels.length);
    objects.push(stream);
  });

  push('%PDF-1.4\n');
  objects.forEach((object, index) => {
    offsets.push(length);
    push(`${index + 1} 0 obj\n`);
    push(object);
    push('\nendobj\n');
  });

  const startxref = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  push(xref);

  const pdf = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, offset);
    offset += chunk.length;
  }
  return pdf;
}

export { PAGE_HEIGHT, PAGE_WIDTH };
