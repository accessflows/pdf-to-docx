import { describe, expect, it } from 'vitest';
import {
  groupIntoParagraphs,
  groupLines,
  layoutPage,
  splitFragmentsIntoColumns,
  type TextFragment,
} from '../src/core/textLayout';
import { cleanFontFamily } from '../src/core/pdfExtract';

const CHAR_WIDTH_RATIO = 0.5;

function fragment(text: string, x: number, y: number, size = 12, bold = false): TextFragment {
  return {
    str: text,
    x,
    y,
    w: text.length * size * CHAR_WIDTH_RATIO,
    h: size,
    bold,
    italic: false,
  };
}

describe('groupLines', () => {
  it('merges fragments sharing a baseline and restores missing spaces', () => {
    const lines = groupLines([
      fragment('Xin', 72, 100),
      fragment('chao', 72 + 'Xin'.length * 6 + 3, 100),
      fragment('ban', 150, 100),
      fragment('dong', 72, 114),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('Xin chao ban');
    expect(lines[1].text).toBe('dong');
  });

  it('ignores blank fragments', () => {
    expect(groupLines([fragment('   ', 10, 10), fragment('', 20, 10)])).toHaveLength(0);
  });
});

describe('groupIntoParagraphs', () => {
  const margins = { top: 72, right: 72, bottom: 72, left: 72 };

  it('starts a new paragraph when the font size changes', () => {
    const lines = groupLines([
      fragment('Tieu de lon', 72, 80, 24, true),
      fragment('Noi dung thuong o day.', 72, 130, 12),
    ]);

    const paragraphs = groupIntoParagraphs(lines, 12, 595, margins);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toMatchObject({ heading: true, bold: true });
    expect(paragraphs[1].heading).toBe(false);
  });

  it('keeps consecutive lines of the same size in one paragraph', () => {
    const body = 'Mot doan van gom nhieu dong lien tiep can duoc gop lai thanh mot doan duy nhat.';
    const lines = groupLines([
      fragment(body, 72, 100, 12),
      fragment(body, 72, 115, 12),
      fragment(body, 72, 130, 12),
    ]);

    const paragraphs = groupIntoParagraphs(lines, 12, 595, margins);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text.match(/Mot doan van/g)).toHaveLength(3);
    expect(paragraphs[0].lineRatio).toBeCloseTo(1.25, 1);
  });

  it('joins words split by a trailing hyphen', () => {
    const lines = groupLines([
      fragment('Chuyen doi phan mem nay rat huu', 72, 100, 12),
      fragment('ich cho moi nguoi dung van phong.', 72, 115, 12),
    ]);

    const paragraphs = groupIntoParagraphs(lines, 12, 595, margins);
    expect(paragraphs[0].text).toBe(
      'Chuyen doi phan mem nay rat huu ich cho moi nguoi dung van phong.',
    );
  });
});

describe('splitFragmentsIntoColumns', () => {
  const margins = { top: 72, right: 72, bottom: 72, left: 72 };

  function columnFragments(rows = 7): TextFragment[] {
    const fragments: TextFragment[] = [];
    for (let index = 0; index < rows; index += 1) {
      fragments.push(fragment('Cot trai nam o ben trai trang.', 72, 100 + index * 14));
      fragments.push(fragment('Cot phai nam o ben phai trang.', 320, 100 + index * 14));
    }
    return fragments;
  }

  it('splits a page whose columns share baselines', () => {
    const groups = splitFragmentsIntoColumns(columnFragments(), 595, margins);

    expect(groups).toHaveLength(2);
    expect(Math.max(...groups[0].map((item) => item.x))).toBeLessThan(300);
    expect(Math.min(...groups[1].map((item) => item.x))).toBeGreaterThan(300);
  });

  it('keeps a single column when a fragment crosses the gutter', () => {
    const fragments = [
      ...columnFragments(),
      fragment('Mot tieu de chay ngang qua ca hai cot cua trang nay.', 72, 60, 16),
    ];

    expect(splitFragmentsIntoColumns(fragments, 595, margins)).toHaveLength(1);
  });

  it('reads the left column before the right column', () => {
    const page = layoutPage(columnFragments(), 595, 842, { detectColumns: true });

    expect(page.paragraphs).toHaveLength(2);
    expect(page.paragraphs[0].text).toContain('Cot trai');
    expect(page.paragraphs[1].text).toContain('Cot phai');
  });
});

describe('layoutPage', () => {
  it('centres a heading that sits in the middle of the text area', () => {
    const title = 'Bao cao';
    const titleWidth = title.length * 24 * CHAR_WIDTH_RATIO;
    // 75 characters at 12pt keeps the right margin at ~72pt, so the text area
    // centre is (72 + 523) / 2.
    const bodyText = 'Noi dung cua trang. '.repeat(6).slice(0, 75);
    const areaCenter = (72 + (72 + bodyText.length * 12 * CHAR_WIDTH_RATIO)) / 2;

    const page = layoutPage(
      [
        fragment(title, areaCenter - titleWidth / 2, 80, 24, true),
        fragment(bodyText, 72, 140, 12),
      ],
      595,
      842,
      { detectColumns: true },
    );

    expect(page.paragraphs[0].align).toBe('center');
    expect(page.paragraphs[0].heading).toBe(true);
    expect(page.paragraphs[1].align).toBe('left');
  });
});

describe('cleanFontFamily', () => {
  it('strips subset prefixes and style suffixes', () => {
    expect(cleanFontFamily('ABCDEF+TimesNewRomanPS-BoldMT')).toBe('Times New Roman');
    expect(cleanFontFamily('Arial-BoldItalic')).toBe('Arial');
  });

  it('drops generic font families', () => {
    expect(cleanFontFamily('sans-serif')).toBeUndefined();
    expect(cleanFontFamily(undefined)).toBeUndefined();
  });
});
