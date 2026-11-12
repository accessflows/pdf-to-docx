import './styles.css';
import JSZip from 'jszip';
import { convertPdf, terminateOcrWorker } from './core/convert';
import {
  DEFAULT_OPTIONS,
  OPTIONS_STORAGE_KEY,
  replaceExtension,
  type ConvertOptions,
  type ConvertProgress,
} from './core/types';

type JobStatus = 'queued' | 'running' | 'done' | 'error';

interface Job {
  id: string;
  file: File;
  status: JobStatus;
  progress: number;
  detail: string;
  error?: string;
  warnings: string[];
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
    if (!raw) return { ...DEFAULT_OPTIONS };
    const parsed = JSON.parse(raw) as Partial<ConvertOptions>;
    return {
      mode: parsed.mode === 'visual' ? 'visual' : 'text',
      imageScale:
        typeof parsed.imageScale === 'number' ? parsed.imageScale : DEFAULT_OPTIONS.imageScale,
      ocr: parsed.ocr === 'off' || parsed.ocr === 'force' ? parsed.ocr : 'auto',
      ocrLangs:
        typeof parsed.ocrLangs === 'string' && parsed.ocrLangs
          ? parsed.ocrLangs
          : DEFAULT_OPTIONS.ocrLangs,
      detectColumns: parsed.detectColumns !== false,
      autoStart: parsed.autoStart !== false,
    };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

const options = loadOptions();

function saveOptions(): void {
  try {
    localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Storage may be unavailable (private mode); settings simply are not persisted.
  }
}

const SHELL = `
  <header class="hero">
    <span class="hero__badge">100% trên máy bạn</span>
    <h1>PDF → DOCX</h1>
    <p>Chuyển nhiều file PDF sang Word cùng lúc, ngay trong trình duyệt. File không được tải lên server nào.</p>
  </header>

  <section class="card dropzone" id="dropzone">
    <svg class="dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
    <p class="dropzone__title">Kéo &amp; thả file PDF vào đây</p>
    <p class="dropzone__hint">hoặc <button type="button" class="link" id="browse">chọn file</button> — chọn được nhiều file, kể cả cả thư mục</p>
    <input id="file-input" type="file" accept="application/pdf,.pdf" multiple hidden />
  </section>

  <section class="card options">
    <label class="field">
      <span>Chế độ chuyển</span>
      <select id="mode">
        <option value="text">Văn bản (sửa được)</option>
        <option value="visual">Hình ảnh (giữ nguyên trang)</option>
      </select>
    </label>
    <label class="field">
      <span>Độ nét ảnh</span>
      <select id="image-scale">
        <option value="1">72 dpi (nhẹ)</option>
        <option value="1.5">108 dpi</option>
        <option value="2">144 dpi</option>
        <option value="3">216 dpi (nét)</option>
      </select>
    </label>
    <label class="field">
      <span>OCR cho PDF scan</span>
      <select id="ocr">
        <option value="auto">Tự động khi trang không có chữ</option>
        <option value="force">Luôn chạy OCR</option>
        <option value="off">Tắt</option>
      </select>
    </label>
    <label class="field">
      <span>Ngôn ngữ OCR</span>
      <select id="ocr-langs">
        <option value="vie+eng">Tiếng Việt + Anh</option>
        <option value="vie">Chỉ tiếng Việt</option>
        <option value="eng">Chỉ tiếng Anh</option>
      </select>
    </label>
    <label class="field field--check">
      <input type="checkbox" id="detect-columns" />
      <span>Nhận diện bố cục 2 cột</span>
    </label>
    <label class="field field--check">
      <input type="checkbox" id="auto-start" />
      <span>Tự động chuyển khi thêm file</span>
    </label>
  </section>

  <div class="toolbar">
    <div class="toolbar__info" id="summary" aria-live="polite">Chưa có file nào.</div>
    <div class="toolbar__actions">
      <button type="button" class="btn btn--primary" id="convert">Chuyển đổi</button>
      <button type="button" class="btn" id="download-all">Tải tất cả (.zip)</button>
      <button type="button" class="btn btn--ghost" id="clear">Xóa danh sách</button>
    </div>
  </div>

  <div class="batch" id="batch" hidden>
    <div class="progress progress--thick">
      <div class="progress__bar" id="batch-bar"></div>
    </div>
    <span class="batch__label" id="batch-label" aria-live="polite">Đang chuyển đổi…</span>
  </div>

  <ul class="list" id="list" aria-live="polite"></ul>

  <p class="footnote">
    <strong>Lưu ý:</strong> file được xử lý bằng JavaScript ngay trên máy bạn. Chế độ văn bản giữ nội dung, hình
    ảnh và định dạng cơ bản nhưng không tái tạo được bảng hay bố cục phức tạp — hãy dùng chế độ hình ảnh
    khi cần giống bản gốc 100%. Trang scan hoặc trang bìa (chỉ có một ảnh lớn) được giữ nguyên dưới dạng ảnh.
    OCR tải dữ liệu ngôn ngữ (~5–15 MB) từ CDN ở lần dùng đầu tiên.
  </p>
  <div class="toast" id="toast" role="status"></div>
`;

const app = document.getElementById('app');
if (!app) throw new Error('Không tìm thấy phần tử #app');
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

const modeSelect = document.getElementById('mode') as HTMLSelectElement;
const imageScaleSelect = document.getElementById('image-scale') as HTMLSelectElement;
const ocrSelect = document.getElementById('ocr') as HTMLSelectElement;
const ocrLangsSelect = document.getElementById('ocr-langs') as HTMLSelectElement;
const detectColumnsInput = document.getElementById('detect-columns') as HTMLInputElement;
const autoStartInput = document.getElementById('auto-start') as HTMLInputElement;
const batchElement = document.getElementById('batch') as HTMLElement;
const batchBar = document.getElementById('batch-bar') as HTMLElement;
const batchLabel = document.getElementById('batch-label') as HTMLElement;

function syncControls(): void {
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
      return 'Chờ';
    case 'running':
      return job.detail || 'Đang xử lý…';
    case 'done':
      return 'Xong';
    default:
      return 'Lỗi';
  }
}

