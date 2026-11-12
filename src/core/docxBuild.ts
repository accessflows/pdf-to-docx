import {
  AlignmentType,
  Document,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from 'docx';
import { advanceWidth, needsSpace, type PageLayout, type ParagraphBox } from './textLayout';

/** PDF points -> Word twips. */
const twip = (points: number): number => Math.round(points * 20);

const PX_PER_POINT = 96 / 72;

export interface RenderedPage {
  data: Uint8Array;
  widthPt: number;
  heightPt: number;
}

/** An image to place inside a text page, positioned in points from the page top-left. */
export interface PageBlockImage {
  data: Uint8Array;
  type: 'png' | 'jpg';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One section of a text-mode document: rebuilt paragraphs plus the page's pictures. */
export interface TextPage {
  layout: PageLayout;
  images?: PageBlockImage[];
}

function sectionFor(page: PageLayout, children: Paragraph[]): ISectionOptions {
  return {
    properties: {
      page: {
        size: { width: twip(page.width), height: twip(page.height) },
        margin: {
          top: twip(page.margins.top),
          right: twip(page.margins.right),
          bottom: twip(page.margins.bottom),
          left: twip(page.margins.left),
        },
      },
    },
    children: children.length ? children : [new Paragraph('')],
  };
}

export function buildParagraph(paragraph: ParagraphBox): Paragraph {
  return new Paragraph({
    alignment: paragraph.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: {
      before: twip(paragraph.gapBefore),
      after: 0,
      line: Math.round(paragraph.lineRatio * 200),
      lineRule: LineRuleType.AUTO,
    },
    indent: paragraph.indentLeft > 2 ? { left: twip(paragraph.indentLeft) } : undefined,
    children: buildRuns(paragraph),
  });
}

interface RunChunk {
  text: string;
  bold: boolean;
  italic: boolean;
  font?: string;
}

export function buildRuns(paragraph: ParagraphBox): TextRun[] {
  const size = Math.max(2, Math.round(paragraph.fontSize * 2));
  const makeRun = (text: string, bold: boolean, italic: boolean, font?: string) =>
    new TextRun({ text, bold, italics: italic, font, size });

  if (!paragraph.lines.length) {
    return [makeRun(paragraph.text, paragraph.bold, paragraph.italic)];
  }

  const chunks: RunChunk[] = [];
  const append = (text: string, bold: boolean, italic: boolean, font?: string) => {
    if (!text) return;
    const last = chunks[chunks.length - 1];
    if (last && last.bold === bold && last.italic === italic && last.font === font) {
      last.text += text;
      return;
    }
    chunks.push({ text, bold, italic, font });
  };

  for (let index = 0; index < paragraph.lines.length; index += 1) {
    const fragments = paragraph.lines[index].fragments;

    for (let position = 0; position < fragments.length; position += 1) {
      const fragment = fragments[position];
      if (position > 0) {
        const previous = fragments[position - 1];
        const shouldSpace =
          needsSpace(previous.x + advanceWidth(previous), previous.h, fragment) &&
          !/^\s/.test(fragment.str);
        if (shouldSpace) append(' ', fragment.bold, fragment.italic, fragment.fontFamily);
      }
      append(fragment.str, fragment.bold, fragment.italic, fragment.fontFamily);
    }

    const nextLine = paragraph.lines[index + 1];
    if (!nextLine) continue;

    const tail = chunks[chunks.length - 1];
    const nextFirst = nextLine.fragments[0];
    if (tail && /\p{L}-$/u.test(tail.text) && /^\p{Ll}/u.test(nextFirst.str)) {
      tail.text = tail.text.slice(0, -1);
    } else {
      append(' ', nextFirst.bold, nextFirst.italic, nextFirst.fontFamily);
    }
  }

  return chunks.map((chunk) => makeRun(chunk.text, chunk.bold, chunk.italic, chunk.font));
}

interface PageBlock {
  /** Vertical position on the page, in points from the top, used for ordering. */
  top: number;
  paragraph?: ParagraphBox;
  image?: PageBlockImage;
}

/** Distance from the page top to the first line of a paragraph, in points. */
function paragraphTop(paragraph: ParagraphBox): number | null {
  if (!paragraph.lines.length) return null;
  return paragraph.lines.reduce(
    (top, line) => Math.min(top, line.baseline - line.fontSize),
    Number.POSITIVE_INFINITY,
  );
}

function imageParagraph(
  image: PageBlockImage,
  maxWidth: number,
  maxHeight: number,
): Paragraph {
  const scale = Math.min(
    1,
    maxWidth / Math.max(1, image.width),
    maxHeight / Math.max(1, image.height),
  );

  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [
      new ImageRun({
        type: image.type,
        data: image.data,
        transformation: {
          width: Math.max(1, Math.round(image.width * scale * PX_PER_POINT)),
          height: Math.max(1, Math.round(image.height * scale * PX_PER_POINT)),
        },
      }),
    ],
  });
}

/**
 * Paragraphs and images of one page, ordered the way they appear on it.
 * Positions come from the PDF, so pictures land next to the text they belong to.
 */
function buildPageChildren(page: TextPage): Paragraph[] {
  const { layout } = page;
  const images = page.images ?? [];
  if (!images.length) return layout.paragraphs.map(buildParagraph);

  const blocks: PageBlock[] = [];
  let previousTop = 0;
  for (const paragraph of layout.paragraphs) {
    // OCR paragraphs have no line boxes, so keep them in their original order.
    const top = paragraphTop(paragraph) ?? previousTop;
    previousTop = top;
    blocks.push({ top, paragraph });
  }
  for (const image of images) {
    blocks.push({ top: image.y, image });
  }
  blocks.sort((a, b) => a.top - b.top);

  const availableWidth = layout.width - layout.margins.left - layout.margins.right;
  const availableHeight = layout.height - layout.margins.top - layout.margins.bottom;

  return blocks.map((block) =>
    block.image
      ? imageParagraph(block.image, availableWidth, availableHeight)
      : buildParagraph(block.paragraph as ParagraphBox),
  );
}

export function buildTextDocument(pages: TextPage[], defaultFont = 'Arial'): Document {
  const sections = pages.map((page) => sectionFor(page.layout, buildPageChildren(page)));

  return new Document({
    styles: {
      default: { document: { run: { font: defaultFont, size: 22 } } },
    },
    sections: sections.length
      ? sections
      : [sectionFor({ width: 595.28, height: 841.89, margins: { top: 56, right: 56, bottom: 56, left: 56 }, paragraphs: [], charCount: 0 }, [])],
  });
}

export function buildVisualDocument(pages: RenderedPage[]): Document {
  const sections: ISectionOptions[] = pages.map((page) => ({
    properties: {
      page: {
        size: { width: twip(page.widthPt), height: twip(page.heightPt) },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: 'png',
            data: page.data,
            transformation: {
              width: Math.round(page.widthPt * PX_PER_POINT),
              height: Math.round(page.heightPt * PX_PER_POINT),
            },
          }),
        ],
      }),
    ],
  }));

  return new Document({ sections });
}

export async function packDocument(document: Document): Promise<ArrayBuffer> {
  return Packer.toArrayBuffer(document);
}
