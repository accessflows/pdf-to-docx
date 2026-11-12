import fs from 'node:fs';
import path from 'node:path';

/**
 * Emits `sw.js` after the build, listing every hashed file so the app works
 * offline after the first visit (the README promises exactly that).
 *
 * @returns {import('vite').Plugin}
 */
export function offlinePlugin() {
  /** @type {string} */
  let outDir = 'dist';

  return {
    name: 'pdf2docx-offline',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      /** @type {string[]} */
      const files = [];
      const walk = (directory, prefix) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const absolute = path.join(directory, entry.name);
          const relative = `${prefix}${entry.name}`;
          if (entry.isDirectory()) {
            // CMaps are only needed for CJK files; they are cached at runtime.
            if (relative === 'pdfjs/cmaps') continue;
            walk(absolute, `${relative}/`);
            continue;
          }
          if (relative === 'sw.js') continue;
          files.push(relative);
        }
      };
      walk(outDir, '');

      const version = Date.now().toString(36);
      const serviceWorker = `const CACHE = 'pdf2docx-${version}';
const PRECACHE = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The app shell is precached: serve it instantly and refresh it in the
  // background, so the first visit works offline and a deploy is picked up next.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match('index.html');
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put('index.html', copy));
            }
            return response;
          })
          .catch(() => null);
        if (cached) {
          void network;
          return cached;
        }
        return (await network) || Response.error();
      })(),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
`;

      fs.writeFileSync(path.join(outDir, 'sw.js'), serviceWorker);
      this.info?.(`offline: precaching ${files.length} files`);
    },
  };
}