function describeProgress(progress: ConvertProgress): string {
  const suffix = `${progress.page}/${progress.pages}`;
  if (progress.phase === 'ocr') return `OCR trang ${suffix}`;
  if (progress.phase === 'render') return `Dựng ảnh trang ${suffix}`;
  if (progress.phase === 'write') return 'Đang ghi file DOCX…';
  return `Đọc trang ${suffix}`;
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
    download.textContent = `Tải .docx${job.pageCount ? ` (${job.pageCount} trang)` : ''}`;
    actions.append(download);
  }

  if (job.status === 'error' || job.status === 'queued') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.dataset.action = 'retry';
    retry.textContent = job.status === 'error' ? 'Thử lại' : 'Chuyển đổi';
    actions.append(retry);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.dataset.action = 'remove';
  remove.className = 'is-danger';
  remove.textContent = 'Xóa';
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
      item.textContent = warning;
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
    summaryElement.textContent = 'Chưa có file nào.';
  } else {
    const parts = [`${jobs.length} file`, `${done} xong`];
    if (active) parts.push(`${active} đang chạy`);
    if (queued) parts.push(`${queued} chờ`);
    if (failed) parts.push(`${failed} lỗi`);
    summaryElement.textContent = parts.join(' · ');
  }

  convertButton.disabled = running || !jobs.length;
  convertButton.textContent = running
    ? 'Đang chuyển đổi…'
    : waiting
      ? `Chuyển đổi (${waiting})`
      : jobs.length
        ? 'Chuyển đổi lại'
        : 'Chuyển đổi';
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
    batchLabel.textContent = `Đang chuyển đổi ${finished}/${batchJobs.length} file · ${Math.round(overall * 100)}%${
      current ? ` · ${current.detail}` : ''
    }`;
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
    showToast('Không tìm thấy file PDF nào.');
    return;
  }

  for (const file of pdfs) {
    jobSeq += 1;
    jobs.push({
      id: `job-${jobSeq}`,
      file,
      status: 'queued',
      progress: 0,
      detail: 'Chờ',
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
  job.detail = 'Đang đọc PDF…';
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
    job.detail = `${result.pageCount} trang`;
    if (result.ocrPages) hasOcrWork = true;
  } catch (error) {
    job.status = 'error';
    job.progress = 0;
    job.detail = 'Lỗi';
    job.error = error instanceof Error ? error.message : String(error);
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
      job.detail = 'Chờ';
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
  downloadAllButton.textContent = 'Đang nén…';
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
    showToast(error instanceof Error ? error.message : 'Không tạo được file ZIP.');
  } finally {
    downloadAllButton.textContent = 'Tải tất cả (.zip)';
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
    job.detail = 'Chờ';
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

modeSelect.addEventListener('change', () => {
  options.mode = modeSelect.value === 'visual' ? 'visual' : 'text';
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

syncControls();
render();
