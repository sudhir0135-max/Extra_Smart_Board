/**
 * Offline caching helpers for the student panel:
 *  - uploaded interactive HTML pages (stored in IndexedDB, works on web and in the Android app)
 *  - images on web (warmed into the service worker cache; the Android app uses imageCache.ts)
 */
import { Lesson } from '../types';
import { dbLocal } from './db';
import { extractImagesFromLesson, downloadAndCacheImage } from './imageCache';

const isNative = () =>
  typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

/** All uploaded HTML page URLs in a lesson (chapter-root pages and topic pages). */
export function extractHtmlUrlsFromLesson(lesson: Lesson): string[] {
  const urls = new Set<string>();
  const add = (pages?: { iframeUrl?: string | null }[]) =>
    (pages || []).forEach(p => {
      if (p && p.iframeUrl && /^https?:/i.test(p.iframeUrl)) urls.add(p.iframeUrl);
    });
  add(lesson.pages);
  (lesson.topics || []).forEach(t => add(t.pages));
  return Array.from(urls);
}

/** Returns the saved copy of an HTML page, or null if it was never saved. */
export async function getCachedHtml(url: string): Promise<string | null> {
  try {
    const row = await dbLocal.html_pages.get(url);
    return row ? row.html : null;
  } catch {
    return null;
  }
}

/** Downloads an HTML page and saves it for offline use. Returns the HTML (or null on failure). */
export async function downloadAndCacheHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    await dbLocal.html_pages.put({ url, html, cached_at: new Date().toISOString() });
    return html;
  } catch (e) {
    console.warn('[offlineCache] Could not cache HTML page:', url, e);
    return null;
  }
}

/** Fetches an image once on web so the service worker keeps a copy for offline use. */
async function warmWebImage(url: string): Promise<void> {
  if (!('caches' in window) || !navigator.serviceWorker?.controller) return;
  try {
    const hit = await caches.match(url);
    if (hit) return;
    await fetch(url, { mode: 'cors' });
  } catch {
    // ignore: image just won't be available offline
  }
}

const inFlight = new Set<string>();

/**
 * Saves everything a student needs to read these lessons offline: HTML pages and images.
 * Already-saved items are skipped. Runs in small batches in the background.
 */
export async function precacheLessonsForOffline(lessons: Lesson[]): Promise<void> {
  if (!navigator.onLine) return;

  const htmlUrls = Array.from(new Set(lessons.flatMap(extractHtmlUrlsFromLesson)));
  const imageUrls = Array.from(new Set(lessons.flatMap(l => extractImagesFromLesson(l))));

  const BATCH = 3;
  for (let i = 0; i < htmlUrls.length; i += BATCH) {
    await Promise.all(htmlUrls.slice(i, i + BATCH).map(async url => {
      if (inFlight.has(url)) return;
      inFlight.add(url);
      try {
        if (!(await getCachedHtml(url))) await downloadAndCacheHtml(url);
      } finally {
        inFlight.delete(url);
      }
    }));
  }

  for (let i = 0; i < imageUrls.length; i += BATCH) {
    await Promise.all(imageUrls.slice(i, i + BATCH).map(url => {
      if (inFlight.has(url)) return Promise.resolve();
      inFlight.add(url);
      const job = isNative() ? downloadAndCacheImage(url).then(() => undefined) : warmWebImage(url);
      return job.catch(() => undefined).finally(() => inFlight.delete(url));
    }));
  }
}
