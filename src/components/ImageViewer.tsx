/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ImageViewer — replaces PdfViewer entirely.
 * Displays WebP page images for a lesson from local device storage.
 * On first open, downloads images from Firebase Storage automatically.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { storage } from '../lib/firebase';
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
} from 'lucide-react';

interface ImageViewerProps {
  lessons: Lesson[];            // All lessons for this book, in order
  initialLessonId?: string;     // Which lesson to jump to on open
  classId: string;
  subjectId: string;
  bookId: number | string;
}

interface PageState {
  uri: string | null;           // local file:// URI or null if not downloaded
  loading: boolean;
  error: boolean;
}

type ViewMode = 'single' | 'double';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function padPage(n: number) {
  return String(n).padStart(3, '0');
}

function localDir(classId: string, subjectId: string, bookId: string | number, lessonId: string) {
  return `extrapadhai/${classId}/${subjectId}/${bookId}/${lessonId}`;
}

function localFileName(pageNum: number) {
  return `page_${padPage(pageNum)}.webp`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

async function getLocalUri(classId: string, subjectId: string, bookId: string | number, lessonId: string, pageNum: number): Promise<string | null> {
  const path = `${localDir(classId, subjectId, bookId, lessonId)}/${localFileName(pageNum)}`;
  try {
    const exists = await fileExists(path);
    if (!exists) return null;
    const result = await Filesystem.getUri({ path, directory: Directory.Data });
    return result.uri;
  } catch {
    return null;
  }
}

async function downloadPage(
  storagePath: string,
  classId: string,
  subjectId: string,
  bookId: string | number,
  lessonId: string,
  pageNum: number
): Promise<string> {
  const fbPath = `${storagePath}/pages/page_${padPage(pageNum)}.webp`;
  const url = await getDownloadURL(storageRef(storage, fbPath));

  // Fetch as base64
  const response = await fetch(url);
  const blob = await response.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const dir = localDir(classId, subjectId, bookId, lessonId);
  const fileName = localFileName(pageNum);

  await Filesystem.writeFile({
    path: `${dir}/${fileName}`,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });

  const result = await Filesystem.getUri({ path: `${dir}/${fileName}`, directory: Directory.Data });
  return result.uri;
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
  const [currentPage, setCurrentPage] = useState(1); // 1-indexed

  // Download state for current lesson
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; active: boolean }>({ current: 0, total: 0, active: false });
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageState[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const lesson = lessons[currentLessonIdx];
  const pageCount = lesson?.pageCount || 0;

  // ── Load pages for current lesson ──────────────────────────────────────────
  const loadLesson = useCallback(async () => {
    if (!lesson?.storagePath || !lesson?.pageCount) return;

    setDownloadError(null);
    setPages([]);

    const total = lesson.pageCount;
    const newPages: PageState[] = Array(total).fill({ uri: null, loading: true, error: false });
    setPages([...newPages]);

    // Check which pages exist locally
    let allLocal = true;
    const uris: (string | null)[] = [];
    for (let p = 1; p <= total; p++) {
      const uri = await getLocalUri(classId, subjectId, bookId, lesson.id, p);
      uris.push(uri);
      if (!uri) allLocal = false;
    }

    if (allLocal) {
      // All pages cached — show immediately
      setPages(uris.map(uri => ({ uri, loading: false, error: false })));
      return;
    }

    // Download missing pages
    setDownloadProgress({ current: 0, total, active: true });
    const finalUris = [...uris];

    for (let p = 1; p <= total; p++) {
      if (finalUris[p - 1]) {
        setDownloadProgress(prev => ({ ...prev, current: p }));
        continue; // already cached
      }
      try {
        const uri = await downloadPage(lesson.storagePath!, classId, subjectId, bookId, lesson.id, p);
        finalUris[p - 1] = uri;
        setDownloadProgress({ current: p, total, active: true });
        // Show pages progressively as they download
        setPages(prev => {
          const updated = [...prev];
          updated[p - 1] = { uri, loading: false, error: false };
          return updated;
        });
      } catch (err: any) {
        console.error(`[ImageViewer] Failed to download page ${p}:`, err);
        if (err.message?.includes('network') || err.message?.includes('fetch')) {
          setIsOffline(true);
          setDownloadError('No internet connection. Connect to WiFi and try again.');
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
  }, [lesson, classId, subjectId, bookId]);

  useEffect(() => {
    setCurrentPage(1);
    loadLesson();
  }, [currentLessonIdx, loadLesson]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToPrevLesson = () => {
    if (currentLessonIdx > 0) {
      setCurrentLessonIdx(i => i - 1);
    }
  };

  const goToNextLesson = () => {
    if (currentLessonIdx < lessons.length - 1) {
      setCurrentLessonIdx(i => i + 1);
    }
  };

  const goToPrevPage = () => setCurrentPage(p => Math.max(1, p - (viewMode === 'double' ? 2 : 1)));
  const goToNextPage = () => setCurrentPage(p => Math.min(pageCount, p + (viewMode === 'double' ? 2 : 1)));

  // ── Render a single page image ─────────────────────────────────────────────
  const renderPage = (pageIdx: number) => {
    const pageState = pages[pageIdx];
    if (!pageState) {
      return (
        <div className="w-full aspect-[3/4] bg-slate-900 animate-pulse rounded" />
      );
    }
    if (pageState.loading || (!pageState.uri && !pageState.error)) {
      return (
        <div className="w-full aspect-[3/4] bg-slate-900 flex items-center justify-center rounded">
          <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (pageState.error || !pageState.uri) {
      return (
        <div className="w-full aspect-[3/4] bg-slate-950 border border-rose-800/40 flex flex-col items-center justify-center gap-2 rounded">
          <AlertCircle className="w-6 h-6 text-rose-400" />
          <span className="text-[10px] text-rose-400 font-mono">Page {pageIdx + 1} failed</span>
        </div>
      );
    }
    return (
      <img
        src={pageState.uri}
        alt={`Page ${pageIdx + 1}`}
        className="w-full h-auto rounded shadow-lg select-none"
        draggable={false}
        style={{ touchAction: 'pinch-zoom' }}
      />
    );
  };

  // ── No WebP content yet ────────────────────────────────────────────────────
  if (!lesson?.pagesReady || !lesson?.storagePath) {
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
  const downloadPct = downloadProgress.total > 0
    ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
    : 0;

  // Displayed page indices (0-indexed)
  const leftPageIdx = currentPage - 1;
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

        {/* Right: view mode toggle + offline badge */}
        <div className="flex items-center gap-2 shrink-0">
          {isOffline && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-amber-400">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          {!isDownloading && pages.every(p => p.uri) && pages.length > 0 && (
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
              Downloading page {downloadProgress.current} of {downloadProgress.total}...
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
            Saved to device — will open instantly next time
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
            className="ml-auto text-[9px] font-mono text-violet-400 hover:text-violet-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Page content area ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {viewMode === 'single' ? (
          // ── Single page mode — show all pages scrollable ──
          <div className="max-w-2xl mx-auto space-y-4">
            {pageCount > 0 ? (
              Array.from({ length: pageCount }, (_, i) => (
                <div key={i} className="w-full">
                  {renderPage(i)}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
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
            {/* Page navigation for double mode */}
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
          {currentLessonIdx > 0 ? lessons[currentLessonIdx - 1]?.title?.slice(0, 20) + '...' : 'Previous'}
        </button>
        <div className="flex gap-1">
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
          {currentLessonIdx < lessons.length - 1 ? lessons[currentLessonIdx + 1]?.title?.slice(0, 20) + '...' : 'Next'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
