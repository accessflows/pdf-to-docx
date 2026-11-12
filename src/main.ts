import './styles.css';
import JSZip from 'jszip';
import { convertPdf, terminateOcrWorker } from './core/convert';
import {
  ConvertError,
  DEFAULT_OPTIONS,
  OCR_LANGS,
  OPTIONS_STORAGE_KEY,
  replaceExtension,
  type ConvertOptions,
  type ConvertProgress,
  type ConvertWarning,
} from './core/types';
import {
  DEFAULT_LOCALE,
  LOCALES,
  OCR_LANGS_BY_LOCALE,
  formatPages,
  isLocale,
  t,
  type Locale,
  type MessageKey,
} from './i18n';

type JobStatus = 'queued' | 'running' | 'done' | 'error';

interface Job {
  id: string;
  file: File;
  status: JobStatus;
  progress: number;
  detail: string;
  error?: string;
  warnings: ConvertWarning[];
  pageCount?: number;
  blob?: Blob;
  url?: string;
}

const jobs: Job[] = [];
let jobSeq = 0;
let running = false;
let hasOcrWork = false;
let batchJobs: Job[] = [];

function loadOptions(): ConvertOptions {
  try {
    const raw = localStorage.getItem(OPTIONS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS, ocrLangs: OCR_LANGS_BY_LOCALE[DEFAULT_LOCALE] };
    const parsed = JSON.parse(raw) as Partial<ConvertOptions>;
    const locale = isLocale(parsed.locale) ? parsed.locale : DEFAULT_LOCALE;
    return {
      mode:
        parsed.mode === 'visual' || parsed.mode === 'layout' ? parsed.mode : 'text',
      imageScale:
        typeof parsed.imageScale === 'number' ? parsed.imageScale : DEFAULT_OPTIONS.imageScale,
      ocr: parsed.ocr === 'off' || parsed.ocr === 'force' ? parsed.ocr : 'auto',
      ocrLangs: OCR_LANGS.includes(parsed.ocrLangs ?? '')
        ? (parsed.ocrLangs as string)
        : OCR_LANGS_BY_LOCALE[locale],
      detectColumns: parsed.detectColumns !== false,
      autoStart: parsed.autoStart !== false,
      locale,
    };
  } catch {
    return { ...DEFAULT_OPTIONS, ocrLangs: OCR_LANGS_BY_LOCALE[DEFAULT_LOCALE] };
  }
}

const options = loadOptions();

const translator = (key: MessageKey, values?: Record<string, string | number>): string =>
  t(options.locale, key, values);

function saveOptions(): void {
  try {
    localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Storage may be unavailable (private mode); settings simply are not persisted.
  }
}

const LANGUAGE_OPTIONS = LOCALES.map(
  (locale) => `<option value="${locale.id}">${locale.label}</option>`,
).join('');

