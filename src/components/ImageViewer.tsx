/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ImageViewer — replaces PdfViewer entirely.
 * Displays WebP page images for a lesson from Firebase Storage.
 *
 * Platform strategy:
 *   NATIVE (Capacitor Android):
 *     - Downloads pages from Firebase Storage
 *     - Saves to device filesystem via Capacitor Filesystem API
 *     - Serves from file:// URIs (works in Android WebView)
 *     - Fully offline after first download
 *
 *   WEB (Browser / Editor):
 *     - Downloads pages from Firebase Storage via fetch()
 *     - Saves blobs to IndexedDB keyed by storage path
 *     - Serves from blob: URLs created at runtime
 *     - Blob URLs are revoked on unmount to avoid memory leaks
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getDownloadURL, getBlob, ref as storageRef } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { buildLessonStoragePath } from '../lib/firebaseHelper';
import { isNative } from '../lib/pdfCache';
import { Lesson } from '../types';
import {
  BookOpen,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Columns,
  AlignJustify,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { openDB, IDBPDatabase, DBSchema } from 'idb';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageViewerProps {
  lessons: Lesson[];           // All ready lessons for this book, in order
  initialLessonId?: string;    // Which lesson to jump to on open
  classId: string;
  subjectId: string;
  bookId: number | string;
}

interface PageState {
  uri: string | null;          // blob: URL (web) or file:// URI (native), null if not yet ready
  loading: boolean;
  error: boolean;
}

type ViewMode = 'single' | 'double';

// ─── WebP IndexedDB cache (web only) ─────────────────────────────────────────

interface WebpCacheSchema extends DBSchema {
  pages: { key: string; value: { blob: Blob; cachedAt: number } };
}

const WEBP_DB_NAME    = 'extrapadhai-webp-cache';
const WEBP_DB_VERSION = 1;
const WEBP_STORE      = 'pages';

let webpDbPromise: Promise<IDBPDatabase<WebpCacheSchema>> | null = null;

function getWebpDb(): Promise<IDBPDatabase<WebpCacheSchema>> {
  if (!webpDbPromise) {
    webpDbPromise = openDB<WebpCacheSchema>(WEBP_DB_NAME, WEBP_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(WEBP_STORE)) {
          db.createObjectStore(WEBP_STORE);
        }
      },
    });
  }
  return webpDbPromise;
}

