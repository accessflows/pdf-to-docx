import { describe, expect, it } from 'vitest';
import { baselineOffset, buildAnchoredLines } from '../src/core/anchoredLayout';
import type { TextFragment } from '../src/core/textLayout';

const fragment = (overrides: Partial<TextFragment> = {}): TextFragment => ({
  str: 'x',
  x: 72,
  y: 100,
  w: 20,
  h: 10,
  bold: false,
  italic: false,
  ...overrides,
});

describe('anchored layout', () => {
  it('keeps the original position of a line instead of reflowing it', () => {
    const [line] = buildAnchoredLines([fragment({ str: 'Kinh', x: 120, y: 200, w: 32, h: 12 })]);

    expect(line).toMatchObject({ x: 120, baseline: 200, width: 32, fontSize: 12 });
    expect(line.top).toBeCloseTo(200 - baselineOffset(12), 5);
    expect(baselineOffset(12)).toBeCloseTo(12 * 1.2 * 0.81, 5);
    expect(line.runs).toEqual([
      { str: 'Kinh', bold: false, italic: false, fontFamily: undefined },
    ]);
  });

  it('puts fragments of the same baseline on one line and joins equal styles', () => {
    const lines = buildAnchoredLines([
      fragment({ str: 'Xin ', x: 72, y: 100, w: 22 }),
      fragment({ str: 'chào', x: 94, y: 100.4, w: 24 }),
      fragment({ str: '!', x: 118, y: 100, w: 3, bold: true }),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].runs.map((run) => run.str)).toEqual(['Xin chào', '!']);
    expect(lines[0].width).toBe(49);
  });

  it('starts a new anchored segment after a wide gap, like a table column or a tab', () => {
    const lines = buildAnchoredLines([
      fragment({ str: 'left', x: 72, y: 100, w: 24 }),
      fragment({ str: 'right', x: 300, y: 100, w: 30 }),
    ]);

    expect(lines.map((line) => [line.x, line.runs[0].str])).toEqual([
      [72, 'left'],
      [300, 'right'],
    ]);
  });

  it('drops whitespace-only fragments and orders lines top to bottom', () => {
    const lines = buildAnchoredLines([
      fragment({ str: 'second', x: 72, y: 140 }),
      fragment({ str: '   ', x: 72, y: 120, w: 8 }),
      fragment({ str: 'first', x: 72, y: 100 }),
    ]);

    expect(lines.map((line) => line.runs[0].str)).toEqual(['first', 'second']);
  });

  it('keeps a minimum width so a single narrow glyph still has a frame', () => {
    const [line] = buildAnchoredLines([fragment({ str: '|', x: 40, y: 100, w: 0.2, h: 10 })]);
    expect(line.width).toBeCloseTo(4, 5);
  });
});
