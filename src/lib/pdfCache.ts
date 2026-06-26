/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * pdfCache.ts — Unified PDF storage for Capacitor Android and Web.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  NATIVE (Capacitor Android)                                         │
 * │  Storage : Capacitor Filesystem API                                 │
 * │  Directory: DATA / extrapadhai/pdfs/<sanitized-filename>.pdf        │
 * │  Index   : DATA / extrapadhai/pdf-index.json                        │
 * │  Download: Firebase SDK getBlob() → no CORS, no network config      │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  WEB (Browser)                                                      │
 * │  Storage : IndexedDB via idb library                                │
 * │  Key     : download URL                                             │
 * │  Download: fetch() with streaming progress                          │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ─── Platform detection ───────────────────────────────────────────────────────
export function isNative(): boolean {
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    !!(window as any).Capacitor?.isNativePlatform?.()
  );
}

// ─── Paths ───────────────────────────────────────────────────────────────────
const NATIVE_DIR = 'extrapadhai/pdfs';        // relative to DATA directory
const NATIVE_INDEX_PATH = 'extrapadhai/pdf-index.json';

/** Convert a Firebase download URL to a safe flat filename */
function urlToFilename(url: string): string {
  try {
    const u = new URL(url);
    // Extract the Storage path portion: /v0/b/<bucket>/o/<path>
    const match = u.pathname.match(/\/o\/(.+)/);
    const storagePath = match ? decodeURIComponent(match[1]) : u.pathname;
    // Replace path separators and special chars
    return storagePath.replace(/[/\\?=&%:]/g, '_').replace(/_{2,}/g, '_') + '.pdf';
  } catch {
    return `pdf_${Date.now()}.pdf`;
  }
}

// ─── NATIVE: Capacitor Filesystem ────────────────────────────────────────────

async function getFilesystem() {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  return { Filesystem, Directory, Encoding };
}