const SHELL = `
  <div class="topbar">
    <select id="locale" class="lang-select">${LANGUAGE_OPTIONS}</select>
  </div>

  <header class="hero">
    <span class="hero__badge" data-i18n="app.badge"></span>
    <h1>PDF → DOCX</h1>
    <p data-i18n="app.tagline"></p>
  </header>

  <section class="card dropzone" id="dropzone">
    <svg class="dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
    <p class="dropzone__title" data-i18n="drop.title"></p>
    <p class="dropzone__hint"><span data-i18n="drop.or"></span> <button type="button" class="link" id="browse" data-i18n="drop.browse"></button> <span data-i18n="drop.suffix"></span></p>
    <input id="file-input" type="file" accept="application/pdf,.pdf" multiple hidden />
  </section>

  <section class="card options">
    <label class="field">
      <span data-i18n="field.mode"></span>
      <select id="mode">
        <option value="text" data-i18n="mode.text"></option>
        <option value="layout" data-i18n="mode.layout"></option>
        <option value="visual" data-i18n="mode.visual"></option>
      </select>
    </label>
    <label class="field">
      <span data-i18n="field.imageScale"></span>
      <select id="image-scale">
        <option value="1" data-i18n="scale.72"></option>
        <option value="1.5" data-i18n="scale.108"></option>
        <option value="2" data-i18n="scale.144"></option>
        <option value="3" data-i18n="scale.216"></option>
      </select>
    </label>
    <label class="field">
      <span data-i18n="field.ocr"></span>
      <select id="ocr">
        <option value="auto" data-i18n="ocr.auto"></option>
        <option value="force" data-i18n="ocr.force"></option>
        <option value="off" data-i18n="ocr.off"></option>
      </select>
    </label>
    <label class="field">
      <span data-i18n="field.ocrLangs"></span>
      <select id="ocr-langs">
        <option value="vie+eng" data-i18n="ocrLang.vieEng"></option>
        <option value="chi_sim+eng" data-i18n="ocrLang.chiEng"></option>
        <option value="jpn+eng" data-i18n="ocrLang.jpnEng"></option>
        <option value="kor+eng" data-i18n="ocrLang.korEng"></option>
        <option value="rus+eng" data-i18n="ocrLang.rusEng"></option>
        <option value="eng" data-i18n="ocrLang.eng"></option>
      </select>
    </label>
    <label class="field field--check">
      <input type="checkbox" id="detect-columns" />
      <span data-i18n="field.columns"></span>
    </label>
    <label class="field field--check">
      <input type="checkbox" id="auto-start" />
      <span data-i18n="field.autoStart"></span>
    </label>
  </section>

  <div class="toolbar">
    <div class="toolbar__info" id="summary" aria-live="polite"></div>
    <div class="toolbar__actions">
      <button type="button" class="btn btn--primary" id="convert" data-i18n="action.convert"></button>
      <button type="button" class="btn" id="download-all" data-i18n="action.downloadAll"></button>
      <button type="button" class="btn btn--ghost" id="clear" data-i18n="action.clear"></button>
    </div>
  </div>

  <div class="batch" id="batch" hidden>
    <div class="progress progress--thick">
      <div class="progress__bar" id="batch-bar"></div>
    </div>
    <span class="batch__label" id="batch-label" aria-live="polite"></span>
  </div>

  <ul class="list" id="list" aria-live="polite"></ul>

  <p class="footnote">
    <strong data-i18n="footnote.title"></strong> <span data-i18n="footnote.body"></span>
  </p>
  <div class="toast" id="toast" role="status"></div>
`;

const app = document.getElementById('app');
if (!app) throw new Error('Missing #app element');
app.innerHTML = SHELL;

const dropzone = document.getElementById('dropzone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const browseButton = document.getElementById('browse') as HTMLButtonElement;
const listElement = document.getElementById('list') as HTMLUListElement;
const summaryElement = document.getElementById('summary') as HTMLElement;
const convertButton = document.getElementById('convert') as HTMLButtonElement;
const downloadAllButton = document.getElementById('download-all') as HTMLButtonElement;
const clearButton = document.getElementById('clear') as HTMLButtonElement;
const toastElement = document.getElementById('toast') as HTMLElement;

const localeSelect = document.getElementById('locale') as HTMLSelectElement;
const modeSelect = document.getElementById('mode') as HTMLSelectElement;
const imageScaleSelect = document.getElementById('image-scale') as HTMLSelectElement;
const ocrSelect = document.getElementById('ocr') as HTMLSelectElement;
const ocrLangsSelect = document.getElementById('ocr-langs') as HTMLSelectElement;
const detectColumnsInput = document.getElementById('detect-columns') as HTMLInputElement;
const autoStartInput = document.getElementById('auto-start') as HTMLInputElement;
const batchElement = document.getElementById('batch') as HTMLElement;
const batchBar = document.getElementById('batch-bar') as HTMLElement;
const batchLabel = document.getElementById('batch-label') as HTMLElement;

/** Fills every `data-i18n` placeholder with the string for the current locale. */
function applyLocale(): void {
  document.documentElement.lang = options.locale;
  document.title = translator('app.title');
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = translator(element.dataset.i18n as MessageKey);
  }
  // The language picker has no visible label, it only sits in the corner.
  localeSelect.setAttribute('aria-label', translator('field.language'));
  localeSelect.title = translator('field.language');
}

