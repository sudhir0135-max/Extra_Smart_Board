/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PDF Viewer — cache-first strategy using IndexedDB.
 *
 * Load strategy:
 *   1. IndexedDB local cache (instant, no network)  ← NEW
 *   2. Direct fetch of the Firebase Storage download URL (CORS enabled)
 *   3. Firebase Storage SDK getBlob() — secondary attempt
 *   4. Iframe fallback               — guaranteed display if all else fails
 */

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ref, getBlob } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { getCachedPdf, cachePdf } from '../lib/pdfCache';
import { HardDrive, Wifi } from 'lucide-react';

// ── PDF.js worker setup ──
// On Capacitor Android the WebView uses the "capacitor://localhost" scheme,
// which makes import.meta.url resolve to a capacitor:// URL that the browser
// cannot load as a dedicated Worker. We therefore fall back to the CDN worker
// for native builds and use the bundled worker only for web.
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined') {
  // Check if running inside Capacitor native shell
  const isCapacitorNative =
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.();

  if (isCapacitorNative) {
    // Use CDN worker — always reachable from native because the WebView
    // uses the device's Chrome engine which supports HTTPS fetches.
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } else {
    // Standard web path via Vite's bundled worker URL
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }
}

interface PdfViewerProps {
  url: string;
  viewMode: 'single' | 'double';
}

function getStoragePath(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'firebasestorage.googleapis.com') return null;
    const match = u.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

type LoadSource = 'cache' | 'network' | null;

async function loadPdfBytes(url: string): Promise<{ data: ArrayBuffer; source: LoadSource }> {
  // ── Strategy 1: IndexedDB local cache ──
  try {
    const cachedBlob = await getCachedPdf(url);
    if (cachedBlob) {
      console.log('[PdfViewer] serving from local cache ✓');
      const data = await cachedBlob.arrayBuffer();
      return { data, source: 'cache' };
    }
  } catch (e) {
    console.warn('[PdfViewer] cache read failed:', e);
  }

  // ── Strategy 2: Direct fetch (CORS configured on bucket) ──
  try {
    console.log('[PdfViewer] fetching via URL...');
    const resp = await fetch(url, { mode: 'cors' });
    const ct = resp.headers.get('content-type') || '';
    if (resp.ok && !ct.includes('text/html')) {
      const buf = await resp.arrayBuffer();
      console.log('[PdfViewer] fetch success, bytes:', buf.byteLength);
      // Cache the fetched PDF for next time
      const blob = new Blob([buf], { type: 'application/pdf' });
      cachePdf(url, blob).catch(() => {}); // fire-and-forget
      return { data: buf.slice(0), source: 'network' };
    }
    throw new Error(`Bad response: ${resp.status} ${ct}`);
  } catch (e1) {
    console.warn('[PdfViewer] direct fetch failed:', e1);
  }

  // ── Strategy 3: Firebase Storage SDK getBlob() ──
  const storagePath = getStoragePath(url);
  if (storagePath) {
    try {
      console.log('[PdfViewer] trying SDK getBlob:', storagePath);
      const blob = await getBlob(ref(storage, storagePath));
      const data = await blob.arrayBuffer();
      // Cache it for next time
      cachePdf(url, blob).catch(() => {});
      return { data, source: 'network' };
    } catch (e2) {
      console.warn('[PdfViewer] SDK getBlob failed:', e2);
    }
  }

  throw new Error('ALL_FAILED');
}

export default function PdfViewer({ url, viewMode }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useFallbackIframe, setUseFallbackIframe] = useState(false);
  const [loadSource, setLoadSource] = useState<LoadSource>(null);

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTaskRefs = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());

  // ── Load PDF ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNumPages(0);
    setUseFallbackIframe(false);
    setLoadSource(null);
    canvasRefs.current.clear();
    if (pdfDocRef.current) { pdfDocRef.current.destroy(); pdfDocRef.current = null; }

    loadPdfBytes(url)
      .then(({ data, source }) => {
        if (cancelled) return;
        setLoadSource(source);
        return pdfjsLib.getDocument({ data: data.slice(0) }).promise;
      })
      .then((doc) => {
        if (!doc || cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[PdfViewer] falling back to iframe:', err);
        setUseFallbackIframe(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      renderTaskRefs.current.forEach((t) => { try { t.cancel(); } catch (_) {} });
      renderTaskRefs.current.clear();
    };
  }, [url]);

  // ── Render pages ──
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return;

    const renderPage = async (pageNum: number) => {
      await new Promise((r) => setTimeout(r, 10));
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas || !pdfDocRef.current) return;

      const prev = renderTaskRefs.current.get(pageNum);
      if (prev) { try { prev.cancel(); } catch (_) {} }

      const page = await pdfDocRef.current.getPage(pageNum);
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const targetWidth = viewMode === 'double'
        ? Math.floor(containerWidth / 2) - 4
        : containerWidth - 16;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.5, targetWidth / base.width);
      const viewport = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRefs.current.set(pageNum, task);
      try { await task.promise; }
      catch (e: any) { if (e?.name !== 'RenderingCancelledException') console.error(e); }
    };

    Array.from({ length: numPages }, (_, i) => i + 1).forEach(renderPage);
  }, [numPages, viewMode]);

  const registerCanvas = (n: number) => (el: HTMLCanvasElement | null) => {
    if (el) canvasRefs.current.set(n, el);
  };

  // ── Source badge ──
  const SourceBadge = () => {
    if (!loadSource) return null;
    return loadSource === 'cache' ? (
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-emerald-900/80 text-emerald-300 text-[10px] font-bold font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border border-emerald-500/30 backdrop-blur-sm shadow-md"
        title="Served from local device cache"
      >
        <HardDrive className="w-3 h-3" />
        Offline Cache
      </div>
    ) : (
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-sky-900/80 text-sky-300 text-[10px] font-bold font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border border-sky-500/30 backdrop-blur-sm shadow-md"
        title="Fetched from network and saved to local cache"
      >
        <Wifi className="w-3 h-3" />
        Network · Saved
      </div>
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-neutral-950">
        <div className="w-10 h-10 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
        <p className="text-slate-400 text-sm font-mono tracking-wide">Loading PDF…</p>
      </div>
    );
  }

  // ── Iframe fallback ──
  if (useFallbackIframe) {
    return (
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden bg-neutral-900">
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="flex-1 w-full border-0"
          title="PDF Viewer"
          allow="fullscreen"
        />
      </div>
    );
  }

  // ── PDF.js canvas ──
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  if (viewMode === 'single') {
    return (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-neutral-800 flex flex-col items-center py-6 gap-5 relative"
        id="pdf-single-scroll"
      >
        <SourceBadge />
        {pages.map((n) => (
          <div key={n} className="shadow-2xl bg-white" style={{ lineHeight: 0 }}>
            <canvas ref={registerCanvas(n)} className="block" />
          </div>
        ))}
      </div>
    );
  }

  /* ── DOUBLE PAGE BOOK SPREAD ── */
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
