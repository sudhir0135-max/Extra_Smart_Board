import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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

