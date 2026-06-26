/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PDF Viewer — cache-first, Android Capacitor-safe.
 *
 * Load order:
 *   1. Capacitor Filesystem (native) / IndexedDB (web) — instant offline
 *   2. Firebase SDK getBlob() — bypasses CORS on Android
 *   3. Direct fetch() — web fallback
 *
 * Render order:
 *   1. PDF.js canvas — best quality
 *   2. <iframe> with data: URL — Capacitor fallback if PDF.js worker fails
 *   3. <iframe> with remote URL — last resort on web
 */

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getCachedPdf, cachePdf, downloadAndCachePdf, isNative } from '../lib/pdfCache';
import { HardDrive, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';

// ─── Worker setup ────────────────────────────────────────────────────────────
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

function setupWorker() {
  const isCapacitor =
    typeof (window as any).Capacitor !== 'undefined' &&
    !!(window as any).Capacitor?.isNativePlatform?.();

  if (isCapacitor) {
    // On Android the bundled worker has a capacitor:// URL which can't be used
    // as a dedicated Worker. Use CDN instead.
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } else {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  }
}

if (typeof window !== 'undefined') setupWorker();

// ─── Types ───────────────────────────────────────────────────────────────────
interface PdfViewerProps {
  url: string;
  viewMode: 'single' | 'double';
}

type LoadSource = 'cache' | 'network' | null;
type RenderMode = 'pdfjs' | 'iframe-data' | 'iframe-url' | 'error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Promise that rejects after `ms` milliseconds */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} after ${ms}ms`)), ms)
    ),
  ]);
}

