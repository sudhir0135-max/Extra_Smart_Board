/*
 * Extrapadhai offline service worker (web build only; the Android app has its own offline storage).
 * Generated into dist/sw.js at build time by the `offline-service-worker` plugin in vite.config.ts,
 * which fills in the build version and the list of built app files (PRECACHE).
 *
 *  - App shell (HTML/JS/CSS/fonts) is saved on install, so the app opens with no internet.
 *  - Pages: network first, falling back to the saved app shell when offline.
 *  - Firebase Storage files (images, uploaded HTML pages) are kept after first use (cache first).
 *    PDFs and videos are skipped here (PDFs have their own offline store; videos are too large).
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = 'ep-shell-' + VERSION;
const RUNTIME_CACHE = 'ep-runtime-v1';
const MEDIA_CACHE = 'ep-media-v1';
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Add one by one so a single failure doesn't abort the whole install
    await Promise.all(PRECACHE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch((err) => console.warn('[sw] precache failed', url, err))
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('ep-shell-') && k !== SHELL_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isCacheableMedia = (response) => {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (type.includes('application/pdf') || type.startsWith('video/') || type.startsWith('audio/')) return false;
  const len = Number(response.headers.get('content-length') || 0);
  return !(len && len > MAX_MEDIA_BYTES);
};

async function shellFallback() {
  return (await caches.match('/index.html')) || (await caches.match('/')) ||
    new Response('<h1>Offline</h1><p>Please connect to the internet once to download the app.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // --- Same-origin app files ---
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('.apk') || url.pathname.startsWith('/pdf-proxy')) return;

    if (req.mode === 'navigate') {
      event.respondWith((async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put('/index.html', fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          return shellFallback();
        }
      })());
      return;
    }

    if (url.pathname.startsWith('/assets/')) {
      // Hashed build files never change: cache first
      event.respondWith((async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(RUNTIME_CACHE)).put(req, res.clone()).catch(() => {});
        return res;
      })());
      return;
    }

    // Other same-origin files (public images, editor files): stale-while-revalidate
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const hit = await cache.match(req);
      const network = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => null);
      return hit || (await network) || new Response('', { status: 504 });
    })());
    return;
  }

  // --- Firebase Storage: images and uploaded HTML pages ---
  if (url.hostname === 'firebasestorage.googleapis.com') {
    // Chapter payload JSON is requested with a cache-buster and must always be fresh
    if (url.searchParams.has('_cb')) return;
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      try {
        // Fetch with CORS (even for plain <img> requests) so the response can be stored without opaque padding
        const res = await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' }));
        if (isCacheableMedia(res)) cache.put(req.url, res.clone()).catch(() => {});
        return res;
      } catch {
        try {
          return await fetch(req);
        } catch {
          return new Response('', { status: 504 });
        }
      }
    })());
    return;
  }

  // --- Web fonts ---
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    })());
  }
  // Everything else (Firestore, YouTube, auth) goes to the network as normal.
});
