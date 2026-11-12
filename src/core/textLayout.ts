/**
 * Turns positioned PDF text fragments into lines / paragraphs.
 * Everything in this module is pure so it can be unit tested without a browser.
 */

export interface TextFragment {
  str: string;
  /** Left edge, in points, from the page left edge. */
  x: number;
  /** Baseline, in points, from the page top edge. */
  y: number;
  /** Advance width in points. */
  w: number;
  /** Font size in points. */
  h: number;
  bold: boolean;
  italic: boolean;
  fontFamily?: string;
  /** Fill colour as 0..1 RGB, when the PDF told us. */
  color?: [number, number, number];
}

export interface LineBox {
  fragments: TextFragment[];
  text: string;
  x: number;
  right: number;
  baseline: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type Alignment = 'left' | 'center';

export interface ParagraphBox {
  lines: LineBox[];
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: Alignment;
  /** Vertical gap (pt) between this paragraph and the previous one. */
  gapBefore: number;
  /** Extra left offset (pt) relative to the page margin. */
  indentLeft: number;
  /** Line height as a multiple of the font size (1.2 = single spacing). */
  lineRatio: number;
  heading: boolean;
}

export interface PageLayout {
  width: number;
  height: number;
  margins: Margins;
  paragraphs: ParagraphBox[];
  charCount: number;
}

const DEFAULT_MARGIN = 56;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isLowerLetter(char: string | undefined): boolean {
  return !!char && /\p{Ll}/u.test(char);
}

function endsWithHyphen(text: string): boolean {
  return /\p{L}-$/u.test(text);
}

export function advanceWidth(fragment: TextFragment): number {
  return fragment.w > 0 ? fragment.w : fragment.str.length * fragment.h * 0.5;
}

/** True when the horizontal gap between two fragments means a missing space. */
export function needsSpace(previousEnd: number, previousSize: number, next: TextFragment): boolean {
  const gap = next.x - previousEnd;
  const threshold = Math.max(0.8, Math.min(previousSize || next.h, next.h) * 0.22);
  return gap > threshold;
}

/** Joins the fragments of one visual line, inserting the spaces PDFs like to omit. */
export function joinFragments(fragments: TextFragment[]): string {
  let text = '';
  let prevEnd = Number.NaN;
  let prevSize = 0;

  for (const fragment of fragments) {
    const piece = fragment.str;
    if (!piece) continue;

    if (text && !Number.isNaN(prevEnd)) {
      const needsGap =
        needsSpace(prevEnd, prevSize, fragment) &&
        !/\s$/.test(text) &&
        !/^\s/.test(piece) &&
        !/^[,.;:!?)\]]/.test(piece);
      if (needsGap) text += ' ';
    }

    text += piece;
    prevEnd = fragment.x + advanceWidth(fragment);
    prevSize = fragment.h;
  }

  return text.replace(/[\u00a0\t]/g, ' ').replace(/ {2,}/g, ' ').trim();
}

function makeLine(fragments: TextFragment[]): LineBox {
  const sorted = [...fragments].sort((a, b) => a.x - b.x);
  const dominant = sorted.reduce(
    (best, fragment) => (fragment.str.trim().length > best.str.trim().length ? fragment : best),
    sorted[0],
  );
  let right = 0;
  for (const fragment of sorted) {
    right = Math.max(right, fragment.x + advanceWidth(fragment));
  }

  return {
    fragments: sorted,
    text: joinFragments(sorted),
    x: sorted[0].x,
    right,
    baseline: sorted[0].y,
    fontSize: dominant.h || 10,
    bold: dominant.bold,
    italic: dominant.italic,
  };
}

/** Groups fragments whose baselines are close enough to belong to the same visual line. */
export function groupLines(fragments: TextFragment[]): LineBox[] {
  const usable = fragments.filter((fragment) => fragment.str.trim().length > 0);
  usable.sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: LineBox[] = [];
  let bucket: TextFragment[] = [];

  for (const fragment of usable) {
    const previous = bucket[bucket.length - 1];
    if (previous) {
      const tolerance = Math.max(1.2, Math.min(previous.h, fragment.h) * 0.45);
      if (Math.abs(previous.y - fragment.y) > tolerance) {
        lines.push(makeLine(bucket));
        bucket = [];
      }
    }
    bucket.push(fragment);
  }
  if (bucket.length) lines.push(makeLine(bucket));

  return lines.filter((line) => line.text.length > 0);
}

