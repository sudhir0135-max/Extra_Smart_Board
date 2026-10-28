import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// /recover runs the Chapter Recovery Tool INSTEAD of the app, so the app can't re-sync
// (and overwrite) this browser's offline chapter copies before they are read.
const isRecoveryPage = window.location.pathname.replace(/\/+$/, '') === '/recover';
const ChapterRecoveryTool = lazy(() => import('./recovery/ChapterRecoveryTool'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRecoveryPage ? (
      <Suspense fallback={<div style={{ padding: 24, color: '#94a3b8' }}>Loading recovery tool…</div>}>
        <ChapterRecoveryTool />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

// Offline support for the web build: register the service worker generated at build time
// (vite.config.ts -> dist/sw.js). Skipped in dev mode, on the recovery page, and inside the
// Android app, which has its own offline storage.
const isNativeApp = !!(window as any).Capacitor?.isNativePlatform?.();
if (import.meta.env.PROD && !isNativeApp && !isRecoveryPage && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