/** Ensure extrapadhai/pdfs/ directory exists */
async function ensureNativeDir(): Promise<void> {
  const { Filesystem, Directory } = await getFilesystem();
  try {
    await Filesystem.mkdir({
      path: NATIVE_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (e: any) {
    // Directory already exists — not an error
    if (!e?.message?.includes('exists')) {
      console.warn('[pdfCache] mkdir warning:', e?.message);
    }
  }
}

/** Read the URL→filename index from the filesystem */
async function readNativeIndex(): Promise<Record<string, string>> {
  const { Filesystem, Directory, Encoding } = await getFilesystem();
  try {
    const result = await Filesystem.readFile({
      path: NATIVE_INDEX_PATH,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data as string);
  } catch {
    return {};
  }
}

/** Write the URL→filename index to the filesystem */
async function writeNativeIndex(index: Record<string, string>): Promise<void> {
  const { Filesystem, Directory, Encoding } = await getFilesystem();
  try {
    // Ensure parent dir exists
    await Filesystem.mkdir({
      path: 'extrapadhai',
      directory: Directory.Data,
      recursive: true,
    });
    await Filesystem.writeFile({
      path: NATIVE_INDEX_PATH,
      data: JSON.stringify(index, null, 2),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch (e) {
    console.warn('[pdfCache] writeNativeIndex error:', e);
  }
}

/** Store a PDF blob as a native file */
async function nativeCachePdf(url: string, blob: Blob): Promise<void> {
  const { Filesystem, Directory } = await getFilesystem();
  try {
    await ensureNativeDir();
    const filename = urlToFilename(url);
    const filePath = `${NATIVE_DIR}/${filename}`;

    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const base64 = btoa(binary);

    await Filesystem.writeFile({
      path: filePath,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });

    // Update the index
    const index = await readNativeIndex();
    index[url] = filePath;
    await writeNativeIndex(index);

    console.log(`[pdfCache] Native: saved ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.error('[pdfCache] nativeCachePdf error:', e);
  }
}

/** Read a PDF from native file storage. Returns Blob or null. */
async function nativeGetCachedPdf(url: string): Promise<Blob | null> {
  const { Filesystem, Directory } = await getFilesystem();
  try {
    const index = await readNativeIndex();
    const filePath = index[url];
    if (!filePath) return null;

    const result = await Filesystem.readFile({
      path: filePath,
      directory: Directory.Data,
    });

    // result.data is base64 string on native
    const base64 = result.data as string;
    const binary = atob(base64);
    const uint8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i);
    const blob = new Blob([uint8], { type: 'application/pdf' });
    console.log(`[pdfCache] Native: loaded from ${filePath} (${(blob.size / 1024).toFixed(1)} KB)`);
    return blob;
  } catch (e) {
    console.warn('[pdfCache] nativeGetCachedPdf error:', e);
    return null;
  }
}

/** Check if a PDF is cached natively */
async function nativeIsPdfCached(url: string): Promise<boolean> {
  try {
    const index = await readNativeIndex();
    return !!index[url];
  } catch {
    return false;
  }
}

/** List all natively cached PDFs with their file info */
export async function getNativeCacheStats(): Promise<{
  count: number;
  totalBytes: number;
  directory: string;
  files: { url: string; path: string }[];
}> {
  const { Filesystem, Directory } = await getFilesystem();
  const index = await readNativeIndex();
  const files = Object.entries(index).map(([url, path]) => ({ url, path }));
  let totalBytes = 0;
  for (const { path } of files) {
    try {
      const stat = await Filesystem.stat({ path, directory: Directory.Data });
      totalBytes += stat.size ?? 0;
    } catch {}
  }
  return {
    count: files.length,
    totalBytes,
    directory: `Android/data/com.extrapadhai.app/files/${NATIVE_DIR}`,
    files,
  };
}

// ─── WEB: IndexedDB ───────────────────────────────────────────────────────────

interface PdfCacheEntry {
  blob: Blob;
  cachedAt: number;
  byteLength: number;
}

interface PdfCacheSchema extends DBSchema {
  pdfs: { key: string; value: PdfCacheEntry };
}

const DB_NAME = 'extrapadhai-pdf-cache';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';
let dbPromise: Promise<IDBPDatabase<PdfCacheSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<PdfCacheSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PdfCacheSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      },
    });
  }
  return dbPromise;
}

async function webCachePdf(url: string, blob: Blob): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, { blob, cachedAt: Date.now(), byteLength: blob.size }, url);
    console.log(`[pdfCache] Web IndexedDB: cached (${(blob.size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.warn('[pdfCache] webCachePdf error:', e);
  }
}

async function webGetCachedPdf(url: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    const entry = await db.get(STORE_NAME, url);
    return entry?.blob ?? null;
  } catch (e) {
    console.warn('[pdfCache] webGetCachedPdf error:', e);
    return null;
  }
}

async function webIsPdfCached(url: string): Promise<boolean> {
  try {
    const db = await getDb();
    const entry = await db.get(STORE_NAME, url);
    return !!entry;
  } catch {
    return false;
  }
}

// ─── PUBLIC API (platform-agnostic) ──────────────────────────────────────────

/** Get a cached PDF blob. Returns null if not cached. */
export async function getCachedPdf(url: string): Promise<Blob | null> {
  if (isNative()) return nativeGetCachedPdf(url);
  return webGetCachedPdf(url);
}

/** Store a PDF blob in local storage. */
export async function cachePdf(url: string, blob: Blob): Promise<void> {
  if (isNative()) return nativeCachePdf(url, blob);
  return webCachePdf(url, blob);
}

/** Check if a PDF is already cached. */
export async function isPdfCached(url: string): Promise<boolean> {
  if (isNative()) return nativeIsPdfCached(url);
  return webIsPdfCached(url);
}

// ─── Download + Cache ─────────────────────────────────────────────────────────

/**
 * Download a PDF and store it locally.
 *
 * Priority:
 *   1. Firebase SDK getBlob() — bypasses CORS entirely (works on native + web)
 *   2. Direct fetch()         — web fallback with progress streaming
 */
export async function downloadAndCachePdf(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob | null> {

  // ── Strategy 1: Firebase Storage SDK (no CORS, works everywhere) ──
  const isFirebaseUrl =
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('firebasestorage.app');

  if (isFirebaseUrl) {
    try {
      console.log('[pdfCache] Downloading via Firebase SDK getBlob():', url);
      const { getStorage, ref, getBlob } = await import('firebase/storage');
      const storage = getStorage();

      const pathMatch = new URL(url).pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
      if (pathMatch) {
        const storagePath = decodeURIComponent(pathMatch[1].split('?')[0]);
        const sdkBlob = await getBlob(ref(storage, storagePath));
        onProgress?.(sdkBlob.size, sdkBlob.size);
        const pdfBlob = new Blob([await sdkBlob.arrayBuffer()], { type: 'application/pdf' });
        await cachePdf(url, pdfBlob);
        console.log('[pdfCache] Download + cache via SDK succeeded:', url);
        return pdfBlob;
      }
    } catch (sdkErr) {
      console.warn('[pdfCache] SDK getBlob failed, trying fetch:', sdkErr);
    }
  }

  // ── Strategy 2: fetch() with progress ──
  try {
    console.log('[pdfCache] Downloading via fetch():', url);
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('text/html')) throw new Error('Response is HTML not PDF');

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

/** Get web IndexedDB cache stats */
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

/** Clear all cached PDFs */
export async function clearPdfCache(): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory } = await getFilesystem();
    try {
      await Filesystem.rmdir({ path: NATIVE_DIR, directory: Directory.Data, recursive: true });
      await Filesystem.deleteFile({ path: NATIVE_INDEX_PATH, directory: Directory.Data });
      console.log('[pdfCache] Native cache cleared.');
    } catch (e) {
      console.warn('[pdfCache] clearPdfCache (native) error:', e);
    }
  } else {
    try {
      const db = await getDb();
      await db.clear(STORE_NAME);
      console.log('[pdfCache] Web IndexedDB cache cleared.');
    } catch (e) {
      console.warn('[pdfCache] clearPdfCache (web) error:', e);
    }
  }
}