function syncControls(): void {
  localeSelect.value = options.locale;
  modeSelect.value = options.mode;
  imageScaleSelect.value = String(options.imageScale);
  ocrSelect.value = options.ocr;
  ocrLangsSelect.value = options.ocrLangs;
  detectColumnsInput.checked = options.detectColumns;
  autoStartInput.checked = options.autoStart;

  const isVisual = options.mode === 'visual';
  const ocrDisabled = isVisual || options.ocr === 'off';
  imageScaleSelect.disabled = !isVisual;
  ocrSelect.disabled = isVisual;
  ocrLangsSelect.disabled = ocrDisabled;
}

function showToast(message: string): void {
  toastElement.textContent = message;
  toastElement.classList.add('is-visible');
  window.setTimeout(() => toastElement.classList.remove('is-visible'), 2600);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusLabel(job: Job): string {
  switch (job.status) {
    case 'queued':
      return translator('status.queued');
    case 'running':
      return job.detail || translator('status.processing');
    case 'done':
      return translator('status.done');
    default:
      return translator('status.error');
  }
}

function describeProgress(progress: ConvertProgress): string {
  const values = { page: progress.page, pages: progress.pages };
  if (progress.phase === 'ocr') return translator('progress.ocr', values);
  if (progress.phase === 'render') return translator('progress.render', values);
  if (progress.phase === 'write') return translator('progress.write');
  return translator('progress.reading', values);
}

function describeWarning(warning: ConvertWarning): string {
  const values = { count: warning.pages.length, pages: warning.pages.join(', ') };
  if (warning.code === 'blank-pages') return translator('warning.blankPages', values);
  if (warning.code === 'picture-pages') return translator('warning.picturePages', values);
  return translator('warning.ocr', values);
}

const ERROR_MESSAGES: Record<string, MessageKey> = {
  password: 'error.password',
  'invalid-pdf': 'error.invalidPdf',
  'unreadable-pdf': 'error.unreadablePdf',
  canvas: 'error.canvas',
  'page-image': 'error.pageImage',
};

function describeError(error: unknown): string {
  if (error instanceof ConvertError) {
    const key = ERROR_MESSAGES[error.code];
    if (key) return translator(key);
  }
  return error instanceof Error ? error.message : String(error);
}

function createRow(job: Job): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'card row';
  row.dataset.id = job.id;

  const head = document.createElement('div');
  head.className = 'row__head';

  const name = document.createElement('span');
  name.className = 'row__name';
  name.textContent = job.file.name;
  name.title = job.file.name;

  const badge = document.createElement('span');
  badge.className = `badge badge--${job.status}`;
  badge.textContent =
    job.status === 'running' ? `${Math.round(job.progress * 100)}%` : statusLabel(job);

  const meta = document.createElement('span');
  meta.className = 'row__meta';
  meta.textContent = formatBytes(job.file.size);

  head.append(name, badge, meta);

  const progressTrack = document.createElement('div');
  progressTrack.className = 'progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'progress__bar';
  progressBar.style.width = `${Math.round(job.progress * 100)}%`;
  progressTrack.append(progressBar);

  const actions = document.createElement('div');
  actions.className = 'row__actions';

  if (job.status === 'done' && job.url) {
    const download = document.createElement('button');
    download.type = 'button';
    download.dataset.action = 'download';
    download.textContent = job.pageCount
      ? translator('action.downloadPages', { pages: formatPages(options.locale, job.pageCount) })
      : translator('action.download');
    actions.append(download);
  }

  if (job.status === 'error' || job.status === 'queued') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.dataset.action = 'retry';
    retry.textContent =
      job.status === 'error' ? translator('action.retry') : translator('action.convert');
    actions.append(retry);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.dataset.action = 'remove';
  remove.className = 'is-danger';
  remove.textContent = translator('action.remove');
  actions.append(remove);

  row.append(head, progressTrack, actions);

  if (job.status === 'running') {
    const detail = document.createElement('div');
    detail.className = 'row__detail';
    detail.textContent = `${job.detail} · ${Math.round(job.progress * 100)}%`;
    row.insertBefore(detail, actions);
  }

  if (job.error) {
    const error = document.createElement('p');
    error.className = 'error';
    error.textContent = job.error;
    row.append(error);
  }

  if (job.warnings.length) {
    const warnings = document.createElement('ul');
    warnings.className = 'warnings';
    for (const warning of job.warnings) {
      const item = document.createElement('li');
      item.textContent = describeWarning(warning);
      warnings.append(item);
    }
    row.append(warnings);
  }

  return row;
}

