import { pdfjs } from './pdfjs';
import type { PdfImageSource } from './pdfImages';

export interface EncodedImage {
  data: Uint8Array;
  type: 'png' | 'jpg';
}

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Above this many pixels a picture is treated as a photo and stored as JPEG. */
const PHOTO_PIXEL_COUNT = 200_000;

const { GRAYSCALE_1BPP, RGB_24BPP, RGBA_32BPP } = pdfjs.ImageKind as {
  GRAYSCALE_1BPP: number;
  RGB_24BPP: number;
  RGBA_32BPP: number;
};

/** Turns the pdf.js image payload into 8-bit RGBA pixels. */
export function toRgba(source: PdfImageSource): RgbaImage | null {
  const { width, height, data, kind } = source;
  if (!width || !height || !data) return null;

  const pixels = width * height;

  if (source.mask) {
    // PDF stencil masks paint where the bit is 0 and stay transparent where it is 1.
    const [red, green, blue] = (source.color ?? [0, 0, 0]).map((value) =>
      Math.round(Math.max(0, Math.min(1, value)) * 255),
    );
    const rgba = new Uint8ClampedArray(pixels * 4);
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = data[y * rowBytes + (x >> 3)] ?? 0xff;
        const painted = ((byte >> (7 - (x & 7))) & 1) === 0;
        const to = (y * width + x) * 4;
        rgba[to] = red;
        rgba[to + 1] = green;
        rgba[to + 2] = blue;
        rgba[to + 3] = painted ? 255 : 0;
      }
    }
    return { data: rgba, width, height };
  }

  const resolvedKind =
    kind ?? (data.length >= pixels * 4 ? RGBA_32BPP : RGB_24BPP);

  if (resolvedKind === RGBA_32BPP && data.length >= pixels * 4) {
    return { data: new Uint8ClampedArray(data.subarray(0, pixels * 4)), width, height };
  }

  if (resolvedKind === RGB_24BPP && data.length >= pixels * 3) {
    const rgba = new Uint8ClampedArray(pixels * 4);
    for (let index = 0; index < pixels; index += 1) {
      const from = index * 3;
      const to = index * 4;
      rgba[to] = data[from];
      rgba[to + 1] = data[from + 1];
      rgba[to + 2] = data[from + 2];
      rgba[to + 3] = 255;
    }
    return { data: rgba, width, height };
  }

  if (resolvedKind === GRAYSCALE_1BPP) {
    // Same polarity as pdf.js: a set bit is white, a cleared bit is black.
    const rgba = new Uint8ClampedArray(pixels * 4);
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = data[y * rowBytes + (x >> 3)] ?? 0xff;
        const white = (byte >> (7 - (x & 7))) & 1;
        const to = (y * width + x) * 4;
        const value = white ? 255 : 0;
        rgba[to] = value;
        rgba[to + 1] = value;
        rgba[to + 2] = value;
        rgba[to + 3] = 255;
      }
    }
    return { data: rgba, width, height };
  }

  return null;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(payload.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, payload.length);
  for (let index = 0; index < 4; index += 1) {
    chunk[4 + index] = type.charCodeAt(index);
  }
  chunk.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(chunk.subarray(4, 8 + payload.length)));
  return chunk;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const input = bytes as unknown as BlobPart;
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Minimal PNG writer. Works anywhere `CompressionStream` exists, so images can be
 * embedded without a canvas (which is what the Node based tests use).
 */
export async function rgbaToPng(image: RgbaImage): Promise<Uint8Array> {
  const { width, height, data } = image;
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const from = y * stride;
    const to = y * (stride + 1);
    raw[to] = 1; // "Sub" filter: differences against the pixel to the left.
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? data[from + x - 4] : 0;
      raw[to + 1 + x] = (data[from + x] - left) & 0xff;
    }
  }

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: truecolour + alpha
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const chunks = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', await deflate(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const total = chunks.reduce((size, chunk) => size + chunk.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  return png;
}

async function canvasToImage(
  canvas: HTMLCanvasElement,
  lossy: boolean,
): Promise<EncodedImage | null> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, lossy ? 'image/jpeg' : 'image/png', lossy ? 0.9 : undefined),
  );
  if (!blob) return null;
  return { data: new Uint8Array(await blob.arrayBuffer()), type: lossy ? 'jpg' : 'png' };
}

/** Browser fast path: the canvas encoders are native and much faster for photos. */
async function encodeWithCanvas(image: RgbaImage, lossy: boolean): Promise<EncodedImage | null> {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const pixels = context.createImageData(image.width, image.height);
    pixels.data.set(image.data);
    context.putImageData(pixels, 0, 0);
    return await canvasToImage(canvas, lossy);
  } catch {
    return null;
  }
}

/** True when every pixel is fully opaque, i.e. the picture can be stored as JPEG. */
function isOpaque(data: Uint8Array | Uint8ClampedArray): boolean {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] !== 255) return false;
  }
  return true;
}

/** Encodes one pdf.js image so it can be written into a DOCX. */
export async function encodeImageSource(source: PdfImageSource): Promise<EncodedImage | null> {
  const rgba = toRgba(source);
  if (!rgba) return source.bitmap ? encodeBitmap(source.bitmap) : null;

  // Keep transparency lossless; store large opaque pictures as JPEG to avoid
  // bloating the DOCX with multi-megabyte PNGs.
  const lossy = rgba.width * rgba.height > PHOTO_PIXEL_COUNT && isOpaque(rgba.data);
  const encoded = await encodeWithCanvas(rgba, lossy);
  if (encoded) return encoded;
  return { data: await rgbaToPng(rgba), type: 'png' };
}

/** pdf.js decodes images to bitmaps in browsers; encode those through a canvas. */
async function encodeBitmap(bitmap: ImageBitmap): Promise<EncodedImage | null> {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);

    const lossy =
      bitmap.width * bitmap.height > PHOTO_PIXEL_COUNT &&
      isOpaque(context.getImageData(0, 0, bitmap.width, bitmap.height).data);
    return await canvasToImage(canvas, lossy);
  } catch {
    return null;
  }
}