/** Font size that carries the most characters — treated as the body text size. */
export function bodyFontSize(lines: LineBox[]): number {
  const weights = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.fontSize * 2) / 2;
    weights.set(key, (weights.get(key) ?? 0) + line.text.length);
  }
  let best = 11;
  let bestWeight = -1;
  for (const [size, weight] of weights) {
    if (weight > bestWeight) {
      best = size;
      bestWeight = weight;
    }
  }
  return best;
}

function computeMargins(lines: LineBox[], width: number, height: number): Margins {
  if (!lines.length) {
    return { top: DEFAULT_MARGIN, right: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN, left: DEFAULT_MARGIN };
  }

  let left = Number.POSITIVE_INFINITY;
  let right = 0;
  let top = Number.POSITIVE_INFINITY;
  let bottom = 0;

  for (const line of lines) {
    left = Math.min(left, line.x);
    right = Math.max(right, line.right);
    top = Math.min(top, line.baseline - line.fontSize);
    bottom = Math.max(bottom, line.baseline + line.fontSize * 0.3);
  }

  const maxH = width * 0.35;
  const maxV = height * 0.35;

  return {
    left: clamp(left, 4, maxH),
    right: clamp(width - right, 4, maxH),
    top: clamp(top, 4, maxV),
    bottom: clamp(height - bottom, 4, maxV),
  };
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function makeParagraph(
  lines: LineBox[],
  body: number,
  pageWidth: number,
  margins: Margins,
  gapBefore: number,
): ParagraphBox {
  const text = joinLines(lines);
  const fontSize = median(lines.map((line) => line.fontSize)) || body;
  const areaLeft = margins.left;
  const areaRight = pageWidth - margins.right;
  const areaWidth = Math.max(1, areaRight - areaLeft);
  const areaCenter = (areaLeft + areaRight) / 2;

  const widest = lines.reduce((best, line) => (line.right - line.x > best.right - best.x ? line : best), lines[0]);
  const centered =
    Math.abs((widest.x + widest.right) / 2 - areaCenter) < Math.max(4, areaWidth * 0.02) &&
    widest.right - widest.x < areaWidth * 0.85;

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i += 1) gaps.push(lines[i].baseline - lines[i - 1].baseline);
  const gap = median(gaps);
  const lineRatio = Number.isFinite(gap) ? clamp(gap / Math.max(1, fontSize), 0.9, 2.6) : 1.2;

  return {
    lines,
    text,
    fontSize,
    bold: lines.every((line) => line.bold),
    italic: lines.every((line) => line.italic),
    align: centered ? 'center' : 'left',
    gapBefore: clamp(gapBefore, 0, 40),
    indentLeft: centered ? 0 : Math.max(0, lines[0].x - areaLeft),
    lineRatio,
    heading: fontSize > body * 1.12 + 0.01,
  };
}

function joinLines(lines: LineBox[]): string {
  let text = '';
  for (const line of lines) {
    if (!text) {
      text = line.text;
      continue;
    }
    if (endsWithHyphen(text) && isLowerLetter(line.text[0])) {
      text = `${text.slice(0, -1)}${line.text}`;
    } else {
      text = `${text} ${line.text}`;
    }
  }
  return text;
}

interface Gutter {
  start: number;
  end: number;
}

/** Finds a vertical whitespace band that could separate two columns. */
function findGutter(fragments: TextFragment[], pageWidth: number, margins: Margins): Gutter | null {
  if (fragments.length < 12) return null;

  const step = 2;
  const start = margins.left;
  const end = pageWidth - margins.right;
  const slots = Math.max(1, Math.floor((end - start) / step));
  if (slots < 20) return null;

  const coverage = new Array<number>(slots + 1).fill(0);
  for (const fragment of fragments) {
    const from = clamp(Math.floor((fragment.x - start) / step), 0, slots);
    const to = clamp(Math.ceil((fragment.x + advanceWidth(fragment) - start) / step), 0, slots);
    for (let i = from; i <= to; i += 1) coverage[i] += 1;
  }

  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let i = 0; i <= slots; i += 1) {
    if (coverage[i] === 0) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      if (i - runStart > bestLength) {
        bestLength = i - runStart;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }
  if (runStart >= 0 && slots + 1 - runStart > bestLength) {
    bestLength = slots + 1 - runStart;
    bestStart = runStart;
  }
  if (bestStart < 0) return null;

  const gutterStart = start + bestStart * step;
  const gutterEnd = start + (bestStart + bestLength - 1) * step;
  const gutterWidth = gutterEnd - gutterStart;
  const gutterCenter = (gutterStart + gutterEnd) / 2;

  if (gutterWidth < Math.max(6, pageWidth * 0.012)) return null;
  if (gutterCenter < pageWidth * 0.3 || gutterCenter > pageWidth * 0.7) return null;

  return { start: gutterStart, end: gutterEnd };
}

