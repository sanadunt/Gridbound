import { defineConfig } from 'vite';
import { webApp } from './scripts/web-app';
// The web build (npm run build) is installable: manifest, icons and Apple tags from scripts/web-app.ts. `vite build --mode itch
// --outDir dist-itch` (npm run package:itch) leaves them out, since itch.io serves many games from one origin.
export default defineConfig({
  base: './',
  plugins: [webApp()],
  build: {
    outDir: 'dist',
    rollupOptions: { output: { manualChunks: { engine: ['phaser'] } } },
  },
});
