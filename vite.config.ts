import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built app works from any folder (GitHub Pages, file sharing, ...).
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