/** Load PDF bytes from cache or network. Returns Uint8Array. */
async function loadPdfBytes(url: string): Promise<{ data: Uint8Array; source: LoadSource }> {
  // ── 1. Local cache (Capacitor Filesystem on native, IndexedDB on web) ──
  try {
    const cached = await getCachedPdf(url);
    if (cached && cached.size > 0) {
      console.log('[PdfViewer] ✓ Serving from local cache, size:', cached.size);
      const buf = await cached.arrayBuffer();
      return { data: new Uint8Array(buf), source: 'cache' };
    }
  } catch (e) {
    console.warn('[PdfViewer] Cache read failed:', e);
  }

  // ── 2. Firebase SDK getBlob() — no CORS issues ──
  const isFirebase =
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('firebasestorage.app');

  if (isFirebase) {
    try {
      console.log('[PdfViewer] Downloading via Firebase SDK...');
      const blob = await downloadAndCachePdf(url);
      if (blob && blob.size > 0) {
        const buf = await blob.arrayBuffer();
        return { data: new Uint8Array(buf), source: 'network' };
      }
    } catch (e) {
      console.warn('[PdfViewer] Firebase SDK failed:', e);
    }
  }

  // ── 3. Direct fetch ──
  try {
    console.log('[PdfViewer] Downloading via fetch()...');
    const resp = await fetch(url, { mode: 'cors' });
    const ct = resp.headers.get('content-type') ?? '';
    if (!resp.ok || ct.includes('text/html')) throw new Error(`Bad resp: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    const blob = new Blob([buf], { type: 'application/pdf' });
    cachePdf(url, blob).catch(() => {});
    return { data: new Uint8Array(buf), source: 'network' };
  } catch (e) {
    console.warn('[PdfViewer] fetch() failed:', e);
  }

  throw new Error('ALL_SOURCES_FAILED');
}

/** Convert Uint8Array to a base64 data: URL for iframe fallback */
function uint8ToDataUrl(data: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PdfViewer({ url, viewMode }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages]       = useState(0);
  const [loading, setLoading]         = useState(true);
  const [renderMode, setRenderMode]   = useState<RenderMode>('pdfjs');
  const [loadSource, setLoadSource]   = useState<LoadSource>(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [dataUrl, setDataUrl]         = useState('');   // for iframe-data fallback
  const [retryKey, setRetryKey]       = useState(0);

  const pdfDocRef     = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const canvasRefs    = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTaskRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());

  // ── Load PDF ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setNumPages(0);
    setRenderMode('pdfjs');
    setLoadSource(null);
    setErrorMsg('');
    setDataUrl('');
    canvasRefs.current.clear();
    renderTaskRef.current.forEach(t => { try { t.cancel(); } catch {} });
    renderTaskRef.current.clear();
    if (pdfDocRef.current) { pdfDocRef.current.destroy(); pdfDocRef.current = null; }

    const run = async () => {
      let pdfData: Uint8Array;
      let source: LoadSource;

      // ── Step 1: Get bytes ──
      try {
        const result = await loadPdfBytes(url);
        pdfData = result.data;
        source  = result.source;
      } catch (e) {
        if (cancelled) return;
        console.error('[PdfViewer] Cannot load PDF:', e);
        setErrorMsg('Could not download PDF. Check your internet connection.');
        setRenderMode('error');
        setLoading(false);
        return;
      }

      if (cancelled) return;
      setLoadSource(source);

      // ── Step 2: Try PDF.js with 15s timeout ──
      try {
        const doc = await withTimeout(
          pdfjsLib.getDocument({ data: pdfData }).promise,
          15000,
          'PDF.js getDocument'
        );
        if (cancelled) { doc.destroy(); return; }
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setRenderMode('pdfjs');
        setLoading(false);
        console.log('[PdfViewer] ✓ PDF.js loaded, pages:', doc.numPages);
        return;
      } catch (e) {
        console.warn('[PdfViewer] PDF.js failed/timed-out:', e);
      }

      if (cancelled) return;

      // ── Step 3: iframe with data: URL (works on Android without network) ──
      try {
        console.log('[PdfViewer] Falling back to iframe with data: URL...');
        const dUrl = uint8ToDataUrl(pdfData);
        setDataUrl(dUrl);
        setRenderMode('iframe-data');
        setLoading(false);
        return;
      } catch (e) {
        console.warn('[PdfViewer] data: URL fallback failed:', e);
      }

      if (cancelled) return;

      // ── Step 4: iframe with remote URL ──
      console.log('[PdfViewer] Final fallback: iframe with remote URL');
      setRenderMode('iframe-url');
      setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
      renderTaskRef.current.forEach(t => { try { t.cancel(); } catch {} });
      renderTaskRef.current.clear();
    };
  }, [url, retryKey]);

  // ── Render pages via PDF.js ─────────────────────────────────────────────────
  useEffect(() => {
    if (renderMode !== 'pdfjs' || !pdfDocRef.current || numPages === 0) return;

    const renderPage = async (pageNum: number) => {
      // Small delay so canvases are mounted
      await new Promise(r => setTimeout(r, 20));
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas || !pdfDocRef.current) return;

      const prev = renderTaskRef.current.get(pageNum);
      if (prev) { try { prev.cancel(); } catch {} }

      try {
        const page = await pdfDocRef.current.getPage(pageNum);
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const targetWidth = viewMode === 'double'
          ? Math.floor(containerWidth / 2) - 4
          : containerWidth - 16;

        const base     = page.getViewport({ scale: 1 });
        const scale    = Math.max(0.5, targetWidth / base.width);
        const viewport = page.getViewport({ scale });
        const dpr      = window.devicePixelRatio || 1;

        canvas.width        = Math.floor(viewport.width  * dpr);
        canvas.height       = Math.floor(viewport.height * dpr);
        canvas.style.width  = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current.set(pageNum, task);
        await task.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          console.warn('[PdfViewer] Page render error:', e);
        }
      }
    };

    Array.from({ length: numPages }, (_, i) => i + 1).forEach(renderPage);
  }, [numPages, viewMode, renderMode]);

  const registerCanvas = (n: number) => (el: HTMLCanvasElement | null) => {
    if (el) canvasRefs.current.set(n, el);
  };

  // ── Source badge ────────────────────────────────────────────────────────────
  const SourceBadge = () => {
    if (!loadSource) return null;
    return loadSource === 'cache' ? (
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-emerald-900/80 text-emerald-300 text-[10px] font-bold font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/30 backdrop-blur-sm shadow-md">
        <HardDrive className="w-3 h-3" /> Offline · Cache
      </div>
    ) : (
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-sky-900/80 text-sky-300 text-[10px] font-bold font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border border-sky-500/30 backdrop-blur-sm shadow-md">
        <Wifi className="w-3 h-3" /> Network · Saved
      </div>
    );
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-neutral-950">
        <div className="w-10 h-10 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
        <p className="text-slate-400 text-sm font-mono tracking-wide">Loading PDF…</p>
        {isNative() && (
          <p className="text-slate-600 text-xs font-mono">Reading from device storage…</p>
        )}
      </div>
    );
  }

  // ── Error screen ────────────────────────────────────────────────────────────
  if (renderMode === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-neutral-950 p-8">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <p className="text-slate-300 text-sm text-center">{errorMsg || 'Failed to load PDF.'}</p>
        <button
          onClick={() => setRetryKey(k => k + 1)}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  // ── iframe with data: URL (Android PDF.js fallback) ─────────────────────────
  if (renderMode === 'iframe-data' && dataUrl) {
    return (
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden bg-neutral-900 relative">
        <SourceBadge />
        <iframe
          src={dataUrl}
          className="flex-1 w-full border-0"
          title="PDF Viewer"
          allow="fullscreen"
        />
      </div>
    );
  }

  // ── iframe with remote URL (last resort) ─────────────────────────────────────
  if (renderMode === 'iframe-url') {
    return (
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden bg-neutral-900 relative">
        <SourceBadge />
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          className="flex-1 w-full border-0"
          title="PDF Viewer"
          allow="fullscreen"
        />
      </div>
    );
  }

  // ── PDF.js canvas rendering ──────────────────────────────────────────────────
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  if (viewMode === 'single') {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-neutral-800 flex flex-col items-center py-6 gap-5 relative"
        id="pdf-single-scroll"
      >
        <SourceBadge />
        {pages.map(n => (
          <div key={n} className="shadow-2xl bg-white" style={{ lineHeight: 0 }}>
            <canvas ref={registerCanvas(n)} className="block" />
          </div>
        ))}
      </div>
    );
  }

  /* ── Double page book spread ── */
  const pairs: Array<[number, number | null]> = [];
  for (let i = 0; i < pages.length; i += 2) pairs.push([pages[i], pages[i + 1] ?? null]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto bg-neutral-800 flex flex-col items-center py-6 gap-5 relative"
      id="pdf-double-scroll"
    >
      <SourceBadge />
      {pairs.map(([left, right], idx) => (
        <div key={idx} className="flex shadow-2xl w-[98%]" style={{ lineHeight: 0 }}>
          <div className="flex-1 bg-white flex justify-end overflow-hidden">
            <canvas ref={registerCanvas(left)} className="block max-w-full" />
          </div>
          <div className="w-[2px] bg-neutral-500 flex-shrink-0 self-stretch" />
          <div className="flex-1 bg-white flex justify-start overflow-hidden">
            {right !== null ? (
              <canvas ref={registerCanvas(right)} className="block max-w-full" />
            ) : (
              <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-4 p-10 bg-[#faf7f2]">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-400/40 flex items-center justify-center text-3xl">📖</div>
                <p className="text-[#b8860b] font-serif text-xl font-bold text-center">Thanks for choosing</p>
                <p className="text-[#c8860a] font-black text-2xl tracking-tight text-center">ExtraPadhai.com</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