/**
 * Splits the page fragments into two reading groups when a real gutter is
 * found. Columns must be detected before lines are grouped: two-column layouts
 * often share baselines, and grouping first would interleave the columns.
 */
export function splitFragmentsIntoColumns(
  fragments: TextFragment[],
  pageWidth: number,
  margins: Margins,
): TextFragment[][] {
  const gutter = findGutter(fragments, pageWidth, margins);
  if (!gutter) return [fragments];

  const left: TextFragment[] = [];
  const right: TextFragment[] = [];

  for (const fragment of fragments) {
    const rightEdge = fragment.x + advanceWidth(fragment);
    if (rightEdge <= gutter.start) left.push(fragment);
    else if (fragment.x >= gutter.end) right.push(fragment);
    else return [fragments];
  }

  if (left.length < 4 || right.length < 4) return [fragments];

  const rangeOf = (group: TextFragment[]) => ({
    top: Math.min(...group.map((fragment) => fragment.y)),
    bottom: Math.max(...group.map((fragment) => fragment.y)),
  });
  const leftRange = rangeOf(left);
  const rightRange = rangeOf(right);
  const overlap =
    Math.min(leftRange.bottom, rightRange.bottom) - Math.max(leftRange.top, rightRange.top);
  const shortest = Math.min(leftRange.bottom - leftRange.top, rightRange.bottom - rightRange.top);
  if (shortest <= 0 || overlap / shortest < 0.5) return [fragments];

  return [left, right];
}

export interface LayoutOptions {
  detectColumns: boolean;
}

export function layoutPage(
  fragments: TextFragment[],
  width: number,
  height: number,
  options: LayoutOptions,
): PageLayout {
  const lines = groupLines(fragments);
  const margins = computeMargins(lines, width, height);

  if (!lines.length) {
    return { width, height, margins, paragraphs: [], charCount: 0 };
  }

  const body = bodyFontSize(lines);
  const groups = options.detectColumns
    ? splitFragmentsIntoColumns(fragments, width, margins)
    : [fragments];

  const paragraphs: ParagraphBox[] = [];
  for (const group of groups) {
    const blocks = groupIntoParagraphs(groupLines(group), body, width, margins);
    if (paragraphs.length && blocks.length) {
      blocks[0] = { ...blocks[0], gapBefore: Math.max(blocks[0].gapBefore, 10) };
    }
    paragraphs.push(...blocks);
  }

  return {
    width,
    height,
    margins,
    paragraphs,
    charCount: lines.reduce((total, line) => total + line.text.length, 0),
  };
}

export function groupIntoParagraphs(
  lines: LineBox[],
  body: number,
  pageWidth: number,
  margins: Margins,
): ParagraphBox[] {
  const textWidth = Math.max(1, pageWidth - margins.left - margins.right);
  const paragraphs: ParagraphBox[] = [];
  let current: LineBox[] = [];

  const flush = (gapBefore: number) => {
    if (!current.length) return;
    paragraphs.push(makeParagraph(current, body, pageWidth, margins, gapBefore));
    current = [];
  };

  for (const line of lines) {
    const previous = current[current.length - 1];
    if (!previous) {
      current.push(line);
      continue;
    }

    const size = Math.max(previous.fontSize, line.fontSize);
    const sameSize = Math.abs(previous.fontSize - line.fontSize) <= previous.fontSize * 0.1;
    const gap = line.baseline - previous.baseline;
    const previousIsShort = previous.right < margins.left + textWidth * 0.85;

    const startsNew =
      !sameSize ||
      gap <= 0 ||
      gap > size * 1.9 ||
      (gap > size * 1.35 && previousIsShort);

    if (startsNew) {
      flush(gap - previous.fontSize * 1.2);
      current.push(line);
    } else {
      current.push(line);
    }
  }
  flush(0);

  return paragraphs;
}

export function emptyPageLayout(width: number, height: number): PageLayout {
  return {
    width,
    height,
    margins: { top: DEFAULT_MARGIN, right: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN, left: DEFAULT_MARGIN },
    paragraphs: [],
    charCount: 0,
  };
}
