import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the web build: register the service worker generated at build time
// (vite.config.ts -> dist/sw.js). Skipped in dev mode and inside the Android app, which
// has its own offline storage.
const isNativeApp = !!(window as any).Capacitor?.isNativePlatform?.();
if (import.meta.env.PROD && !isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