function render(): void {
  listElement.replaceChildren(...jobs.map(createRow));

  const done = jobs.filter((job) => job.status === 'done').length;
  const failed = jobs.filter((job) => job.status === 'error').length;
  const active = jobs.filter((job) => job.status === 'running').length;
  const queued = jobs.filter((job) => job.status === 'queued').length;
  const waiting = queued + failed;

  if (!jobs.length) {
    summaryElement.textContent = translator('summary.empty');
  } else {
    const parts = [
      translator('summary.files', { count: jobs.length }),
      translator('summary.done', { count: done }),
    ];
    if (active) parts.push(translator('summary.running', { count: active }));
    if (queued) parts.push(translator('summary.queued', { count: queued }));
    if (failed) parts.push(translator('summary.failed', { count: failed }));
    summaryElement.textContent = parts.join(' · ');
  }

  convertButton.disabled = running || !jobs.length;
  convertButton.textContent = running
    ? translator('action.converting')
    : waiting
      ? translator('action.convertCount', { count: waiting })
      : jobs.length
        ? translator('action.convertAgain')
        : translator('action.convert');
  downloadAllButton.disabled = done === 0;
  clearButton.disabled = !jobs.length || running;

  if (running && batchJobs.length) {
    const finished = batchJobs.filter((job) => job.status === 'done' || job.status === 'error').length;
    const overall =
      batchJobs.reduce(
        (sum, job) => sum + (job.status === 'done' ? 1 : job.status === 'error' ? 1 : job.progress),
        0,
      ) / batchJobs.length;
    const current = batchJobs.find((job) => job.status === 'running');
    batchElement.hidden = false;
    batchBar.style.width = `${Math.round(overall * 100)}%`;
    const label = translator('batch.converting', {
      done: finished,
      total: batchJobs.length,
      percent: Math.round(overall * 100),
    });
    batchLabel.textContent = current ? `${label} · ${current.detail}` : label;
  } else {
    batchElement.hidden = true;
  }
}

let renderTimer: number | undefined;
function scheduleRender(): void {
  if (renderTimer !== undefined) return;
  // setTimeout (not requestAnimationFrame) so progress keeps updating even when
  // the tab is in the background and animation frames are throttled.
  renderTimer = window.setTimeout(() => {
    renderTimer = undefined;
    render();
  }, 80);
}

