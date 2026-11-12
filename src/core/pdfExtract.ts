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

export async function extractPage(page: PDFPageProxy): Promise<ExtractedPage> {
  const view = page.view;
  const originX = view[0];
  const originY = view[1];
  const width = view[2] - originX;
  const height = view[3] - originY;

  const content = await page.getTextContent();
  const styles = (content.styles ?? {}) as Record<string, { fontFamily?: string }>;
  const fragments: TextFragment[] = [];
  let charCount = 0;

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue;

    const transform = item.transform;
    const fontSize = Math.hypot(transform[2], transform[3]) || item.height || 10;
    const family = styles[item.fontName]?.fontFamily;
    const hint = `${item.fontName} ${family ?? ''}`;

    fragments.push({
      str: item.str,
      x: transform[4] - originX,
      // PDF space has its origin bottom-left; convert to a top-down baseline.
      y: height - (transform[5] - originY),
      w: item.width,
      h: fontSize,
      bold: looksBold(hint),
      italic: looksItalic(hint),
      fontFamily: cleanFontFamily(family),
    });
    charCount += item.str.trim().length;
  }

  return { width, height, fragments, charCount };
}
