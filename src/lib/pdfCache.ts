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
 * Returns the blob on success, null on failure.
 */
export async function downloadAndCachePdf(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob | null> {
  try {
    console.log('[pdfCache] Downloading PDF:', url);
    const response = await fetch(url, { mode: 'cors' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Got HTML instead of PDF');
    }

    // Stream with progress if supported
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
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const blob = new Blob([combined], { type: 'application/pdf' });
      await cachePdf(url, blob);
      return blob;
    }

    // Simple path without progress tracking
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    await cachePdf(url, blob);
    return blob;
  } catch (err) {
    console.warn('[pdfCache] downloadAndCachePdf failed:', err);
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
