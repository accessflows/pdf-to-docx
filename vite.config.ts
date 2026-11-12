import { defineConfig } from 'vite';
import { offlinePlugin } from './scripts/offline-plugin.mjs';

export default defineConfig({
  // Relative base so the built app works from any folder (GitHub Pages, file sharing, ...).
  base: './',
  plugins: [offlinePlugin()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
