/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getCachedPdf, downloadAndCachePdf } from '../lib/pdfCache';
import { RefreshCw, FileText, AlertCircle, Eye, WifiOff } from 'lucide-react';
import { ThemeMode } from '../types';

// Set up pdfjs worker using bundled local worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfPageViewerProps {
  pdfUrl: string;
  imageViewMode?: 'single' | 'two';
  themeMode?: ThemeMode;
  fontSizeScale?: number;
  onTotalPagesLoaded?: (numPages: number) => void;
}

interface RenderedPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export default function PdfPageViewer({
  pdfUrl,
  imageViewMode = 'single',
  themeMode = 'parchment',
  onTotalPagesLoaded,
}: PdfPageViewerProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [renderProgress, setRenderProgress] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadAndRenderPdf() {
      if (!pdfUrl) {
        setError('No PDF URL provided for this chapter.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setRenderedPages([]);
      setDownloadProgress(0);
      setRenderProgress('Initializing PDF engine...');

      try {
        // 1. Fetch PDF Blob (cached or network)
        let blob = await getCachedPdf(pdfUrl);
        if (!blob) {
          setRenderProgress('Downloading PDF document...');
          blob = await downloadAndCachePdf(pdfUrl, (loaded, total) => {
            if (total > 0 && !isCancelled) {
              setDownloadProgress(Math.round((loaded / total) * 100));
            }
          });
        }

        if (!blob || isCancelled) {
          if (!blob) setError('Failed to download or read PDF file. Please check connection.');
          setLoading(false);
          return;
        }

        // 2. Read array buffer
        const arrayBuffer = await blob.arrayBuffer();
        if (isCancelled) return;

        setRenderProgress('Parsing PDF document structure...');

        // 3. Load document into pdfjs
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        });
        const pdfDoc = await loadingTask.promise;

        if (isCancelled) return;

        const numPages = pdfDoc.numPages;
        setTotalPages(numPages);
        onTotalPagesLoaded?.(numPages);

        const pages: RenderedPage[] = [];

        // 4. Render each page to Data URL canvas
        const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const renderScale = 1.5 * devicePixelRatio;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (isCancelled) return;

          setRenderProgress(`Rendering page ${pageNum} of ${numPages}...`);

          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (context) {
            // Fill canvas with solid white background to preserve transparent PDF images & vector graphics
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, viewport.width, viewport.height);

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
              canvas: canvas,
            };
            await page.render(renderContext).promise;

            pages.push({
              pageNumber: pageNum,
              dataUrl: canvas.toDataURL('image/png'),
              width: viewport.width,
              height: viewport.height,
            });
          }
        }

        if (!isCancelled) {
          setRenderedPages(pages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('PdfPageViewer load error:', err);
        if (!isCancelled) {
          setError(err?.message || 'Failed to parse PDF pages.');
          setLoading(false);
        }
      }
    }

    loadAndRenderPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl]);

  if (loading) {
    return (
      <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-8 gap-4 text-center">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
        <div className="space-y-1">
          <p className="font-bold text-slate-200 text-base">{renderProgress || 'Loading Chapter PDF...'}</p>
          {downloadProgress > 0 && downloadProgress < 100 && (
            <div className="w-64 bg-slate-800 rounded-full h-2 overflow-hidden mx-auto mt-2">
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}
          <p className="text-xs text-slate-400 font-mono">Preparing high-resolution continuous layout</p>
        </div>
      </div>
    );
  }

  if (error || renderedPages.length === 0) {
    if (pdfUrl) {
      return (
        <div className="w-full min-h-[80vh] flex flex-col items-center p-4 gap-4">
          <div className="w-full flex items-center justify-between text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 p-2.5 px-4 rounded-xl">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> PDF Document Reader (Browser Engine)
            </span>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline font-bold hover:text-white">
              Open Original PDF
            </a>
          </div>
          <iframe
            src={pdfUrl}
            title="PDF Chapter Viewer"
            className="w-full min-h-[85vh] rounded-2xl border border-slate-700/60 shadow-2xl bg-white"
          />
        </div>
      );
    }

    return (
      <div className="w-full min-h-[40vh] flex flex-col items-center justify-center p-8 gap-3 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl my-6">
        <FileText className="w-12 h-12 text-slate-500" />
        <h4 className="font-bold text-slate-300 text-base">No Chapter PDF Attached</h4>
        <p className="text-xs text-slate-400 max-w-md">
          {error || 'No PDF file has been uploaded for this chapter yet. Please upload a PDF in the Book Editor Panel.'}
        </p>
      </div>
    );
  }

  // Double page layout grouping
  const pageRows: RenderedPage[][] = [];
  if (imageViewMode === 'two') {
    for (let i = 0; i < renderedPages.length; i += 2) {
      pageRows.push(renderedPages.slice(i, i + 2));
    }
  }

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-6 py-6 px-[2%]" id="continuous-pdf-viewer">
      <div className="flex items-center justify-between text-xs font-mono text-amber-500/80 border-b border-amber-500/20 pb-2 mb-2 select-none">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
          <FileText className="w-4 h-4" />
          PDF Document • {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} ({imageViewMode === 'two' ? 'Double Page View' : 'Single Page View'})
        </span>
      </div>

      {imageViewMode === 'two' ? (
        <div className="flex flex-col gap-8 w-full">
          {pageRows.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-2 gap-6 w-full items-start">
              {row.map((pg) => (
                <div key={pg.pageNumber} className="relative w-full flex flex-col items-center">
                  <div className="absolute top-3 right-4 z-10 bg-slate-900/80 text-amber-400 border border-slate-700/80 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-md select-none">
                    Page {pg.pageNumber}
                  </div>
                  <img
                    src={pg.dataUrl}
                    alt={`PDF Page ${pg.pageNumber}`}
                    className="w-full h-auto rounded-xl border border-slate-700/60 shadow-2xl object-contain bg-white"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-8 w-full items-center">
          {renderedPages.map((pg) => (
            <div key={pg.pageNumber} className="relative w-full max-w-5xl flex flex-col items-center">
              <div className="absolute top-3 right-4 z-10 bg-slate-900/80 text-amber-400 border border-slate-700/80 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-md select-none">
                Page {pg.pageNumber}
              </div>
              <img
                src={pg.dataUrl}
                alt={`PDF Page ${pg.pageNumber}`}
                className="w-full h-auto rounded-xl border border-slate-700/60 shadow-2xl object-contain bg-white"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
