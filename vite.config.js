import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Build modes
 *  npm run build          -> /dist          multi-file production site (generated 3D city)
 *  npm run build:single   -> /dist-single   one self-contained HTML
 *  npm run build:preview  -> /dist-preview  one self-contained HTML with the generated city (shareable preview)
 *
 * Map mode (VITE_MAP_MODE in .env.local, default "city"):
 *   city      — generated daytime Melbourne, no network or keys (default)
 *   map       — MapLibre + OpenFreeMap tiles, falls back to the city
 *   photoreal — Google Photorealistic 3D Tiles (needs VITE_GOOGLE_MAPS_API_KEY), → map → city
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'preview';
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const mapMode = mode === 'preview' ? 'city' : ['map', 'photoreal'].includes(env.VITE_MAP_MODE) ? env.VITE_MAP_MODE : 'city';
  // GLB models present at build time (Path A); the page never requests a missing file
  const glbs = fs.existsSync('public/models') ? fs.readdirSync('public/models').filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)) : [];
  // single-file builds: inline the favicon too, so the one HTML file needs nothing next to it
  const inlineFavicon = {
    name: 'inline-favicon',
    transformIndexHtml: (html) =>
      html.replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${fs.readFileSync('public/favicon.svg').toString('base64')}"`),
  };
  return {
    // Netlify serves the site from the domain root; the single-file builds open from disk
    base: single ? './' : '/',
    plugins: single ? [viteSingleFile(), inlineFavicon] : [],
    define: {
      'import.meta.env.VITE_MAP_MODE': JSON.stringify(mapMode),
      __GLB_MODELS__: JSON.stringify(glbs),
      // the Google key is only ever embedded in an explicit photoreal build
      ...(mapMode !== 'photoreal' ? { 'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': '""' } : {}),
    },
    build: {
      outDir: mode === 'single' ? 'dist-single' : mode === 'preview' ? 'dist-preview' : 'dist',
      chunkSizeWarningLimit: 2000,
    },
  };
});
