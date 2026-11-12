import { describe, expect, it } from 'vitest';
import { toRgba } from '../src/core/imageEncode';

const pixel = (rgba: Uint8ClampedArray, index: number) =>
  Array.from(rgba.slice(index * 4, index * 4 + 4));

describe('pdf image pixels', () => {
  it('paints a stencil mask where the bit is 0 and leaves the rest transparent', () => {
    // 0b0101_0101 -> pixels 0,2,4,6 are painted, 1,3,5,7 stay transparent.
    const image = toRgba({
      width: 8,
      height: 1,
      data: new Uint8Array([0b0101_0101]),
      mask: true,
      color: [1, 0, 0],
    });

    expect(image).not.toBeNull();
    expect(pixel(image!.data, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(image!.data, 1)).toEqual([255, 0, 0, 0]);
    expect(pixel(image!.data, 2)).toEqual([255, 0, 0, 255]);
    expect(pixel(image!.data, 7)).toEqual([255, 0, 0, 0]);
  });

  it('expands RGB pixels to opaque RGBA', () => {
    const image = toRgba({
      width: 2,
      height: 1,
      kind: 2,
      data: new Uint8Array([10, 20, 30, 40, 50, 60]),
    });

    expect(pixel(image!.data, 0)).toEqual([10, 20, 30, 255]);
    expect(pixel(image!.data, 1)).toEqual([40, 50, 60, 255]);
  });

  it('expands 1bpp grey images with the pdf.js polarity', () => {
    const image = toRgba({ width: 2, height: 1, kind: 1, data: new Uint8Array([0b1000_0000]) });
    expect(pixel(image!.data, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(image!.data, 1)).toEqual([0, 0, 0, 255]);
  });
});
