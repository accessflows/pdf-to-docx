type TesseractModule = typeof import('tesseract.js');
type TesseractWorker = Awaited<ReturnType<TesseractModule['createWorker']>>;

let workerPromise: Promise<TesseractWorker> | null = null;
let workerLangs = '';
let progressHandler: ((progress: number) => void) | undefined;

async function getWorker(
  langs: string,
  onProgress?: (progress: number) => void,
): Promise<TesseractWorker> {
  progressHandler = onProgress;

  if (workerPromise && workerLangs === langs) return workerPromise;

  await terminateOcrWorker();
  workerLangs = langs;
  workerPromise = (async () => {
    // Loaded on demand: tesseract.js + its WASM core are only fetched when OCR is used.
    const { createWorker, OEM } = await import('tesseract.js');
    return createWorker(langs, OEM.LSTM_ONLY, {
      logger: (message) => {
        if (typeof message.progress === 'number') progressHandler?.(message.progress);
      },
    });
  })();

  return workerPromise;
}

/**
 * Runs OCR on a rendered page and returns one string per detected paragraph.
 * Requires network access the first time (Tesseract core + language data are
 * fetched from their CDN, then cached by the browser).
 */
export async function recognizeParagraphs(
  source: HTMLCanvasElement,
  langs: string,
  onProgress?: (progress: number) => void,
): Promise<string[]> {
  const worker = await getWorker(langs, onProgress);
  const result = await worker.recognize(source, {}, { text: true, blocks: true });

  const paragraphs: string[] = [];
  for (const block of result.data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      const text = (paragraph.lines ?? [])
        .map((line) => line.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) paragraphs.push(text);
    }
  }

  if (!paragraphs.length) {
    const raw = (result.data.text ?? '').trim();
    if (raw) {
      paragraphs.push(
        ...raw
          .split(/\n{2,}/)
          .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
          .filter(Boolean),
      );
    }
  }

  return paragraphs;
}

export async function terminateOcrWorker(): Promise<void> {
  const current = workerPromise;
  workerPromise = null;
  workerLangs = '';
  progressHandler = undefined;
  if (!current) return;
  try {
    const worker = await current;
    await worker.terminate();
  } catch {
    // Ignore: the worker may have failed to start or already been terminated.
  }
}
