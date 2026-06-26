/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * pdfCache.ts — IndexedDB-backed PDF caching utility.
 *
 * PDFs are stored as Blobs keyed by their download URL.
 * This allows PdfViewer to serve PDFs from local storage
 * on subsequent opens without any network request.
 *
 * DB Name  : extrapadhai-pdf-cache
 * Store    : pdfs
 * Key      : string (download URL)
 * Value    : { blob: Blob, cachedAt: number, byteLength: number }
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PdfCacheEntry {
  blob: Blob;
  cachedAt: number;
  byteLength: number;
}

interface PdfCacheSchema extends DBSchema {
  pdfs: {
    key: string;
    value: PdfCacheEntry;
  };
}

const DB_NAME = 'extrapadhai-pdf-cache';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

let dbPromise: Promise<IDBPDatabase<PdfCacheSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<PdfCacheSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PdfCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Retrieve a cached PDF blob by URL.
 * Returns null if not cached.
 */
export async function getCachedPdf(url: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    const entry = await db.get(STORE_NAME, url);
    return entry?.blob ?? null;
  } catch (err) {
    console.warn('[pdfCache] getCachedPdf error:', err);
    return null;
  }
}

/**
 * Store a PDF blob in the local IndexedDB cache.
 */
export async function cachePdf(url: string, blob: Blob): Promise<void> {
  try {
    const db = await getDb();
    const entry: PdfCacheEntry = {
      blob,
      cachedAt: Date.now(),
      byteLength: blob.size,
    };
    await db.put(STORE_NAME, entry, url);
    console.log(`[pdfCache] Cached PDF (${(blob.size / 1024).toFixed(1)} KB):`, url);
  } catch (err) {
    console.warn('[pdfCache] cachePdf error:', err);
  }
}

/**
 * Check if a PDF URL is already cached.
 */
export async function isPdfCached(url: string): Promise<boolean> {
  try {
    const db = await getDb();
    const entry = await db.get(STORE_NAME, url);
    return !!entry;
  } catch {
    return false;
  }
}

/**
 * Download a PDF from a URL and cache it.
 * On Capacitor Android we prefer Firebase SDK getBlob() because it bypasses
 * CORS entirely — the SDK authenticates through its own native channel.
 * On web, direct fetch() is used with streaming progress.
 * Returns the blob on success, null on failure.
 */
export async function downloadAndCachePdf(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob | null> {

  const isCapacitorNative =
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.();

  // ── Strategy A: Firebase SDK getBlob() — works on both native & web, no CORS ──
  if (url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app')) {
    try {
      console.log('[pdfCache] Trying Firebase SDK getBlob():', url);
      const { getStorage, ref, getBlob } = await import('firebase/storage');
      const storage = getStorage();

      // Extract the storage path from the download URL
      const storagePathMatch = new URL(url).pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
      if (storagePathMatch) {
        const storagePath = decodeURIComponent(storagePathMatch[1].split('?')[0]);
        const blob = await getBlob(ref(storage, storagePath));
        onProgress?.(blob.size, blob.size); // signal 100%
        const pdfBlob = new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
        await cachePdf(url, pdfBlob);
        return pdfBlob;
      }
    } catch (sdkErr) {
      console.warn('[pdfCache] Firebase SDK getBlob failed, falling back to fetch:', sdkErr);
    }
  }

  // ── Strategy B: Direct fetch (works on web, may hit CORS on native) ──
  try {
    console.log('[pdfCache] Fetching via URL:', url);
    const response = await fetch(url, { mode: 'cors' });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) throw new Error('Got HTML instead of PDF');

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (response.body && total > 0 && onProgress) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        onProgress(loaded, total);
      }
      const combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
      const blob = new Blob([combined], { type: 'application/pdf' });
      await cachePdf(url, blob);
      return blob;
    }

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    await cachePdf(url, blob);
    return blob;
  } catch (fetchErr) {
    console.warn('[pdfCache] fetch failed:', fetchErr);
    return null;
  }
}

/**
 * Get cache statistics.
 */
export async function getPdfCacheStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const db = await getDb();
    const keys = await db.getAllKeys(STORE_NAME);
    let totalBytes = 0;
    for (const key of keys) {
      const entry = await db.get(STORE_NAME, key);
      if (entry) totalBytes += entry.byteLength;
    }
    return { count: keys.length, totalBytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

/**
 * Clear the entire PDF cache.
 */
export async function clearPdfCache(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
    console.log('[pdfCache] Cache cleared.');
  } catch (err) {
    console.warn('[pdfCache] clearPdfCache error:', err);
  }
}