function addFiles(files: File[]): void {
  const pdfs = files.filter(
    (file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf',
  );

  if (!pdfs.length) {
    showToast(translator('toast.noPdf'));
    return;
  }

  for (const file of pdfs) {
    jobSeq += 1;
    jobs.push({
      id: `job-${jobSeq}`,
      file,
      status: 'queued',
      progress: 0,
      detail: translator('status.queued'),
      warnings: [],
    });
  }

  render();
  if (options.autoStart) {
    void startConversion();
  } else {
    convertButton.focus();
  }
}

async function runJob(job: Job): Promise<void> {
  job.status = 'running';
  job.progress = 0;
  job.detail = translator('status.readingPdf');
  job.error = undefined;
  job.warnings = [];
  job.pageCount = undefined;
  if (job.url) URL.revokeObjectURL(job.url);
  job.url = undefined;
  job.blob = undefined;
  scheduleRender();

  try {
    const data = await job.file.arrayBuffer();
    const result = await convertPdf({
      data,
      options: { ...options },
      onProgress: (progress) => {
        job.progress = progress.pages ? progress.page / progress.pages : 0;
        job.detail = describeProgress(progress);
        scheduleRender();
      },
    });

    job.blob = result.blob;
    job.url = URL.createObjectURL(result.blob);
    job.pageCount = result.pageCount;
    job.warnings = result.warnings;
    job.status = 'done';
    job.progress = 1;
    job.detail = formatPages(options.locale, result.pageCount);
    if (result.ocrPages) hasOcrWork = true;
  } catch (error) {
    job.status = 'error';
    job.progress = 0;
    job.detail = translator('status.error');
    job.error = describeError(error);
  }

  scheduleRender();
}

async function startConversion(): Promise<void> {
  if (running) return;

  const waiting = jobs.filter((job) => job.status === 'queued' || job.status === 'error');
  // Nothing waiting? The button then means "convert everything again" with the
  // current settings (useful after changing mode / image quality / OCR).
  const targets = waiting.length ? waiting : jobs.slice();
  if (!targets.length) return;

  running = true;
  batchJobs = targets;
  for (const job of targets) {
    if (job.status === 'done') {
      job.status = 'queued';
      job.progress = 0;
      job.detail = translator('status.queued');
    }
  }
  render();

  const cores = navigator.hardwareConcurrency || 4;
  const concurrency = Math.max(1, Math.min(3, cores - 1, targets.length));
  let cursor = 0;

  const worker = async () => {
    while (cursor < targets.length) {
      const job = targets[cursor];
      cursor += 1;
      if (!job) return;
      await runJob(job);
    }
  };

  try {
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    running = false;
    batchJobs = [];
    if (hasOcrWork) {
      hasOcrWork = false;
      await terminateOcrWorker();
    }
    render();
  }
}

function downloadJob(job: Job): void {
  if (!job.url) return;
  const link = document.createElement('a');
  link.href = job.url;
  link.download = replaceExtension(job.file.name, 'docx');
  document.body.append(link);
  link.click();
  link.remove();
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

async function downloadAll(): Promise<void> {
  const finished = jobs.filter((job) => job.status === 'done' && job.blob);
  if (!finished.length) return;
  if (finished.length === 1) {
    downloadJob(finished[0]);
    return;
  }

  downloadAllButton.disabled = true;
  downloadAllButton.textContent = translator('action.zipping');
  try {
    const zip = new JSZip();
    const used = new Set<string>();

    for (const job of finished) {
      let name = replaceExtension(job.file.name, 'docx');
      let counter = 2;
      while (used.has(name)) {
        name = replaceExtension(job.file.name, `-${counter}.docx`);
        counter += 1;
      }
      used.add(name);
      zip.file(name, job.blob as Blob);
    }

    const archive = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(archive);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pdf-to-docx-${timestamp()}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (error) {
    showToast(describeError(error) || translator('toast.zipFailed'));
  } finally {
    downloadAllButton.textContent = translator('action.downloadAll');
    render();
  }
}

function removeJob(id: string): void {
  const index = jobs.findIndex((job) => job.id === id);
  if (index < 0) return;
  const [job] = jobs.splice(index, 1);
  if (job?.url) URL.revokeObjectURL(job.url);
  render();
}

async function collectDroppedFiles(transfer: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(transfer.items ?? [])) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (!entries.length) return Array.from(transfer.files);

  const collected: File[] = [];

  const readDirectory = (reader: FileSystemDirectoryReader) =>
    new Promise<FileSystemEntry[]>((resolve, reject) => {
      const found: FileSystemEntry[] = [];
      const next = () => {
        reader.readEntries((batch) => {
          if (!batch.length) {
            resolve(found);
            return;
          }
          found.push(...batch);
          next();
        }, reject);
      };
      next();
    });

  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      collected.push(file);
      return;
    }
    if (entry.isDirectory) {
      const children = await readDirectory((entry as FileSystemDirectoryEntry).createReader());
      for (const child of children) await walk(child);
    }
  };

  for (const entry of entries) await walk(entry);
  return collected;
}

