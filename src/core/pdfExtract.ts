import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextFragment } from './textLayout';

export interface ExtractedPage {
  width: number;
  height: number;
  fragments: TextFragment[];
  charCount: number;
}

const GENERIC_FAMILIES = /^(sans-?serif|serif|monospace|cursive|fantasy|system-ui|math|emoji)$/i;

const FONT_ALIASES: Record<string, string> = {
  arial: 'Arial',
  arialnarrow: 'Arial Narrow',
  arialmt: 'Arial',
  calibri: 'Calibri',
  cambria: 'Cambria',
  candara: 'Candara',
  consolas: 'Consolas',
  courier: 'Courier New',
  couriernew: 'Courier New',
  garamond: 'Garamond',
  georgia: 'Georgia',
  helvetica: 'Arial',
  palatino: 'Palatino Linotype',
  segoeui: 'Segoe UI',
  tahoma: 'Tahoma',
  times: 'Times New Roman',
  timesnewroman: 'Times New Roman',
  timesroman: 'Times New Roman',
  verdana: 'Verdana',
};

/** Turns a PDF font name ("ABCDEF+TimesNewRomanPS-BoldMT") into a Word friendly name. */
export function cleanFontFamily(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let name = raw
    .trim()
    .replace(/^[A-Z]{6}\+/, '')
    .split(',')[0];

  for (let round = 0; round < 5; round += 1) {
    const stripped = name.replace(
      /[-_ ]?(bold|italic|oblique|regular|medium|semibold|demi|light|black|psmt|mt|ps)+$/gi,
      '',
    );
    if (stripped === name) break;
    name = stripped;
  }
  name = name.replace(/[-_ ]+$/, '').trim();

  if (!name || GENERIC_FAMILIES.test(name)) return undefined;
  if (!/[A-Za-z]/.test(name)) return undefined;

  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  return FONT_ALIASES[key] ?? name;
}

function looksBold(hint: string): boolean {
  return /bold|black|heavy|semibold|demi|extrabold/i.test(hint);
}

function looksItalic(hint: string): boolean {
  return /italic|oblique/i.test(hint);
}

export async function extractPage(
  page: PDFPageProxy,
  textColors: [number, number, number][] = [],
): Promise<ExtractedPage> {
  // The viewport applies the page's /Rotate and view box offset, so text lands in
  // display space: a landscape scan marked /Rotate 90 keeps its real size and
  // position instead of being laid out as if it were upright.
  const viewport = page.getViewport({ scale: 1 });
  const width = viewport.width;
  const height = viewport.height;

  const content = await page.getTextContent();
  const styles = (content.styles ?? {}) as Record<string, { fontFamily?: string }>;
  const items = content.items.filter(
    (item): item is Extract<typeof item, { str: string }> => 'str' in item && !!item.str,
  );
  // The operator list gives one fill colour per text run, in the same order as the
  // text items. Only trust it when both lists line up.
  const colors = textColors.length === items.length ? textColors : [];
  const singleColor =
    textColors.length && textColors.every((color) => sameColor(color, textColors[0]))
      ? textColors[0]
      : undefined;

  const fragments: TextFragment[] = [];
  let charCount = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const transform = item.transform;
    const fontSize = Math.hypot(transform[2], transform[3]) || item.height || 10;
    const family = styles[item.fontName]?.fontFamily;
    const hint = `${item.fontName} ${family ?? ''}`;
    const [x, y] = viewport.convertToViewportPoint(transform[4], transform[5]);

    fragments.push({
      str: item.str,
      x,
      // PDF space has its origin bottom-left; the viewport already flips and rotates it.
      y,
      w: item.width,
      h: fontSize,
      bold: looksBold(hint),
      italic: looksItalic(hint),
      fontFamily: cleanFontFamily(family),
      color: colors[index] ?? singleColor,
    });
    charCount += item.str.trim().length;
  }

  return { width, height, fragments, charCount };
}

function sameColor(a: [number, number, number], b: [number, number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02 && Math.abs(a[2] - b[2]) < 0.02;
}
