import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {createHash} from 'crypto';
import {defineConfig, type Plugin} from 'vite';

/**
 * Generates dist/sw.js (offline service worker) from service-worker/sw-template.js,
 * filling in the list of built app files to save for offline use and a build version
 * (so browsers pick up each new deploy).
 */
function offlineServiceWorker(): Plugin {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter(f => !f.endsWith('.map') && f !== 'index.html' && f !== 'sw.js')
        .sort();
      const precache = ['/', '/index.html', ...files.map(f => '/' + f)];
      const version = createHash('sha1').update(files.join('|')).digest('hex').slice(0, 12);
      const template = fs.readFileSync(path.resolve(__dirname, 'service-worker/sw-template.js'), 'utf8');
      const versionLine = "const VERSION = '__VERSION__';";
      const precacheLine = 'const PRECACHE = __PRECACHE__;';
      if (!template.includes(versionLine) || !template.includes(precacheLine)) {
        throw new Error('service-worker/sw-template.js is missing its VERSION / PRECACHE placeholders');
      }
      const source = template
        .replace(versionLine, () => `const VERSION = ${JSON.stringify(version)};`)
        .replace(precacheLine, () => `const PRECACHE = ${JSON.stringify(precache)};`);
      this.emitFile({type: 'asset', fileName: 'sw.js', source});
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), offlineServiceWorker()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      minify: 'esbuild',
      target: 'es2020',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) return 'vendor-firebase';
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
            if (id.includes('node_modules/katex')) return 'vendor-katex';
            if (id.includes('node_modules/tinymce') || id.includes('node_modules/@tinymce')) return 'vendor-tinymce';
            if (id.includes('node_modules/@tanstack')) return 'vendor-tanstack';
            if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy Firebase Storage requests to avoid CORS in dev
      proxy: {
        '/pdf-proxy': {
          target: 'https://firebasestorage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/pdf-proxy/, ''),
          secure: true,
        },
      },
    },
  };
});

