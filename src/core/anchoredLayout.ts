/**
 * Turns positioned PDF text fragments into lines that keep their exact place on
 * the page. `textLayout` deliberately reflows text into paragraphs; this module
 * does the opposite, so the DOCX writer can anchor every line where the PDF had
 * it. Pure functions, so it can be tested without a browser.
 */

import type { TextFragment } from './textLayout';

/** A run of text with the styling of the PDF glyphs it comes from. */
export interface AnchoredRun {
  str: string;
  bold: boolean;
  italic: boolean;
  fontFamily?: string;
}

/** A line segment that keeps its absolute position (points, from the page top-left). */
export interface AnchoredLine {
  /** Left edge. */
  x: number;
  /** Top of the text box, i.e. where Word should start the line. */
  top: number;
  /** Baseline, kept for tests and for tuning the ascent. */
  baseline: number;
  /** Width of the glyphs. */
  width: number;
  fontSize: number;
  runs: AnchoredRun[];
}

/** Single line height as a share of the font size. */
export const LINE_HEIGHT_RATIO = 1.2;

/**
 * Share of the line box that sits above the baseline (Arial-like metrics:
 * ascent 0.905 em over ascent + descent 1.117 em ≈ 0.81).
 */
export const ASCENT_SHARE = 0.81;

/** Distance from the top of a line box down to the baseline, in points. */
export function baselineOffset(fontSize: number): number {
  return fontSize * LINE_HEIGHT_RATIO * ASCENT_SHARE;
}

/** Fragments whose baselines differ by less than this (× font size) share a line. */
const BASELINE_TOLERANCE = 0.35;

/** A horizontal gap wider than this (× font size) starts a new anchored segment. */
const SEGMENT_GAP_RATIO = 1.5;

const MIN_GAP = 2;

function mergeRuns(fragments: TextFragment[]): AnchoredRun[] {
  const runs: AnchoredRun[] = [];

  for (const fragment of fragments) {
    const last = runs[runs.length - 1];
    if (last && last.bold === fragment.bold && last.italic === fragment.italic && last.fontFamily === fragment.fontFamily) {
      last.str += fragment.str;
      continue;
    }
    runs.push({
      str: fragment.str,
      bold: fragment.bold,
      italic: fragment.italic,
      fontFamily: fragment.fontFamily,
    });
  }

  return runs;
}

/**
 * Groups fragments into anchored lines: same baseline first, then split where
 * the PDF leaves a wide horizontal gap (columns, tab stops, table cells).
 */
export function buildAnchoredLines(fragments: TextFragment[]): AnchoredLine[] {
  const usable = fragments
    .filter((fragment) => fragment.str.trim().length > 0)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const rows: TextFragment[][] = [];
  let rowBaseline = Number.NEGATIVE_INFINITY;

  for (const fragment of usable) {
    const tolerance = Math.max(1, fragment.h * BASELINE_TOLERANCE);
    if (!rows.length || Math.abs(fragment.y - rowBaseline) > tolerance) {
      rows.push([fragment]);
      rowBaseline = fragment.y;
      continue;
    }
    rows[rows.length - 1].push(fragment);
  }

  const lines: AnchoredLine[] = [];

  for (const row of rows) {
    const sorted = row.slice().sort((a, b) => a.x - b.x);
    let segment: TextFragment[] = [];

    const flush = () => {
      if (!segment.length) return;
      const first = segment[0];
      const right = Math.max(...segment.map((fragment) => fragment.x + fragment.w));
      const fontSize = Math.max(...segment.map((fragment) => fragment.h));
      lines.push({
        x: first.x,
        top: first.y - baselineOffset(fontSize),
        baseline: first.y,
        width: Math.max(fontSize * 0.4, right - first.x),
        fontSize,
        runs: mergeRuns(segment),
      });
      segment = [];
    };

    for (const fragment of sorted) {
      const previous = segment[segment.length - 1];
      if (previous) {
        const gap = fragment.x - (previous.x + previous.w);
        const threshold = Math.max(MIN_GAP, previous.h * SEGMENT_GAP_RATIO);
        if (gap > threshold || fragment.x < previous.x) flush();
      }
      segment.push(fragment);
    }
    flush();
  }

  return lines.sort((a, b) => a.baseline - b.baseline || a.x - b.x);
}