dropzone.addEventListener('click', () => fileInput.click());
browseButton.addEventListener('click', (event) => {
  event.stopPropagation();
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  if (fileInput.files) addFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

for (const type of ['dragenter', 'dragover'] as const) {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-over');
  });
}
for (const type of ['dragleave', 'dragend'] as const) {
  dropzone.addEventListener(type, () => dropzone.classList.remove('is-over'));
}
dropzone.addEventListener('drop', async (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-over');
  if (!event.dataTransfer) return;
  addFiles(await collectDroppedFiles(event.dataTransfer));
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());

listElement.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const id = button.closest<HTMLElement>('li[data-id]')?.dataset.id;
  if (!id) return;
  const job = jobs.find((entry) => entry.id === id);
  if (!job) return;

  if (button.dataset.action === 'download') downloadJob(job);
  if (button.dataset.action === 'remove') removeJob(id);
  if (button.dataset.action === 'retry') {
    job.status = 'queued';
    job.progress = 0;
    job.detail = translator('status.queued');
    render();
    void startConversion();
  }
});

convertButton.addEventListener('click', () => void startConversion());
downloadAllButton.addEventListener('click', () => void downloadAll());
clearButton.addEventListener('click', () => {
  for (const job of jobs) if (job.url) URL.revokeObjectURL(job.url);
  jobs.length = 0;
  render();
});

localeSelect.addEventListener('change', () => {
  const previous = options.locale;
  const locale: Locale = isLocale(localeSelect.value) ? localeSelect.value : DEFAULT_LOCALE;
  options.locale = locale;
  // Follow the interface language with OCR until the user picks a set explicitly.
  if (options.ocrLangs === OCR_LANGS_BY_LOCALE[previous]) {
    options.ocrLangs = OCR_LANGS_BY_LOCALE[locale];
  }
  saveOptions();
  applyLocale();
  syncControls();
  render();
});

modeSelect.addEventListener('change', () => {
  const value = modeSelect.value;
  options.mode = value === 'visual' || value === 'layout' ? value : 'text';
  saveOptions();
  syncControls();
});

imageScaleSelect.addEventListener('change', () => {
  const value = Number(imageScaleSelect.value);
  options.imageScale = Number.isFinite(value) && value > 0 ? value : DEFAULT_OPTIONS.imageScale;
  saveOptions();
});

ocrSelect.addEventListener('change', () => {
  const value = ocrSelect.value;
  options.ocr = value === 'off' || value === 'force' ? value : 'auto';
  saveOptions();
  syncControls();
});

ocrLangsSelect.addEventListener('change', () => {
  options.ocrLangs = ocrLangsSelect.value;
  saveOptions();
});

detectColumnsInput.addEventListener('change', () => {
  options.detectColumns = detectColumnsInput.checked;
  saveOptions();
});

autoStartInput.addEventListener('change', () => {
  options.autoStart = autoStartInput.checked;
  saveOptions();
});

window.addEventListener('beforeunload', (event) => {
  if (running) event.preventDefault();
});

applyLocale();
syncControls();
render();
