/**
 * English messages. This file is the reference dictionary: its keys define
 * `MessageKey`, and every other locale has to provide the same keys.
 */
const en = {
  'app.title': 'PDF → DOCX · convert right on your device',
  'app.badge': '100% on your device',
  'app.tagline':
    'Convert multiple PDFs to Word at once, right in your browser. Files are never uploaded to a server.',

  'drop.title': 'Drag & drop PDF files here',
  'drop.or': 'or',
  'drop.browse': 'choose files',
  'drop.suffix': '— multiple files, folders included',

  'field.language': 'Language',
  'field.mode': 'Conversion mode',
  'field.imageScale': 'Image quality',
  'field.ocr': 'OCR for scanned PDFs',
  'field.ocrLangs': 'OCR languages',
  'field.columns': 'Detect two-column layout',
  'field.autoStart': 'Convert as soon as files are added',

  'mode.text': 'Text (editable)',
  'mode.layout': 'Exact layout (anchored)',
  'mode.visual': 'Images (keep pages as-is)',

  'scale.72': '72 dpi (small)',
  'scale.108': '108 dpi',
  'scale.144': '144 dpi',
  'scale.216': '216 dpi (sharp)',

  'ocr.auto': 'Auto when a page has no text',
  'ocr.force': 'Always run OCR',
  'ocr.off': 'Off',

  'ocrLang.vieEng': 'Vietnamese + English',
  'ocrLang.chiEng': 'Chinese + English',
  'ocrLang.jpnEng': 'Japanese + English',
  'ocrLang.korEng': 'Korean + English',
  'ocrLang.rusEng': 'Russian + English',
  'ocrLang.eng': 'English only',

  'action.convert': 'Convert',
  'action.converting': 'Converting…',
  'action.convertCount': 'Convert ({count})',
  'action.convertAgain': 'Convert again',
  'action.downloadAll': 'Download all (.zip)',
  'action.zipping': 'Compressing…',
  'action.clear': 'Clear list',
  'action.download': 'Download .docx',
  'action.downloadPages': 'Download .docx ({pages})',
  'action.retry': 'Try again',
  'action.remove': 'Remove',

  'summary.empty': 'No files yet.',
  'summary.files': 'Files: {count}',
  'summary.done': 'Done: {count}',
  'summary.running': 'Running: {count}',
  'summary.queued': 'Queued: {count}',
  'summary.failed': 'Failed: {count}',

  'status.queued': 'Waiting',
  'status.processing': 'Processing…',
  'status.done': 'Done',
  'status.error': 'Error',
  'status.readingPdf': 'Reading PDF…',

  'progress.reading': 'Reading page {page}/{pages}',
  'progress.ocr': 'OCR page {page}/{pages}',
  'progress.render': 'Rendering page {page}/{pages}',
  'progress.write': 'Writing DOCX…',

  'batch.converting': 'Converting {done}/{total} · {percent}%',

  'toast.noPdf': 'No PDF files found.',
  'toast.zipFailed': 'Could not create the ZIP file.',

  'footnote.title': 'Note:',
  'footnote.body':
    'files are processed with JavaScript on your device. Exact layout keeps every line where the PDF had it, text mode rebuilds cleaner paragraphs, image mode keeps the pages pixel-identical. Pages that are a single large picture (book covers, scans) are kept as an image. OCR downloads language data (~5–15 MB) from a CDN the first time.',

  'warning.blankPages':
    'Pages without a text layer (scanned PDF) were left blank: {pages}. Turn on OCR to convert them.',
  'warning.picturePages':
    'Pages that are a single picture (cover or scan) were kept as an image: {pages}.',
  'warning.ocr': 'OCR recognised {count} pages — please proofread for typos.',

  'error.password': 'This PDF is password protected, so it cannot be converted.',
  'error.invalidPdf': 'The file is not a valid PDF or it is corrupted.',
  'error.unreadablePdf': 'Could not read the PDF content.',
  'error.canvas': 'This browser does not support canvas 2D.',
  'error.pageImage': 'Could not create an image from the PDF page.',
} as const;

export type MessageKey = keyof typeof en;

export default en;