async function webGetCachedPage(key: string): Promise<Blob | null> {
  try {
    const db = await getWebpDb();
    const entry = await db.get(WEBP_STORE, key);
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

async function webSavePage(key: string, blob: Blob): Promise<void> {
  try {
    const db = await getWebpDb();
    await db.put(WEBP_STORE, { blob, cachedAt: Date.now() }, key);
  } catch (e) {
    console.warn('[ImageViewer] webSavePage failed:', e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padPage(n: number): string {
  return String(n).padStart(3, '0');
}

/** Storage path for one page within Firebase Storage */
function fbPagePath(storagePath: string, pageNum: number): string {
  return `${storagePath}/pages/page_${padPage(pageNum)}.webp`;
}

/** Cache key for IndexedDB (web) */
function webCacheKey(storagePath: string, pageNum: number): string {
  return fbPagePath(storagePath, pageNum);
}

// ─── Native helpers (Capacitor Filesystem — dynamic imports) ──────────────────

function nativeLocalDir(
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string
): string {
  return `extrapadhai/${classId}/${subjectId}/${bookId}/${lessonId}`;
}

function nativeLocalFileName(pageNum: number): string {
  return `page_${padPage(pageNum)}.webp`;
}

async function nativeFileExists(path: string): Promise<boolean> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.stat({ path, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

async function nativeGetLocalUri(
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string,
  pageNum: number
): Promise<string | null> {
  try {
    const path = `${nativeLocalDir(classId, subjectId, bookId, lessonId)}/${nativeLocalFileName(pageNum)}`;
    const exists = await nativeFileExists(path);
    if (!exists) return null;
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const result = await Filesystem.getUri({ path, directory: Directory.Data });
    return result.uri;
  } catch {
    return null;
  }
}

async function nativeDownloadPage(
  storagePath: string,
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string,
  pageNum: number
): Promise<string> {
  const fbPath = fbPagePath(storagePath, pageNum);

  // Use Firebase SDK getBlob() — avoids getDownloadURL+fetch which fails in
  // Capacitor's Android WebView due to network security restrictions.
  const blob = await getBlob(storageRef(storage, fbPath));

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const dir      = nativeLocalDir(classId, subjectId, bookId, lessonId);
  const fileName = nativeLocalFileName(pageNum);

  await Filesystem.writeFile({
    path:      `${dir}/${fileName}`,
    data:      base64,
    directory: Directory.Data,
    recursive: true,
  });

  const result = await Filesystem.getUri({
    path:      `${dir}/${fileName}`,
    directory: Directory.Data,
  });
  return result.uri;
}

// ─── Web helpers (fetch + IndexedDB + blob URLs) ──────────────────────────────

async function webGetLocalUri(
  storagePath: string,
  pageNum: number
): Promise<string | null> {
  const key  = webCacheKey(storagePath, pageNum);
  const blob = await webGetCachedPage(key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

async function webDownloadPage(
  storagePath: string,
  pageNum: number
): Promise<string> {
  const fbPath = fbPagePath(storagePath, pageNum);

  // Use Firebase SDK getBlob() for consistency and reliability
  const blob = await getBlob(storageRef(storage, fbPath));

  const key = webCacheKey(storagePath, pageNum);
  await webSavePage(key, blob);

  return URL.createObjectURL(blob);
}

// ─── Unified page loaders (branch on platform) ───────────────────────────────

async function getLocalUri(
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string,
  storagePath: string,
  pageNum: number
): Promise<string | null> {
  if (isNative()) {
    return nativeGetLocalUri(classId, subjectId, bookId, lessonId, pageNum);
  }
  return webGetLocalUri(storagePath, pageNum);
}

async function downloadPage(
  storagePath: string,
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string,
  pageNum: number
): Promise<string> {
  if (isNative()) {
    return nativeDownloadPage(storagePath, classId, subjectId, bookId, lessonId, pageNum);
  }
  return webDownloadPage(storagePath, pageNum);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImageViewer({
  lessons,
  initialLessonId,
  classId,
  subjectId,
  bookId,
}: ImageViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [currentLessonIdx, setCurrentLessonIdx] = useState(() => {
    if (!initialLessonId) return 0;
    const idx = lessons.findIndex(l => l.id === initialLessonId);
    return idx >= 0 ? idx : 0;
  });
  const [currentPage, setCurrentPage] = useState(1); // 1-indexed (used in double mode)

  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; active: boolean }>({
    current: 0, total: 0, active: false,
  });
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pages, setPages]     = useState<PageState[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [allCached, setAllCached] = useState(false);

  // Track blob URLs created on web so we can revoke them on unmount / lesson change
  const blobUrlsRef = useRef<string[]>([]);

  const lesson    = lessons[currentLessonIdx];
  const pageCount = lesson?.pageCount || 0;
  // storagePath is NOT stored in Firestore — compute it dynamically from the known IDs
  const lessonStoragePath = lesson
    ? buildLessonStoragePath(classId, subjectId, bookId, lesson.id)
    : null;

  /** Revoke all tracked blob URLs (web only — no-op on native) */
  const revokeBlobUrls = useCallback(() => {
    if (isNative()) return;
    for (const u of blobUrlsRef.current) {
      try { URL.revokeObjectURL(u); } catch {}
    }
    blobUrlsRef.current = [];
  }, []);

  // ── Load pages for current lesson ──────────────────────────────────────────
  const loadLesson = useCallback(async () => {
    if (!lesson?.pagesReady || !lesson?.pageCount || !lessonStoragePath) return;

    setDownloadError(null);
    setAllCached(false);
    revokeBlobUrls(); // clean up previous blob URLs

    const total = lesson.pageCount;
    const sp    = lessonStoragePath;

    // Initialise placeholder state
    setPages(Array(total).fill({ uri: null, loading: true, error: false }));

    // ── Step 1: Check which pages are already cached locally ──
    let allLocal = true;
    const uris: (string | null)[] = [];

    for (let p = 1; p <= total; p++) {
      const uri = await getLocalUri(classId, subjectId, bookId, lesson.id, sp, p);
      uris.push(uri);
      if (!uri) allLocal = false;
      // Track blob URLs so they can be revoked later
      if (uri && !isNative() && uri.startsWith('blob:')) {
        blobUrlsRef.current.push(uri);
      }
    }

    if (allLocal) {
      setPages(uris.map(uri => ({ uri, loading: false, error: false })));
      setAllCached(true);
      return;
    }

    // ── Step 2: Download missing pages ──
    setDownloadProgress({ current: 0, total, active: true });
    const finalUris = [...uris];

    for (let p = 1; p <= total; p++) {
      if (finalUris[p - 1]) {
        setDownloadProgress(prev => ({ ...prev, current: p }));
        continue; // already cached
      }
      try {
        const uri = await downloadPage(sp!, classId, subjectId, bookId, lesson.id, p);
        finalUris[p - 1] = uri;

        if (!isNative() && uri.startsWith('blob:')) {
          blobUrlsRef.current.push(uri);
        }

        setDownloadProgress({ current: p, total, active: true });
        // Show pages progressively as they arrive
        setPages(prev => {
          const updated = [...prev];
          updated[p - 1] = { uri, loading: false, error: false };
          return updated;
        });
      } catch (err: any) {
        console.error(`[ImageViewer] Failed to download page ${p}:`, err);
        const isNetworkError =
          err.message?.includes('network') ||
          err.message?.includes('fetch') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('NetworkError');

        if (isNetworkError) {
          setIsOffline(true);
          setDownloadError('No internet connection. Connect to WiFi and try again.');
          setPages(prev => {
            const updated = [...prev];
            updated[p - 1] = { uri: null, loading: false, error: true };
            return updated;
          });
          break;
        }
        setPages(prev => {
          const updated = [...prev];
          updated[p - 1] = { uri: null, loading: false, error: true };
          return updated;
        });
      }
    }

    setDownloadProgress(prev => ({ ...prev, active: false }));

    // Check if all succeeded
    setAllCached(finalUris.every(u => !!u));
  }, [lesson, lessonStoragePath, classId, subjectId, bookId, revokeBlobUrls]);

  useEffect(() => {
    setCurrentPage(1);
    setIsOffline(false);
    loadLesson();
    // Cleanup blob URLs when lesson changes
    return revokeBlobUrls;
  }, [currentLessonIdx, loadLesson, revokeBlobUrls]);

  // Cleanup blob URLs on final unmount
  useEffect(() => () => revokeBlobUrls(), [revokeBlobUrls]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToPrevLesson = () => { if (currentLessonIdx > 0) setCurrentLessonIdx(i => i - 1); };
  const goToNextLesson = () => { if (currentLessonIdx < lessons.length - 1) setCurrentLessonIdx(i => i + 1); };
  const goToPrevPage   = () => setCurrentPage(p => Math.max(1, p - (viewMode === 'double' ? 2 : 1)));
  const goToNextPage   = () => setCurrentPage(p => Math.min(pageCount, p + (viewMode === 'double' ? 2 : 1)));

  // ── Render a single page image ─────────────────────────────────────────────
  const renderPage = (pageIdx: number) => {
    const pageState = pages[pageIdx];

    if (!pageState || pageState.loading || (!pageState.uri && !pageState.error)) {
      return (
        <div className="w-full aspect-[3/4] bg-slate-900 flex items-center justify-center rounded-lg">
          <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (pageState.error || !pageState.uri) {
      return (
        <div className="w-full aspect-[3/4] bg-slate-950 border border-rose-800/40 flex flex-col items-center justify-center gap-3 rounded-lg">
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <span className="text-xs text-rose-400 font-mono">Page {pageIdx + 1} failed to load</span>
          <button
            onClick={() => loadLesson()}
            className="flex items-center gap-1.5 text-[10px] font-mono text-violet-400 hover:text-violet-300 border border-violet-500/30 px-2 py-1 rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      );
    }

    return (
      <img
        src={pageState.uri}
        alt={`Page ${pageIdx + 1}`}
        className="w-full h-auto rounded shadow-xl select-none"
        draggable={false}
        style={{ touchAction: 'pinch-zoom' }}
      />
    );
  };

  // ── Guard: no WebP content yet ─────────────────────────────────────────────
  if (!lesson?.pagesReady || !lesson?.pageCount) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
        <BookOpen className="w-12 h-12 text-slate-600" />
        <h3 className="text-sm font-bold text-slate-300">Content not yet available</h3>
        <p className="text-xs text-slate-500 max-w-xs">
          The editor hasn't uploaded this lesson's content yet. Check back later.
        </p>
      </div>
    );
  }

  const isDownloading = downloadProgress.active;
  const downloadPct   = downloadProgress.total > 0
    ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
    : 0;

  // Displayed page indices (0-indexed)
  const leftPageIdx  = currentPage - 1;
  const rightPageIdx = currentPage; // for double view

  return (
    <div className="flex flex-col h-full bg-[#05070e] text-slate-200 select-none overflow-hidden">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0f1d] border-b border-slate-900 shrink-0 gap-3">

        {/* Lesson navigation */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={goToPrevLesson}
            disabled={currentLessonIdx === 0}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="min-w-0">
            <p className="text-[8px] font-mono text-slate-500 uppercase">
              Lesson {currentLessonIdx + 1} of {lessons.length}
            </p>
            <p className="text-xs font-bold text-white truncate max-w-[140px]">
              {lesson.title}
            </p>
          </div>
          <button
            onClick={goToNextLesson}
            disabled={currentLessonIdx === lessons.length - 1}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: page counter */}
        <div className="text-[10px] font-mono text-slate-400 shrink-0">
          {pageCount > 0 ? `Page ${currentPage} / ${pageCount}` : '—'}
        </div>

        {/* Right: status + view mode toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {isOffline && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-amber-400">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          {!isDownloading && allCached && pages.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
              <CheckCircle className="w-3 h-3" /> Saved
            </span>
          )}
          <button
            onClick={() => setViewMode(v => v === 'single' ? 'double' : 'single')}
            className={`p-1.5 rounded border transition-colors ${
              viewMode === 'double'
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={viewMode === 'single' ? 'Switch to double page' : 'Switch to single page'}
          >
            {viewMode === 'single' ? <Columns className="w-3.5 h-3.5" /> : <AlignJustify className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Download progress bar ── */}
      {isDownloading && (
        <div className="bg-[#0d1020] border-b border-violet-500/20 px-4 py-2 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono text-violet-300 flex items-center gap-1.5">
              <Download className="w-3 h-3 animate-bounce" />
              Downloading page {downloadProgress.current} of {downloadProgress.total}…
            </span>
            <span className="text-[9px] font-mono text-slate-400">{downloadPct}%</span>
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${downloadPct}%` }}
            />
          </div>
          <p className="text-[8px] font-mono text-slate-500 mt-1">
            {isNative()
              ? 'Saving to device — will open instantly next time'
              : 'Saving to browser cache — will load faster next time'}
          </p>
        </div>
      )}

      {/* ── Error banner ── */}
      {downloadError && (
        <div className="bg-rose-950/40 border-b border-rose-500/30 px-4 py-2 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-[10px] text-rose-300">{downloadError}</span>
          <button
            onClick={() => { setDownloadError(null); setIsOffline(false); loadLesson(); }}
            className="ml-auto flex items-center gap-1 text-[9px] font-mono text-violet-400 hover:text-violet-300 underline"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* ── Page content area ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {viewMode === 'single' ? (
          // ── Single page mode — all pages scrollable ──
          <div className="max-w-2xl mx-auto space-y-4">
            {pageCount > 0 ? (
              Array.from({ length: pageCount }, (_, i) => (
                <div key={i} className="w-full">
                  {renderPage(i)}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        ) : (
          // ── Double page mode — page-by-page with prev/next ──
          <div className="h-full flex flex-col gap-3">
            <div className="flex gap-2 flex-1">
              <div className="flex-1">{renderPage(leftPageIdx)}</div>
              {rightPageIdx < pageCount && (
                <div className="flex-1">{renderPage(rightPageIdx)}</div>
              )}
            </div>
            {/* Prev / Next for double mode */}
            <div className="flex items-center justify-center gap-6 py-2 shrink-0">
              <button
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-[10px] font-mono text-slate-400">
                {currentPage}–{Math.min(currentPage + 1, pageCount)} / {pageCount}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage >= pageCount}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Lesson navigation footer ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0f1d] border-t border-slate-900 shrink-0">
        <button
          onClick={goToPrevLesson}
          disabled={currentLessonIdx === 0}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {currentLessonIdx > 0 ? (lessons[currentLessonIdx - 1]?.title?.slice(0, 20) + '…') : 'Previous'}
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1.5">
          {lessons.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentLessonIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentLessonIdx ? 'bg-violet-400' : 'bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goToNextLesson}
          disabled={currentLessonIdx === lessons.length - 1}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {currentLessonIdx < lessons.length - 1
            ? (lessons[currentLessonIdx + 1]?.title?.slice(0, 20) + '…')
            : 'Next'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
