/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Book, Lesson, ThemeMode, AcademicSubject, BookEditor } from '../types';
import DynamicFigure from './DynamicFigure';
import ScribbleOverlay from './ScribbleOverlay';
import BlackboardPanel from './BlackboardPanel';
import { Plus, Info, Check, Upload, BookOpen, AlertCircle, FileText, X } from 'lucide-react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { BlockMath } from 'react-katex';
import ImageFrame from './ImageFrame';
import CachedImage from './CachedImage';
import { getLocalImageSrc } from '../lib/imageCache';
import { renderMathInRawHtml } from '../lib/mathPreprocessor';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';

/**
 * Strips inline CSS properties that TinyMCE's dark editor bakes into saved HTML.
 * The dark editor (background:#03060c, color:#e2e8f0) stores near-white inline
 * color styles that become invisible on light student themes (parchment, mono).
 *
 * This runs on the HTML STRING before React ever sets dangerouslySetInnerHTML,
 * so the virtual DOM and real DOM are both clean from the start — no CSS
 * specificity fight, no post-render DOM manipulation timing window.
 */
function stripInlineStyles(html: string): string {
  if (!html || typeof html !== 'string') return html ?? '';

  // Use DOMParser so we handle nested, malformed, and complex HTML correctly.
  // Only elements that actually have a style attribute are touched — fast.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    // Never touch KaTeX elements — they manage their own colours internally.
    if (el.closest('.katex')) return;
    // Never touch lesson-annotation spans — they have intentional coloured underlines.
    if (el.classList.contains('lesson-annotation')) return;
    const col = el.style.color;
    const bg = el.style.backgroundColor;
    
    if (col === 'rgb(226, 232, 240)' || col === '#e2e8f0') {
      el.style.removeProperty('color');
    }
    if (bg === 'rgb(3, 6, 12)' || bg === '#03060c' || bg === 'rgba(0, 0, 0, 0)') {
      el.style.removeProperty('background-color');
    }
    if (el.style.background === 'rgb(3, 6, 12)' || el.style.background === '#03060c') {
      el.style.removeProperty('background');
    }

    el.style.removeProperty('opacity');
    el.style.removeProperty('mix-blend-mode');
    el.style.removeProperty('filter');

    // Clean up empty style attributes left behind
    if (!el.getAttribute('style')?.trim()) {
      el.removeAttribute('style');
    }
  });

  return doc.body.innerHTML;
}



function VirtualPageWrapper({ virtualRow, measureElement, pageContentHash, children }: any) {
  const ref = useRef<HTMLDivElement>(null);
  
  // Math is pre-rendered in the HTML string by renderMathInHtml() during sanitizedPages memo.
  // No post-render DOM walk needed here — keeping useLayoutEffect lean.
  React.useLayoutEffect(() => {
    if (!ref.current) return;

    // ── Strip TinyMCE dark-editor inline colors (belt-and-suspenders) ──────
    ref.current.querySelectorAll<HTMLElement>('*').forEach(child => {
      if (child.closest('.katex') || child.closest('.katex-display')) return;
      if (child.classList.contains('lesson-annotation')) return;
      const col = child.style.color;
      const bg = child.style.backgroundColor;
      
      // Strip ONLY the default TinyMCE dark theme colors that get accidentally baked in
      if (col === 'rgb(226, 232, 240)' || col === '#e2e8f0') {
        child.style.removeProperty('color');
      }
      if (bg === 'rgb(3, 6, 12)' || bg === '#03060c' || bg === 'rgba(0, 0, 0, 0)') {
        child.style.removeProperty('background-color');
      }
      if (child.style.background === 'rgb(3, 6, 12)' || child.style.background === '#03060c') {
        child.style.removeProperty('background');
      }
    });

    const imgs = ref.current.querySelectorAll('img');
    imgs.forEach(async (img) => {
      // 1. Handle Capacitor offline loading
      if (typeof (window as any).Capacitor !== 'undefined') {
        const originalSrc = img.getAttribute('src');
        if (originalSrc && originalSrc.startsWith('http') && !img.hasAttribute('data-offline-loaded')) {
          const localSrc = await getLocalImageSrc(originalSrc);
          if (localSrc !== originalSrc) img.src = localSrc;
          img.setAttribute('data-offline-loaded', 'true');
        }
      }
      
      // 2. Handle broken images (often caused by pasting images with OCR alt text)
      const handleBrokenImage = () => {
        if (img.alt && img.alt.length > 10) {
          const span = document.createElement('span');
          span.className = "recovered-alt-text";
          span.textContent = img.alt;
          img.replaceWith(span);
        }
      };

      if (img.complete) {
        if (img.naturalHeight === 0) handleBrokenImage();
      } else {
        img.addEventListener('error', handleBrokenImage);
      }
    });
  }, [pageContentHash]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        measureElement(el);
      }}
      data-index={virtualRow.index}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {children}
    </div>
  );
}

