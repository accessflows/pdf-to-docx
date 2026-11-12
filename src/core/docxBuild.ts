import {
  AlignmentType,
  Document,
  FrameAnchorType,
  FrameWrap,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  type ISectionOptions,
} from 'docx';
import { advanceWidth, needsSpace, type PageLayout, type ParagraphBox } from './textLayout';
import { LINE_HEIGHT_RATIO, type AnchoredLine } from './anchoredLayout';

/** PDF points -> Word twips. */
const twip = (points: number): number => Math.round(points * 20);

/** PDF points -> EMU, what floating drawings use for offsets. */
const emu = (points: number): number => Math.round(points * 12700);

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

/** A block of text without exact line positions (OCR output), anchored as one box. */
export interface LayoutBlock {
  x: number;
  y: number;
  width: number;
  lines: string[];
}

/** A page reproduced with absolute coordinates instead of reflowed text. */
export interface LayoutPage {
  width: number;
  height: number;
  /** Lines that keep their exact position on the page. */
  lines: AnchoredLine[];
  /** Pictures, anchored where the PDF painted them. */
  images?: PageBlockImage[];
  /** Text without positions of its own, e.g. OCR output. */
  blocks?: LayoutBlock[];
}

const EMPTY_PAGE: PageLayout = {
  width: 595.28,
  height: 841.89,
  margins: { top: 56, right: 56, bottom: 56, left: 56 },
  paragraphs: [],
  charCount: 0,
};

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
  color?: [number, number, number];
}

/** 0..1 RGB -> the `RRGGBB` string Word expects. */
function hexColor(color: [number, number, number]): string {
  return color
    .map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function runColor(color?: [number, number, number]): string | undefined {
  if (!color) return undefined;
  const hex = hexColor(color);
  return hex === '000000' ? undefined : hex;
}

export function buildRuns(paragraph: ParagraphBox): TextRun[] {
  const size = Math.max(2, Math.round(paragraph.fontSize * 2));
  const makeRun = (chunk: RunChunk) =>
    new TextRun({
      text: chunk.text,
      bold: chunk.bold,
      italics: chunk.italic,
      font: chunk.font,
      size,
      color: runColor(chunk.color),
    });

  if (!paragraph.lines.length) {
    return [makeRun({ text: paragraph.text, bold: paragraph.bold, italic: paragraph.italic })];
  }

  const chunks: RunChunk[] = [];
  const append = (text: string, chunk: Omit<RunChunk, 'text'>) => {
    if (!text) return;
    const last = chunks[chunks.length - 1];
    if (
      last &&
      last.bold === chunk.bold &&
      last.italic === chunk.italic &&
      last.font === chunk.font &&
      last.color === chunk.color
    ) {
      last.text += text;
      return;
    }
    chunks.push({ text, ...chunk });
  };

  for (let index = 0; index < paragraph.lines.length; index += 1) {
    const fragments = paragraph.lines[index].fragments;

    for (let position = 0; position < fragments.length; position += 1) {
      const fragment = fragments[position];
      const style = {
        bold: fragment.bold,
        italic: fragment.italic,
        font: fragment.fontFamily,
        color: fragment.color,
      };
      if (position > 0) {
        const previous = fragments[position - 1];
        const shouldSpace =
          needsSpace(previous.x + advanceWidth(previous), previous.h, fragment) &&
          !/^\s/.test(fragment.str);
        if (shouldSpace) append(' ', style);
      }
      append(fragment.str, style);
    }

    const nextLine = paragraph.lines[index + 1];
    if (!nextLine) continue;

    const tail = chunks[chunks.length - 1];
    const nextFirst = nextLine.fragments[0];
    if (tail && /\p{L}-$/u.test(tail.text) && /^\p{Ll}/u.test(nextFirst.str)) {
      tail.text = tail.text.slice(0, -1);
    } else {
      append(' ', {
        bold: nextFirst.bold,
        italic: nextFirst.italic,
        font: nextFirst.fontFamily,
        color: nextFirst.color,
      });
    }
  }

  return chunks.map(makeRun);
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
      : [sectionFor(EMPTY_PAGE, [])],
  });
}

export function buildVisualDocument(pages: RenderedPage[]): Document {  const sections: ISectionOptions[] = pages.map((page) => ({
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

/** A picture pinned to a page coordinate, drawn behind the text. */
function anchoredPicture(image: PageBlockImage, zIndex: number): ImageRun {
  return new ImageRun({
    type: image.type,
    data: image.data,
    transformation: {
      width: Math.max(1, Math.round(image.width * PX_PER_POINT)),
      height: Math.max(1, Math.round(image.height * PX_PER_POINT)),
    },
    floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.PAGE,
        offset: emu(image.x),
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.PAGE,
        offset: emu(image.y),
      },
      behindDocument: true,
      allowOverlap: true,
      zIndex,
      wrap: { type: TextWrappingType.NONE },
    },
  });
}

function anchoredFrame(x: number, y: number, width: number) {
  return {
    type: 'absolute' as const,
    position: { x: twip(x), y: twip(y) },
    width: twip(Math.max(1, width)),
    anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
    wrap: FrameWrap.NONE,
    anchorLock: true,
  };
}

/** One PDF line, placed exactly where it was on the page. */
function anchoredLineParagraph(line: AnchoredLine, pageWidth: number): Paragraph {
  const lineHeight = line.fontSize * LINE_HEIGHT_RATIO;
  // Give the frame all the room to the page edge: a substituted font is often a
  // little wider than the PDF one, and a narrow frame makes Word wrap the line.
  const width = Math.max(line.width, pageWidth - line.x);
  const size = Math.max(2, Math.round(line.fontSize * 2));

  return new Paragraph({
    frame: anchoredFrame(line.x, line.top, width),
    spacing: { before: 0, after: 0, line: twip(lineHeight), lineRule: LineRuleType.EXACT },
    children: line.runs.map(
      (run) =>
        new TextRun({
          text: run.str,
          bold: run.bold,
          italics: run.italic,
          font: run.fontFamily,
          size,
          color: runColor(run.color),
        }),
    ),
  });
}

function anchoredBlockParagraph(block: LayoutBlock): Paragraph {
  return new Paragraph({
    frame: anchoredFrame(block.x, block.y, block.width),
    spacing: { before: 0, after: 0, line: 276, lineRule: LineRuleType.AUTO },
    children: block.lines.map((text, index) => new TextRun({ text, break: index > 0 ? 1 : 0 })),
  });
}

/**
 * Lays the page out with absolute coordinates: pictures float where the PDF
 * painted them and each line of text sits in a frame at its original position.
 * Nothing reflows, so the DOCX looks like the PDF instead of a cleaned-up copy.
 */
export function buildLayoutDocument(pages: LayoutPage[], defaultFont = 'Arial'): Document {
  const sections: ISectionOptions[] = pages.map((page) => {
    const children: Paragraph[] = [];

    if (page.images?.length) {
      // All anchors share one paragraph: floating drawings do not take flow space,
      // but the paragraph that holds them still costs a single line.
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
          children: page.images.map(anchoredPicture),
        }),
      );
    }

    for (const line of page.lines) children.push(anchoredLineParagraph(line, page.width));
    for (const block of page.blocks ?? []) children.push(anchoredBlockParagraph(block));

    return {
      properties: {
        page: {
          size: { width: twip(page.width), height: twip(page.height) },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: children.length ? children : [new Paragraph('')],
    };
  });

  return new Document({
    styles: {
      default: { document: { run: { font: defaultFont, size: 22 } } },
    },
    sections: sections.length ? sections : [sectionFor(EMPTY_PAGE, [])],
  });
}