interface WorkspaceProps {
  selectedBook: Book | null;
  activeLesson: Lesson | null;
  themeMode: ThemeMode;
  fontSizeScale: number;
  isDrawingEnabled: boolean;
  onStrokeSaved: (imgDataUrl: string) => void;
  onCustomBookUploaded: (uploadedBook: Book) => void;
  onCloseDrawing?: () => void;
  selectedColor?: string;
  lineWidth?: number;
  isHighlighter?: boolean;
  books?: Book[];
  academicSubjects?: AcademicSubject[];
  editors?: BookEditor[];
  globalLogo?: string | null;
  imageViewMode?: 'single' | 'two';
  isLessonContentLess?: boolean;
  onBlackboardToggle?: (isOpen: boolean) => void;
  isOnline?: boolean;
}

export default function Workspace({
  selectedBook,
  activeLesson,
  themeMode,
  fontSizeScale,
  isDrawingEnabled,
  onStrokeSaved,
  onCustomBookUploaded,
  onCloseDrawing,
  selectedColor,
  lineWidth,
  isHighlighter,
  books,
  academicSubjects,
  editors,
  globalLogo,
  imageViewMode,
  isLessonContentLess,
  onBlackboardToggle,
  isOnline,
}: WorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: activeLesson?.pages?.length ?? 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 1200,
    overscan: 2,
  });

  useEffect(() => {
    if (!activeLesson?.id) return;
    const timer = setTimeout(() => {
      try {
        const pages = document.querySelectorAll('#seamless-pdf-stack > div[id^="pdf-page-"]');
        const data = Array.from(pages).map((p) => {
          return {
            page: p.id,
            height: Math.round(p.getBoundingClientRect().height),
            nodes: p.querySelectorAll('*').length,
            images: p.querySelectorAll('img').length,
            katex: p.querySelectorAll('.katex').length
          };
        });
        fetch('http://localhost:3005/report', { 
          method: 'POST', 
          body: JSON.stringify(data)
        }).catch(() => {});
      } catch (e) {}
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeLesson?.id]);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  /**
   * Pre-sanitize ALL page content strings for the active lesson.
   * Keyed on activeLesson.id so this only re-runs DOMParser when the lesson
   * actually changes, NOT on every incidental re-render (theme change, etc.).
   * The _cleanContent property is used by the render below instead of raw .content.
   */
  const sanitizedPages = useMemo(() => {
    if (!activeLesson?.pages) return [];
    return activeLesson.pages.map(page => ({
      ...page,
      // 1. Strip TinyMCE dark-editor inline colour styles first
      // 2. Pre-render LaTeX to KaTeX HTML
      _cleanContent: renderMathInRawHtml(stripInlineStyles((page as any).content ?? ''))
    }));
  }, [activeLesson?.id, activeLesson?.pages]); // eslint-disable-line react-hooks/exhaustive-deps



  // Text-only annotation speech bubble
  const [activeAnnotation, setActiveAnnotation] = useState<{
    text: string;
    mediaType: string;
    mediaUrl: string;
    rect: DOMRect;
    fontSize: string;
  } | null>(null);
  const annotationBubbleRef = useRef<HTMLDivElement>(null);

  // Greenboard panel state — controlled here so annotation clicks can open it
  const [boardOpen, setBoardOpen]       = useState(false);
  const [boardMode, setBoardMode]       = useState<'draw' | 'media'>('draw');

  // Image Frame state for fullscreen annotations
  const [imageFrameSrc, setImageFrameSrc] = useState<string | null>(null);
  const [boardMediaUrl, setBoardMediaUrl]   = useState<string | undefined>(undefined);
  const [boardMediaType, setBoardMediaType] = useState<'image' | 'video' | undefined>(undefined);
  const [boardMediaText, setBoardMediaText] = useState<string | undefined>(undefined);

  /** Open board in media mode and notify parent to hide FloatingButton */
  const openBoardMedia = (url: string, type: 'image' | 'video', text: string) => {
    setBoardMediaUrl(url);
    setBoardMediaType(type);
    setBoardMediaText(text);
    setBoardMode('media');
    setBoardOpen(true);
    onBlackboardToggle?.(true);
  };

  /** Strip toggled by student — only works in draw mode */
  const handleBoardStripClick = () => {
    if (boardOpen) {
      setBoardOpen(false);
      setBoardMode('draw');
      setBoardMediaUrl(undefined);
      setBoardMediaType(undefined);
      setBoardMediaText(undefined);
      onBlackboardToggle?.(false);
    } else {
      setBoardMode('draw');
      setBoardOpen(true);
      onBlackboardToggle?.(true);
    }
  };

  /** Close button pressed — always closes entirely */
  const handleBoardClose = () => {
    setBoardOpen(false);
    setBoardMode('draw');
    setBoardMediaUrl(undefined);
    setBoardMediaType(undefined);
    setBoardMediaText(undefined);
    onBlackboardToggle?.(false);
  };



  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const annotationSpan = target.closest('.lesson-annotation');
    if (annotationSpan) {
      const text = decodeURIComponent(annotationSpan.getAttribute('data-annotation-text') || '');
      const mediaType = annotationSpan.getAttribute('data-annotation-media-type') || 'none';
      let mediaUrl = annotationSpan.getAttribute('data-annotation-media-url') || '';

      // Fix YouTube URLs for iframe embedding
      if (mediaUrl.includes('youtube.com/watch?v=')) {
        mediaUrl = mediaUrl.replace('watch?v=', 'embed/');
        const ampersandIndex = mediaUrl.indexOf('&');
        if (ampersandIndex !== -1) mediaUrl = mediaUrl.substring(0, ampersandIndex);
      } else if (mediaUrl.includes('youtu.be/')) {
        mediaUrl = mediaUrl.replace('youtu.be/', 'youtube.com/embed/');
        const queryIndex = mediaUrl.indexOf('?');
        if (queryIndex !== -1) mediaUrl = mediaUrl.substring(0, queryIndex);
      }

      if (mediaType === 'image-frame' && mediaUrl) {
        // ── Fullscreen Image Frame ──────────
        setActiveAnnotation(null);
        setImageFrameSrc(mediaUrl);
      } else if ((mediaType === 'image' || mediaType === 'video') && mediaUrl) {
        // ── Media annotation → open greenboard in media mode ──────────
        setActiveAnnotation(null);   // close any open speech bubble
        openBoardMedia(mediaUrl, mediaType as 'image' | 'video', text);
      } else {
        // ── Text-only annotation → speech bubble as before ────────────
        const rect = annotationSpan.getBoundingClientRect();
        const fontSize = window.getComputedStyle(annotationSpan).fontSize || '16px';
        setActiveAnnotation({ text, mediaType, mediaUrl, rect, fontSize });
      }
    } else {
      setActiveAnnotation(null);
    }
  };

  // Styling maps representing Accessible colors for bright classrooms
  const themeStyles = {
    parchment: {
      bg: 'bg-[#faf7f2]',
      paperBg: 'bg-[#faf7f2]',
      color: 'text-[#2a1f0e]',
      border: 'border-amber-950/10',
      titleColor: 'text-[#1a1208]',
      subtitleColor: 'text-amber-700',
      calloutBg: 'bg-[#f5f0e8] border-amber-500/40',
      blockquoteBorder: 'border-l-3 border-[#c8860a]',
      blockquoteColor: 'text-stone-700',
    },
    dark: {
      bg: 'bg-stone-950',
      paperBg: 'bg-stone-900',
      color: 'text-[#ece5d5]',
      border: 'border-stone-800',
      titleColor: 'text-[#e8a820]',
      subtitleColor: 'text-amber-400',
      calloutBg: 'bg-stone-950/60 border-amber-500/20',
      blockquoteBorder: 'border-l-3 border-[#e8a820]',
      blockquoteColor: 'text-amber-200/80',
    },
    'high-contrast-blue': {
      bg: 'bg-[#000e29]',
      paperBg: 'bg-[#001742]',
      color: 'text-[#fbbf24]',
      border: 'border-yellow-500/30',
      titleColor: 'text-white',
      subtitleColor: 'text-yellow-300',
      calloutBg: 'bg-[#001c52] border-yellow-400/40',
      blockquoteBorder: 'border-l-3 border-yellow-400',
      blockquoteColor: 'text-white/90',
    },
    'high-contrast-green': {
      bg: 'bg-[#021f15]',
      paperBg: 'bg-[#002e1c]',
      color: 'text-yellow-300',
      border: 'border-emerald-500/30',
      titleColor: 'text-white',
      subtitleColor: 'text-yellow-200',
      calloutBg: 'bg-[#02281a] border-[#c8860a]/40',
      blockquoteBorder: 'border-l-3 border-yellow-400',
      blockquoteColor: 'text-neutral-100/90',
    },
    mono: {
      bg: 'bg-white',
      paperBg: 'bg-white',
      color: 'text-black',
      border: 'border-black/20',
      titleColor: 'text-black font-extrabold',
      subtitleColor: 'text-black/80 font-bold',
      calloutBg: 'bg-neutral-100 border-black',
      blockquoteBorder: 'border-l-3 border-black',
      blockquoteColor: 'text-black/80',
    },
  }[themeMode];

  // Drag and drop processing simulated loading
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const processUploadedDocument = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      // Mock converting uploaded file (pdf, txt, md) to a Lesson inside a Book
      const contentText = event.target?.result as string || '';
      
      const newBook: Book = {
        id: Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        author: "Uploaded Smartboard Document",
        color: "#c8860a",
        lessons: [
          {
            id: `upload-${Date.now()}`,
            title: "Continuous Extracted Document Content",
            subtitle: "Parsed local device source for lecture",
            pages: [
              {
                pageNumber: 1,
                content: `
                  <p>Congratulations. This local document has been uploaded and structured safely into our offline smartboard repository.</p>
                  <div class="callout">
                    <strong>Integrity Guard:</strong> Cached file offline in local buffer schema. Scribble tools and high-contrast toggles are fully enabled on this document.
                  </div>
                  <p>${contentText.replace(/\n\n/g, '</p><p>').substring(0, 1500) || 'Continuous text layout extracted from PDF stream...'}</p>
                `,
                figure: {
                  caption: "Figure: Contextual graphic generated from local file reading stream.",
                  svgType: "fairness"
                }
              },
              {
                pageNumber: 2,
                content: `
                  <h2>Annotated Attachment Pages</h2>
                  <p>${contentText.replace(/\n\n/g, '</p><p>').substring(1500, 3000) || 'Continuous pages scroll seamlessly without breaks, optimized for vertical scrolling...'}</p>
                  <blockquote>"Education is the kindling of a flame, not the filling of a vessel." — Socrates</blockquote>
                `
              }
            ],
            flashQuestions: [
              {
                id: "up-q1",
                question: "Is this document accessible in full offline mode?",
                answer: "Yes, it is entirely preserved in client-side state buffers.",
                difficulty: "Easy"
              }
            ]
          }
        ]
      };

      onCustomBookUploaded(newBook);
      setUploadFeedback(`Successfully extracted '${file.name}' into smartboard reader!`);
      setTimeout(() => setUploadFeedback(null), 5000);
    };

    if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      // Simulate binary loading for pdf
      reader.readAsText(new Blob(["Parsed raw binary PDF. Classroom reading loaded cleanly."]));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedDocument(e.dataTransfer.files[0]);
    }
  };

  const handleFileClickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedDocument(e.target.files[0]);
    }
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden relative ${themeStyles.bg}`} id="main">
      {/* Absolute watermark for drawing focus status */}
      {isDrawingEnabled && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white font-mono text-[9px] font-bold py-1 px-3.5 rounded-full shadow-md z-30 tracking-widest uppercase flex items-center gap-1.5 animate-pulse" id="draw-mode-pill">
          <span>● Stylus Active</span>
        </div>
      )}

      {activeLesson ? (
        <>
          <input
            ref={fileInputRef}
            id="hidden-file-upload-input"
            type="file"
            accept=".pdf,.txt,.md,.docx"
            onChange={handleFileClickChange}
            className="hidden"
          />

          {/* ── Greenboard panel — controlled from Workspace ── */}
          <BlackboardPanel
            lessonId={activeLesson.id}
            isOpen={boardOpen}
            mode={boardMode}
            mediaUrl={boardMediaUrl}
            mediaType={boardMediaType}
            mediaText={boardMediaText}
            onStripClick={handleBoardStripClick}
            onClose={handleBoardClose}
            isOnline={isOnline}
          />

            {/* ── PAGE MODE: render lesson pages as before ── */}
            <div
              id="content-scroll"
              ref={scrollParentRef}
              className="flex-1 overflow-y-auto relative outline-none select-text pb-20 cursor-text content-container-root"
              style={{
                marginRight: 'max(3%, 28px)', // Always keep strip space only, allowing expanded board to overlay
              }}
            >
              <div
                className={`w-full flex flex-col items-stretch px-[2%] ${themeStyles.paperBg} ${themeStyles.color} rounded-xl relative`}
                style={{ fontSize: `${fontSizeScale}rem`, height: `${rowVirtualizer.getTotalSize()}px` }}
                id="seamless-pdf-stack"
              >
                <ScribbleOverlay
                  lessonId={activeLesson.id}
                  isDrawingMode={isDrawingEnabled}
                  onStrokeSaved={onStrokeSaved}
                  onCloseDrawing={onCloseDrawing}
                  selectedColor={selectedColor}
                  lineWidth={lineWidth}
                  isHighlighter={isHighlighter}
                />
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const page = sanitizedPages[virtualRow.index];
                  if (!page) return null;
                  return (
                  <VirtualPageWrapper
                    key={page.id || virtualRow.index}
                    virtualRow={virtualRow}
                    measureElement={rowVirtualizer.measureElement}
                    pageContentHash={page._cleanContent}
                  >
                  <div
                    id={`pdf-page-${page.pageNumber}`}
                    className="relative px-[2%] py-6"
                  >
                    <div className="absolute right-6 top-3 text-[9px] font-mono opacity-50 select-none uppercase tracking-wider">
                      {page.pageNumber}
                    </div>

                    {isLessonContentLess ? (
                      imageViewMode === 'two' ? (
                        <div className="flex flex-row w-full gap-6 mt-4">
                          {((page as any).leftImage || (page as any).rightImage) && (
                            <div className="w-full lg:w-[30%] flex-shrink-0">
                              {(page as any).leftImage && (
                                <CachedImage 
                                  src={(page as any).leftImage} 
                                  alt="Left Column Graphic Illustration" 
                                  className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                                />
                              )}
                            </div>
                          )}
                          {((page as any).leftImage || (page as any).rightImage) && (
                            <div className="w-1/2 flex-shrink-0">
                              {(page as any).rightImage && (
                                <CachedImage 
                                  src={(page as any).rightImage} 
                                  alt="Right Column Graphic Illustration" 
                                  className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col w-full gap-6 mt-4 items-center">
                          {(page as any).leftImage && (
                            <div className="w-full">
                              <CachedImage 
                                src={(page as any).leftImage} 
                                alt="Left Top Graphic Illustration" 
                                className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                              />
                            </div>
                          )}
                          {(page as any).rightImage && (
                            <div className="w-full">
                              <CachedImage 
                                src={(page as any).rightImage} 
                                alt="Right Top Graphic Illustration" 
                                className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                              />
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col lg:flex-row gap-6 items-start w-full mt-4">
                        {(page as any).leftImage && (
                          <div className="w-full lg:w-[30%] flex-shrink-0">
                            <CachedImage 
                              src={(page as any).leftImage} 
                              alt="Left Column Graphic Illustration" 
                              className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          {(page as any).centerImage && (
                            <div className="w-full mb-6">
                              <img 
                                src={(page as any).centerImage} 
                                alt="Central Block Illustration" 
                                className="w-full h-auto rounded-xl shadow-lg shadow-black/5" 
                                referrerPolicy="no-referrer" 
                              />
                            </div>
                          )}
                          {/* Sanitize page content before injecting — strips TinyMCE dark-editor
                              inline color styles that appear invisible on light student themes */}
                          <div
                            className="font-serif leading-loose space-y-6 text-[16px] lg:text-[17px] min-[3840px]:text-[34px] min-[3840px]:leading-loose tracking-wide reader-content relative"
                            id={`page-paragraph-content-${page.pageNumber}`}
                            dangerouslySetInnerHTML={{ __html: page._cleanContent ?? page.content }}
                            onClick={handleContentClick}
                          />
                        </div>

                        {(page as any).rightImage && (
                          <div className="w-full lg:w-[30%] flex-shrink-0">
                            <CachedImage 
                              src={(page as any).rightImage} 
                              alt="Right Column Graphic Illustration" 
                              className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {page.equations && page.equations.length > 0 && (
                      <div
                        className="my-5 p-1 px-4 bg-slate-900/10 dark:bg-slate-100/10 rounded-lg border border-current text-center select-text space-y-1 py-3 overflow-x-auto"
                        id={`page-equations-${page.pageNumber}`}
                      >
                        {page.equations.map((eq, qIdx) => (
                          <div key={qIdx} className="my-2 flex justify-center">
                            <BlockMath math={eq} />
                          </div>
                        ))}
                      </div>
                    )}

                    {page.figure && (
                      <div className="my-6 text-center select-none" id={`page-figure-wrapper-${page.pageNumber}`}>
                        <DynamicFigure type={page.figure.svgType} />
                        <div className="text-[11.5px] italic font-serif opacity-75 mt-2 max-w-sm mx-auto">
                          {page.figure.caption}
                        </div>
                      </div>
                    )}
                  </div>
                  </VirtualPageWrapper>
                  );
                })}
              </div>
            </div>
        </>
      ) : (
        /* Empty Welcome state with quick instructions and mock folder loading drag zone */
        <div
          id="empty-state"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${
            isDraggingFile ? 'bg-amber-400/10 border-2 border-dashed border-amber-400' : 'bg-transparent'
          }`}
        >
          <div className="text-center max-w-md space-y-5">
            {globalLogo ? (
              <div className="w-20 h-20 mx-auto bg-white/10 rounded-lg flex items-center justify-center border border-slate-700/80 mb-2 p-2">
                <CachedImage src={globalLogo} alt="Global Logo" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-800/40 border border-slate-700/80 flex items-center justify-center text-amber-400 text-3xl animate-bounce-short mb-2">
                📖
              </div>
            )}
            
            <h2 className="font-sans text-2xl font-extrabold text-slate-100 uppercase tracking-tight" id="empty-text">
              Extrapadhai Smartboard Handout Workspace
            </h2>
            
            <p className="font-sans text-slate-400 leading-relaxed text-sm">
              Select any school curriculum, book or handout document from the slider above to read continuous seamless sheets on this smartboard workspace.
            </p>

            {/* Visual Drag and drop folder section */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 py-8 flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all ${
                isDraggingFile ? 'border-amber-400 bg-amber-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-amber-400 opacity-90" />
              <span className="font-sans text-[10px] uppercase font-bold tracking-wider text-amber-400">Drag & Drop Handouts Here</span>
              <span className="text-[9px] text-slate-500 font-mono">Accepts PDF, TXT, MD text, or notes files</span>
            </div>

            {uploadFeedback && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 animate-pulse">
                <Check className="w-4 h-4" />
                <span>{uploadFeedback}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANNOTATION UI: Speech Bubble (Popover) — always landscape rectangle */}
      {activeAnnotation && activeAnnotation.mediaType === 'none' && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent cursor-pointer" onClick={() => setActiveAnnotation(null)} />
          <div 
            ref={annotationBubbleRef}
            className="fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-5 transition-opacity duration-200"
            style={{
              /* Always landscape: min-width much wider than max-height allows it to grow tall */
              minWidth: 'min(560px, 90vw)',
              maxWidth: 'min(720px, 92vw)',
              maxHeight: '38vh',
              top: Math.max(10, activeAnnotation.rect.bottom + 10),
              /* Re-centre based on the wider 560px bubble */
              left: Math.max(10, Math.min(window.innerWidth - Math.min(560, window.innerWidth * 0.9) - 10,
                activeAnnotation.rect.left + activeAnnotation.rect.width / 2 - Math.min(560, window.innerWidth * 0.9) / 2))
            }}
          >
            {/* Tail arrow */}
            <div className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"></div>
            {/* Scrollable text area — ensures bubble never grows taller than 38vh */}
            <div 
              className="relative text-slate-200 font-serif leading-loose overflow-y-auto"
              style={{ fontSize: activeAnnotation.fontSize, maxHeight: 'calc(38vh - 40px)' }}
              dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(activeAnnotation.text) }}
            />
          </div>
        </>
      )}

      {/* Fullscreen Image Frame for Annotations */}
      <ImageFrame 
        isOpen={!!imageFrameSrc}
        onClose={() => setImageFrameSrc(null)}
        src={imageFrameSrc || ''}
        alt="Annotation Media"
      />
    </div>
  );
}

