/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Book, Lesson, Topic, ThemeMode, AcademicSubject, BookEditor, InteractiveImageDef } from '../types';
import DynamicFigure from './DynamicFigure';
import ScribbleOverlay from './ScribbleOverlay';
import BlackboardPanel from './BlackboardPanel';
import { Plus, Info, Check, Upload, BookOpen, AlertCircle, FileText, X, ChevronDown, Video, HelpCircle, Maximize2, Minimize2, Tv, Film, Play, ChevronRight, Columns, Filter, CheckCircle2 } from 'lucide-react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { BlockMath } from 'react-katex';
import ImageFrame from './ImageFrame';
import CachedImage from './CachedImage';
import { getLocalImageSrc } from '../lib/imageCache';
import { renderMathInRawHtml } from '../lib/mathPreprocessor';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import { hasTextContent, getEffectiveTopicInquiryQuestions, getEffectiveTopicFlashQuestions, getEffectiveTopicVideos } from '../lib/contentUtils';
import PdfPageViewer from './PdfPageViewer';
import { getChapterContentType } from '../lib/chapterContent';
import { getChapterVideoUrls, getPdfChapterQuestions } from '../lib/chapterMedia';
import HtmlPageFrame from './HtmlPageFrame';



/**
 * Strips inline CSS properties that TinyMCE's dark editor bakes into saved HTML.
 * The dark editor (background:#03060c, color:#e2e8f0) stores near-white inline
 * color styles that become invisible on light student themes (parchment, mono).
 *
 * This runs on the HTML STRING before React ever sets dangerouslySetInnerHTML,
 * so the virtual DOM and real DOM are both clean from the start — no CSS
 * specificity fight, no post-render DOM manipulation timing window.
 */
// Helper to generate consistent YouTube-style metadata (views, date, duration)
const getYouTubeStyleMeta = (id: string, partNumber: number = 1, customDuration?: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  const h = Math.abs(hash);

  const viewsList = ['9.7M views', '2.4M views', '1.1M views', '840K views', '320K views', '180K views', '85K views', '42K views'];
  const datesList = ['5 days ago', '2 weeks ago', '1 month ago', '3 months ago', '6 months ago', '1 year ago'];

  let duration = customDuration;
  if (!duration || !duration.includes(':')) {
    const mins = 8 + (h % 22);
    const secs = (h % 60).toString().padStart(2, '0');
    duration = `${mins}:${secs}`;
  }

  return {
    views: viewsList[(h + partNumber) % viewsList.length],
    date: datesList[((h >> 2) + partNumber) % datesList.length],
    duration
  };
};

function renderTopicVideo(url: string, title: string) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  const isDirectVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('/videos%2F') || url.includes('/videos/');

  if (ytMatch && ytMatch[1]) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
        title={`Video lecture: ${title}`}
        className="w-full h-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (isDirectVideo) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
      />
    );
  }

  return (
    <iframe
      src={url}
      title={`Video lecture: ${title}`}
      className="w-full h-full"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

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
  /** Called when a container's Focus button is switched on/off (App hides the chapter list while focused) */
  onFocusChange?: (focused: boolean) => void;
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
  onAutoBookmark?: (bookId: number, lessonId: string, pageNumber: number) => void;
  initialTargetPage?: number | null;
  onOpenTopicModal?: (topic: Topic, panel: 'video' | 'questions' | 'notes') => void;
  /** Opens the chapter's lecture videos ('video') or, for PDF chapters, its "Some Extra Questions" ('notes') */
  onOpenChapterPanel?: (panel: 'video' | 'notes') => void;
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
  onAutoBookmark,
  initialTargetPage,
  onOpenTopicModal,
  onOpenChapterPanel,
  onFocusChange,
}: WorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: activeLesson?.pages?.length ?? 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 1200,
    overscan: 2,
  });



  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const togglePageExpand = (pageKey: string | number) => {
    const k = String(pageKey);
    setExpandedPages(prev => ({
      ...prev,
      [k]: !prev[k]
    }));
  };

  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>({});
  const [selectedTopicVideoParts, setSelectedTopicVideoParts] = useState<Record<string, number>>({});
  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopicIds(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  // ── Video Library States ──
  const [videoMetaMap, setVideoMetaMap] = useState<Record<string, { title?: string; author?: string; thumbnail?: string }>>({});
  const [fullscreenPanel, setFullscreenPanel] = useState<'none' | 'video' | 'topics'>('none');

  const videoPanelScrollRef = useRef<HTMLDivElement>(null);

  // Reset fullscreen container mode when switching chapters
  useEffect(() => {
    setFullscreenPanel('none');
  }, [activeLesson?.id]);

  const isVideoFullscreen = fullscreenPanel === 'video';
  const isTopicsFullscreen = fullscreenPanel === 'topics';
  useEffect(() => { onFocusChange?.(fullscreenPanel !== 'none'); }, [fullscreenPanel, onFocusChange]);

  // Check if current lesson/book is a PDF textbook (PDF books appear without the split-screen video library)
  const isPdfBook = Boolean(
    selectedBook?.bookType === 'pdf' ||
    getChapterContentType(activeLesson) === 'pdf' ||
    (activeLesson?.pdfUrl && activeLesson.pdfUrl.trim().length > 0)
  );

  // Extract chapter lecture videos only (only videos connected to chapter appear in left panel)
  const chapterVideos = useMemo(() => {
    if (!activeLesson) return [];

    const items: Array<{
      id: string;
      url: string;
      title: string;
      partNumber: number;
      totalParts: number;
      youtubeId?: string;
      isDirectVideo: boolean;
      fileName?: string;
      duration: string;
      views: string;
      uploadDate: string;
      channel: string;
    }> = [];

    const chapterUrls = getChapterVideoUrls(activeLesson);
    chapterUrls.forEach((url, idx) => {
      const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      const ytId = ytMatch ? ytMatch[1] : undefined;
      const isDirect = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('/videos%2F') || url.includes('/videos/');
      let fileName = '';
      try {
        const decoded = decodeURIComponent(url);
        const m = decoded.match(/([^\/?#]+)\.(mp4|webm|ogg|mov)/i);
        if (m) fileName = m[1].replace(/^\d+[-_]/, '').replace(/[-_]/g, ' ');
      } catch {}

      const meta = getYouTubeStyleMeta(`chap-${activeLesson.id}-${idx}`, idx + 1);

      items.push({
        id: `chap-vid-${idx}`,
        url,
        title: activeLesson.title,
        partNumber: idx + 1,
        totalParts: chapterUrls.length,
        youtubeId: ytId,
        isDirectVideo: isDirect,
        fileName,
        channel: 'Chapter Lecture',
        duration: meta.duration,
        views: meta.views,
        uploadDate: meta.date
      });
    });

    return items;
  }, [activeLesson]);
  const hasVideoColumn = chapterVideos.length > 0;

  // Fetch online YouTube metadata (real titles, authors, thumbnails)
  useEffect(() => {
    if (!isOnline || chapterVideos.length === 0) return;
    chapterVideos.forEach(vid => {
      if (vid.youtubeId && !videoMetaMap[vid.youtubeId]) {
        fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vid.youtubeId}`)
          .then(res => res.json())
          .then(data => {
            if (data && (data.title || data.author_name)) {
              setVideoMetaMap(prev => ({
                ...prev,
                [vid.youtubeId!]: {
                  title: data.title,
                  author: data.author_name,
                  thumbnail: data.thumbnail_url
                }
              }));
            }
          })
          .catch(() => {});
      }
    });
  }, [chapterVideos, isOnline, videoMetaMap]);

  const handleToggleExpandAllTopics = () => {
    if (!activeLesson?.topics) return;
    const anyClosed = activeLesson.topics.some(t => !expandedTopicIds[t.id]);
    const newMap: Record<string, boolean> = {};
    activeLesson.topics.forEach(t => {
      newMap[t.id] = anyClosed;
    });
    setExpandedTopicIds(newMap);
  };

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

  // Auto-scroll to initial bookmark target page on lesson open
  useEffect(() => {
    if (initialTargetPage && initialTargetPage > 0 && activeLesson && sanitizedPages.length > 0) {
      const pageIdx = sanitizedPages.findIndex(p => p.pageNumber === initialTargetPage);
      if (pageIdx !== -1) {
        const timer = setTimeout(() => {
          rowVirtualizer.scrollToIndex(pageIdx, { align: 'start' });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [activeLesson?.id, initialTargetPage, sanitizedPages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll tracking to determine exact visible page for bookmarking
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const el = scrollParentRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollOffset(el.scrollTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollParentRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5-second page dwell timer for auto-bookmarking
  const visibleVirtualItems = rowVirtualizer.getVirtualItems();
  const currentVisiblePageNumber = useMemo(() => {
    const el = scrollParentRef.current;
    if (visibleVirtualItems.length === 0) return 1;

    const scrollTop = el ? el.scrollTop : scrollOffset;
    const viewportTarget = scrollTop + (el ? el.clientHeight * 0.35 : 250);

    // Find the virtual item that covers the viewport (excluding overscanned items)
    const activeItem = visibleVirtualItems.find(item => item.start <= viewportTarget && item.end > scrollTop)
      || visibleVirtualItems.find(item => item.end >= scrollTop)
      || visibleVirtualItems[0];

    const page = sanitizedPages[activeItem.index];
    return page?.pageNumber ?? (activeItem.index + 1);
  }, [scrollOffset, visibleVirtualItems, sanitizedPages]);

  useEffect(() => {
    if (!selectedBook || !activeLesson || !onAutoBookmark) return;

    const timer = setTimeout(() => {
      onAutoBookmark(selectedBook.id, activeLesson.id, currentVisiblePageNumber);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedBook?.id, activeLesson?.id, currentVisiblePageNumber, onAutoBookmark]); // eslint-disable-line react-hooks/exhaustive-deps



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
  const [imageFrameDef, setImageFrameDef] = useState<InteractiveImageDef | undefined>(undefined);
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

      if (mediaType === 'interactive-image') {
        if (!mediaUrl) {
          alert('Debugging: This annotation was saved without selecting a map from the dropdown. Please edit the tag and select a map.');
          return;
        }
        // Here mediaUrl stores the interactive map ID
        const mapDef = activeLesson.interactiveImages?.find(m => m.id === mediaUrl);
        if (mapDef) {
          setActiveAnnotation(null);
          setImageFrameSrc(mapDef.rootImage);
          setImageFrameDef(mapDef);
        } else {
          console.warn(`Interactive map ${mediaUrl} not found in this lesson.`);
          alert(`Debugging: The tagged map (ID: ${mediaUrl}) could not be found in the current lesson's data. Are you sure you saved the map sequence before tagging?`);
        }
      } else if ((mediaType === 'image-frame' || mediaType === 'image') && mediaUrl) {
        // ── Fullscreen Image Frame / Lightbox ──────────
        setActiveAnnotation(null);
        setImageFrameSrc(mediaUrl);
        setImageFrameDef(undefined);
      } else if (mediaType === 'video' && mediaUrl) {
        // ── Video annotation → open greenboard in media mode ──────────
        setActiveAnnotation(null);   // close any open speech bubble
        openBoardMedia(mediaUrl, 'video', text);
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
            chapterVideoCount={getChapterVideoUrls(activeLesson).length}
            onOpenChapterVideos={onOpenChapterPanel ? () => onOpenChapterPanel('video') : undefined}
            chapterQuestionCount={getChapterContentType(activeLesson) === 'pdf' ? getPdfChapterQuestions(activeLesson).length : undefined}
            onOpenChapterQuestions={onOpenChapterPanel && getChapterContentType(activeLesson) === 'pdf' ? () => onOpenChapterPanel('notes') : undefined}
          />

          {isPdfBook ? (
            /* ── FULL-WIDTH PDF BOOK READER (Bypasses split-screen video library) ── */
            <div
              id="content-scroll"
              ref={scrollParentRef}
              className="flex-1 overflow-y-auto relative outline-none select-text pb-20 pt-[84px] cursor-text content-container-root w-full h-full bg-[#12241e]"
              style={{
                marginRight: 'max(3%, 28px)', // Reserve space for greenboard closed strip
              }}
            >
              <div
                className={`w-full flex flex-col items-stretch px-[2%] ${themeStyles.paperBg} ${themeStyles.color} rounded-xl relative`}
                style={{ fontSize: `${fontSizeScale}rem`, height: 'auto' }}
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
                <PdfPageViewer
                  pdfUrl={activeLesson?.pdfUrl || ''}
                  imageViewMode={imageViewMode}
                  themeMode={themeMode}
                  fontSizeScale={fontSizeScale}
                />
              </div>
            </div>
          ) : (
            /* ── 45:55 Split-Screen Learning Dashboard (Non-PDF Chapters) ── */
            <div
              className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden relative w-full"
              id="split-learning-body"
              style={{
                marginRight: 'max(3%, 28px)', // Reserve space for greenboard closed strip
              }}
            >
              {/* ── LEFT PANEL: Video Library (Dark Blue Background, Expandable to Full Width) ── */}
              <div
                ref={videoPanelScrollRef}
                id="video-library-scroll"
                className={`${hasVideoColumn && !isTopicsFullscreen ? (isVideoFullscreen ? 'w-full' : 'w-full lg:w-[35%]') : 'hidden'} h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#2c4a3f_transparent] flex flex-col bg-[#0f1f1a] border-b lg:border-b-0 lg:border-r border-white/[0.06] px-4 pb-6 pt-[84px] space-y-4 select-text transition-all duration-300`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 pb-1 select-none shrink-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9fb8ab]">
                    <Film className="w-3.5 h-3.5 text-[#d4b06a]" />
                    <span>Chapter Videos ({chapterVideos.length})</span>
                  </div>
                  <button
                      onClick={() => setFullscreenPanel(prev => prev === 'video' ? 'none' : 'video')}
                      className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold border transition-all cursor-pointer ${fullscreenPanel === 'video' ? 'bg-[#d4b06a] text-[#0f1f1a] border-[#d4b06a]' : 'text-[#dbe8e1] bg-white/[0.06] hover:bg-white/[0.12] border-white/10'}`}
                      title={fullscreenPanel === 'video' ? 'Exit focus' : 'Focus on this container'}
                    >
                      {fullscreenPanel === 'video' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      {fullscreenPanel === 'video' ? 'Exit focus' : 'Focus'}
                    </button>
                </div>

                {/* Video Library Listing: Video player embedded directly in each card where it is displayed */}
                {chapterVideos.length > 0 ? (
                  <div className={`grid ${isVideoFullscreen ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'} gap-4 pb-8`}>
                    {chapterVideos.map((vid) => {
                      const onlineMeta = vid.youtubeId ? videoMetaMap[vid.youtubeId] : undefined;
                      const videoTitle = onlineMeta?.title || vid.title;
                      const channelName = onlineMeta?.author || vid.channel;

                      return (
                        <div
                          key={vid.id}
                          className="flex flex-col rounded-2xl p-3 bg-[#162b23] border border-white/[0.07] hover:border-[#d4b06a]/40 shadow-lg space-y-2.5 transition-all"
                        >
                          {/* 16:9 Video Player embedded directly where it is displayed */}
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
                            {renderTopicVideo(vid.url, videoTitle)}
                          </div>

                          {/* Video Title & Metadata */}
                          <div className="px-0.5">
                            <h4 className="text-xs sm:text-[13px] font-semibold text-slate-100 line-clamp-2 leading-snug">
                              {videoTitle}
                            </h4>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9fb8ab] font-sans truncate">
                              <span className="truncate max-w-[140px] font-medium text-[#dbe8e1]">{channelName}</span>
                              <span>•</span>
                              <span>{vid.views}</span>
                              <span>•</span>
                              <span>{vid.uploadDate}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-[#0d1e38]/60 border border-dashed border-blue-900/60 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
                    <Film className="w-10 h-10 text-blue-400 animate-pulse" />
                    <p className="text-xs text-blue-200/70 font-mono">No chapter lecture videos attached to this chapter.</p>
                  </div>
                )}
              </div>

              {/* ── RIGHT PANEL: Expandable Chapter Topics (Light Blue Background, Expandable to Full Width) ── */}
              <div
                id="chapter-topics-panel"
                className={`${isVideoFullscreen ? 'hidden' : (hasVideoColumn && !isTopicsFullscreen ? 'w-full lg:w-[65%]' : 'w-full')} h-full overflow-hidden flex flex-col bg-[#dfece4] select-text transition-all duration-300`}
              >
                <div
                  id="content-scroll"
                  ref={scrollParentRef}
                  className="flex-1 overflow-y-auto relative outline-none select-text pb-20 pt-[84px] px-3 sm:px-5 cursor-text content-container-root [scrollbar-width:thin] [scrollbar-color:#9fbfae_transparent]"
                >
                  {/* Topic Header: title, Expand all, Focus */}
                  <div className="w-full pt-1 pb-3 flex items-center justify-between select-none font-sans shrink-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3d6354]">
                      <BookOpen className="w-3.5 h-3.5 text-[#9a7a2e]" />
                      <span>{activeLesson.topics && activeLesson.topics.length > 0 ? `Topics (${activeLesson.topics.length})` : 'Lesson'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeLesson.topics && activeLesson.topics.length > 0 && (
                      <button
                        onClick={handleToggleExpandAllTopics}
                        className="h-7 text-[11px] font-semibold text-[#12302a] px-3 rounded-full bg-white/70 hover:bg-white border border-[#0f1f1a]/10 cursor-pointer transition-all"
                      >
                        {activeLesson.topics.some(t => !expandedTopicIds[t.id]) ? 'Expand all' : 'Collapse all'}
                      </button>
                      )}
                      <button
                      onClick={() => setFullscreenPanel(prev => prev === 'topics' ? 'none' : 'topics')}
                      className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 text-[11px] font-semibold border transition-all cursor-pointer ${fullscreenPanel === 'topics' ? 'bg-[#d4b06a] text-[#0f1f1a] border-[#d4b06a]' : 'text-[#12302a] bg-white/70 hover:bg-white border-[#0f1f1a]/10'}`}
                      title={fullscreenPanel === 'topics' ? 'Exit focus' : 'Focus on this container'}
                    >
                      {fullscreenPanel === 'topics' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      {fullscreenPanel === 'topics' ? 'Exit focus' : 'Focus'}
                    </button>
                    </div>
                  </div>

              {/* TOPIC CONTAINERS — 95% Width Single Row Layout per Topic with Vibrant Distinct Themes */}
              {activeLesson.topics && activeLesson.topics.length > 0 && (
                <div className="w-full pb-3 space-y-3 z-20 relative font-sans">
                  <div className="flex flex-col gap-3">
                    {activeLesson.topics.map((topic, idx) => {
                      const isExpanded = Boolean(expandedTopicIds[topic.id]);
                      const hasCollapsiblePage = Boolean(topic.pages && topic.pages.some((p: any) => p.isCollapsible));

                      // Distinct vibrant colour per topic: hues spaced by the golden angle (~137.5deg),
                      // so every topic ribbon differs from the others, however many topics there are.
                      const hue = Math.round((idx * 137.508 + 230) % 360);
                      const theme = {
                        ribbonStyle: {
                          background: `linear-gradient(90deg, hsla(${hue}, 45%, 93%, 1) 0%, #f2f8f4 70%)`,
                          borderColor: 'rgba(15,31,26,0.10)',
                          borderLeft: `5px solid hsl(${hue}, 50%, 50%)`,
                        } as React.CSSProperties,
                        titleStyle: { color: '#12302a' } as React.CSSProperties,
                      };

                      const renderTopicActionButtons = () => (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2.5 shrink-0 self-end md:self-auto"
                        >
                          {/* Video Player Icon Only (per-topic videos) */}
                          {(() => {
                            const topicVideos = getEffectiveTopicVideos(topic, activeLesson);
                            const hasVideo = topicVideos.length > 0;
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenTopicModal?.(topic, 'video');
                                }}
                                disabled={!hasVideo}
                                className={`relative w-9 h-9 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                                  hasVideo
                                    ? 'bg-[#163a2e] text-white border border-[#163a2e] hover:bg-[#d4b06a] hover:text-[#0f1f1a] hover:border-[#d4b06a] active:scale-95 shadow-sm'
                                    : 'bg-[#0f1f1a]/[0.04] border border-[#0f1f1a]/[0.08] text-[#0f1f1a]/20 cursor-not-allowed'
                                }`}
                                title={
                                  hasVideo
                                    ? `Play Video Lecture (${topicVideos.length}) for '${topic.title}'`
                                    : 'No video attached to this topic'
                                }
                              >
                                <Video className="w-4.5 h-4.5" />
                              </button>
                            );
                          })()}

                          {/* Flashcard Icon Only (topic copy + chapter questions tagged with this topic) */}
                          {(() => {
                          const topicFlashCount = getEffectiveTopicFlashQuestions(topic, activeLesson).length;
                          return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTopicModal?.(topic, 'questions');
                            }}
                            disabled={topicFlashCount === 0}
                            className={`relative w-9 h-9 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                              topicFlashCount > 0
                                ? 'bg-[#163a2e] text-white border border-[#163a2e] hover:bg-[#d4b06a] hover:text-[#0f1f1a] hover:border-[#d4b06a] active:scale-95 shadow-sm'
                                : 'bg-[#0f1f1a]/[0.04] border border-[#0f1f1a]/[0.08] text-[#0f1f1a]/20 cursor-not-allowed'
                            }`}
                            title={
                              topicFlashCount > 0
                                ? `Open Flashcards (${topicFlashCount})`
                                : 'No flashcards for this topic'
                            }
                          >
                            <HelpCircle className="w-4.5 h-4.5" />
                          </button>
                          );
                          })()}

                          {/* Question Icon Only */}
                          {(() => {
                            const effectiveTopicQuestions = getEffectiveTopicInquiryQuestions(topic, activeLesson);
                            const hasTopicQuestions = effectiveTopicQuestions.length > 0;
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenTopicModal?.(topic, 'notes');
                                }}
                                disabled={!hasTopicQuestions}
                                className={`relative w-9 h-9 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                                  hasTopicQuestions
                                    ? 'bg-[#163a2e] text-white border border-[#163a2e] hover:bg-[#d4b06a] hover:text-[#0f1f1a] hover:border-[#d4b06a] active:scale-95 shadow-sm'
                                    : 'bg-[#0f1f1a]/[0.04] border border-[#0f1f1a]/[0.08] text-[#0f1f1a]/20 cursor-not-allowed'
                                }`}
                                title={
                                  hasTopicQuestions
                                    ? `Open Topic Questions (${effectiveTopicQuestions.length})`
                                    : 'No questions for this topic'
                                }
                              >
                                <FileText className="w-4.5 h-4.5" />
                              </button>
                            );
                          })()}
                        </div>
                      );

                      const renderTopicVideoSection = () => {
                        const topicVideos = getEffectiveTopicVideos(topic, activeLesson);
                        if (topicVideos.length === 0) return null;
                        const currentPart = selectedTopicVideoParts[topic.id] || 0;
                        const activeUrl = topicVideos[currentPart] || topicVideos[0];
                        return (
                          <div className="bg-slate-950/90 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4 text-sky-400" />
                                <span className="text-[11px] font-mono uppercase text-sky-400 font-black tracking-wider">
                                  Topic Video Lecture • {topic.title} {topicVideos.length > 1 ? `(Part ${currentPart + 1} of ${topicVideos.length})` : ''}
                                </span>
                              </div>
                              <button
                                onClick={() => onOpenTopicModal?.(topic, 'video')}
                                className="text-[10px] font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer transition-all hover:scale-105 active:scale-95"
                                title="Open in Video Box (3-column grid)"
                              >
                                <Maximize2 className="w-3.5 h-3.5" /> Video Box {topicVideos.length > 1 ? `(${topicVideos.length} Videos)` : ''}
                              </button>
                            </div>

                            <div className="relative aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-slate-800 bg-black shadow-lg flex items-center justify-center">
                              {renderTopicVideo(activeUrl, topic.title)}
                            </div>

                            {topicVideos.length > 1 && (
                              <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Parts:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {topicVideos.map((_, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setSelectedTopicVideoParts(prev => ({ ...prev, [topic.id]: idx }))}
                                      className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                                        currentPart === idx
                                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-sm'
                                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                                      }`}
                                    >
                                      Part {idx + 1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      };

                      const renderPageContent = (page: any, pIdx: number) => {
                        const hasIframe = Boolean(page.iframeUrl);
                        return (
                          <>
                            {hasIframe ? (
                              <div className="w-full mt-3 flex items-center justify-center">
                                <HtmlPageFrame
                                  url={page.iframeUrl}
                                  title={`Interactive Page ${pIdx + 1} - ${page.summaryContent || topic.title}`}
                                  className="w-full min-h-[75vh] border-0 rounded-2xl shadow-xl bg-white"
                                />
                              </div>
                            ) : (
                              <>
                                {/* Left, Center, and Right Column Graphics */}
                                {(page.leftImage || page.centerImage || page.rightImage) && (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {page.leftImage && (
                                      <div className="border border-slate-800 rounded-xl overflow-hidden p-1.5 bg-black/60 shadow-lg">
                                        <CachedImage src={page.leftImage} alt="Left illustration" className="w-full h-auto object-contain rounded-lg" />
                                      </div>
                                    )}
                                    {page.centerImage && (
                                      <div className="border border-slate-800 rounded-xl overflow-hidden p-1.5 bg-black/60 shadow-lg">
                                        <CachedImage src={page.centerImage} alt="Center illustration" className="w-full h-auto object-contain rounded-lg" />
                                      </div>
                                    )}
                                    {page.rightImage && (
                                      <div className="border border-slate-800 rounded-xl overflow-hidden p-1.5 bg-black/60 shadow-lg">
                                        <CachedImage src={page.rightImage} alt="Right illustration" className="w-full h-auto object-contain rounded-lg" />
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Page HTML markup content with KaTeX support & interactive tag click handler */}
                                {page.content && (
                                  <div
                                    onClick={handleContentClick}
                                    className="reader-content prose max-w-none text-xs sm:text-sm leading-relaxed text-[#1b2b25]"
                                    dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(page.content) }}
                                  />
                                )}
                              </>
                            )}
                          </>
                        );
                      };

                      // When 'Collapsible Page Settings' is ENABLED:
                      // Display ONLY the HTML dropdown (not the topic dropdown).
                      if (hasCollapsiblePage) {
                        return (
                          <div key={topic.id} className="space-y-3">
                            {topic.pages?.map((page, pIdx) => {
                              const topicPageKey = (page as any).id || `topic-${topic.id}-${pIdx}`;
                              const isTopicPageExpanded = Boolean(expandedPages[topicPageKey]);
                              const hasIframe = Boolean((page as any).iframeUrl);

                              return (
                                <div
                                  key={topicPageKey}
                                  style={theme.ribbonStyle}
                                  className="w-full border hover:shadow-md rounded-2xl p-3.5 px-5 shadow-sm transition-all duration-300 flex flex-col"
                                >
                                  {/* HTML Dropdown Header Bar */}
                                  <div
                                    onClick={() => togglePageExpand(topicPageKey)}
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none group"
                                  >
                                    {/* Left Side: Chevron + Summary Title + Interactive HTML Badge */}
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div className="w-7 h-7 rounded-lg bg-white border border-[#0f1f1a]/10 flex items-center justify-center text-[#12302a] group-hover:scale-110 group-hover:border-amber-400 transition-all shrink-0">
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isTopicPageExpanded ? 'rotate-180 text-[#9a7a2e]' : 'text-[#3d6354]'}`} />
                                      </div>
                                      <span style={theme.titleStyle} className="font-serif font-medium text-xs sm:text-sm truncate tracking-tight">
                                        {(page as any).summaryContent || topic.title || 'Interactive HTML'}
                                      </span>
                                      {hasIframe && (
                                        <span className="text-[9.5px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                                          Interactive HTML
                                        </span>
                                      )}
                                    </div>

                                    {/* Right Side: Topic Action Icons (Video, Flashcard, Question) */}
                                    {renderTopicActionButtons()}
                                  </div>

                                  {/* Expanded Section: Reveals Video Lecture (if any) & HTML Iframe */}
                                  {isTopicPageExpanded && (
                                    <div className="w-full pt-4 mt-3 border-t border-[#0f1f1a]/10 space-y-5 animate-fade-in text-[#1b2b25]">
                                      {renderPageContent(page, pIdx)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      // When 'Collapsible Page Settings' is DISABLED:
                      // Display the standard Topic dropdown (topic dropdown should be visible only when 'Collapsible Page Settings' is disabled).
                      return (
                        <div
                          key={topic.id}
                          style={theme.ribbonStyle}
                          className={`w-full border hover:shadow-md rounded-2xl p-3.5 px-5 shadow-sm transition-all duration-300 flex flex-col`}
                        >
                          {/* Header Row — Clickable to Expand / Squeeze Topic Pages */}
                          <div
                            onClick={() => toggleTopicExpand(topic.id)}
                            className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none group"
                          >
                            {/* Left Side: Topic Title & Toggle Chevron Indicator */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-lg bg-white border border-[#0f1f1a]/10 flex items-center justify-center text-[#12302a] group-hover:scale-110 group-hover:border-amber-400 transition-all shrink-0">
                                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#9a7a2e]' : 'text-[#3d6354]'}`} />
                              </div>
                              <h4 style={theme.titleStyle} className="text-xs sm:text-sm font-semibold truncate tracking-tight">
                                {topic.title}
                              </h4>
                              {topic.pages && topic.pages.length > 0 && (
                                <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#0f1f1a]/[0.06] border border-[#0f1f1a]/10 text-[#3d6354] shrink-0">
                                  {topic.pages.length} {topic.pages.length === 1 ? 'page' : 'pages'}
                                </span>
                              )}
                            </div>

                            {/* Right Side: 3 Interactive Action Icons at Same Level */}
                            {renderTopicActionButtons()}
                          </div>

                          {/* Expanded Content Section: Reveals Pages assigned to this Topic directly without inner collapsible */}
                          {isExpanded && (
                            <div className="w-full pt-4 mt-3 border-t border-[#0f1f1a]/10 space-y-5 animate-fade-in text-[#1b2b25]">

                              {(!topic.pages || topic.pages.length === 0) ? (
                                <div className="p-6 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/60">
                                  No specific reading pages assigned to this topic yet.
                                </div>
                              ) : (
                                topic.pages.map((page, pIdx) => {
                                  const hasIframe = Boolean((page as any).iframeUrl);
                                  return (
                                    <div key={(page as any).id || `topic-${topic.id}-${pIdx}`} className="bg-white border border-[#0f1f1a]/[0.08] rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
                                      <div className="flex items-center justify-between border-b border-[#0f1f1a]/10 pb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10.5px] font-mono uppercase text-[#9a7a2e] font-black tracking-wider">
                                            Page {pIdx + 1} • {topic.title}
                                          </span>
                                          {hasIframe && (
                                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                                              Interactive HTML
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {renderPageContent(page, pIdx)}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className={`w-full flex flex-col items-stretch px-[2%] ${themeStyles.paperBg} ${themeStyles.color} rounded-xl relative`}
                style={{ fontSize: `${fontSizeScale}rem`, height: ((activeLesson?.pdfUrl && activeLesson.pdfUrl.trim().length > 0) || (selectedBook?.bookType === 'pdf' && !activeLesson?.contentType && sanitizedPages.length === 0)) ? 'auto' : `${rowVirtualizer.getTotalSize()}px` }}
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
                {((activeLesson?.pdfUrl && activeLesson.pdfUrl.trim().length > 0) || (selectedBook?.bookType === 'pdf' && !activeLesson?.contentType && sanitizedPages.length === 0)) ? (
                  <PdfPageViewer
                    pdfUrl={activeLesson?.pdfUrl || ''}
                    imageViewMode={imageViewMode}
                    themeMode={themeMode}
                    fontSizeScale={fontSizeScale}
                  />
                ) : (
                  rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const page = sanitizedPages[virtualRow.index];
                  if (!page) return null;

                  const pg = page as any;
                  const pageImages = [pg.leftImage, pg.centerImage, pg.rightImage].filter(Boolean);
                  const pageImageCount = pageImages.length;
                  const pageHasNoText = !hasTextContent(pg.content);

                  return (
                  <VirtualPageWrapper
                    key={(page as any).id || page.pageNumber || virtualRow.index}
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

                    {(page as any).isCollapsible && (
                      <button
                        onClick={() => togglePageExpand(page.pageNumber)}
                        className="w-full flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mb-4 mt-8 cursor-pointer"
                      >
                        <span className="font-serif font-medium text-lg text-slate-800 dark:text-slate-200">
                          {(page as any).summaryContent || 'Expand Section...'}
                        </span>
                        <ChevronDown className={`w-6 h-6 text-slate-500 transition-transform ${Boolean(expandedPages[String(page.pageNumber)] || expandedPages[page.pageNumber]) ? 'rotate-180' : ''}`} />
                      </button>
                    )}

                    {(!(page as any).isCollapsible || Boolean(expandedPages[String(page.pageNumber)] || expandedPages[page.pageNumber])) && (
                      <>
                        {(page as any).iframeUrl ? (
                      <div className="w-full mt-8 flex items-center justify-center">
                        <HtmlPageFrame
                          url={(page as any).iframeUrl}
                          title={`Interactive Page ${page.pageNumber}`}
                          className="w-full min-h-[85vh] border-0 rounded-2xl shadow-xl bg-white"
                        />
                      </div>
                    ) : (pageImageCount >= 1 && pageHasNoText && imageViewMode === 'two') ? (
                      <div className="grid grid-cols-2 w-full gap-6 mt-4">
                        {pageImages.map((imgSrc, imgIdx) => (
                          <div key={imgIdx} className="w-full">
                            <CachedImage 
                              src={imgSrc} 
                              alt={`Graphic Illustration ${imgIdx + 1}`} 
                              className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                            />
                          </div>
                        ))}
                      </div>
                    ) : isLessonContentLess ? (
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
                            className="font-serif leading-loose space-y-6 text-[clamp(16px,0.8vw+12px,42px)] tracking-wide reader-content relative"
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
                      </>
                    )}
                  </div>
                  </VirtualPageWrapper>
                  );
                })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      ) : (
        /* Empty Welcome state showing only the global logo */
        <div
          id="empty-state"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${
            isDraggingFile ? 'bg-amber-400/10 border-2 border-dashed border-amber-400' : 'bg-transparent'
          }`}
        >
          <div className="flex flex-col items-center justify-center">
            {globalLogo ? (
              <div className="w-[50vw] h-[50vh] max-w-[50vw] max-h-[50vh] mx-auto flex items-center justify-center p-2">
                <CachedImage src={globalLogo} alt="Global Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-[50vw] h-[50vh] max-w-[50vw] max-h-[50vh] mx-auto rounded-3xl bg-slate-800/30 border border-slate-700/50 flex items-center justify-center text-amber-400 text-8xl animate-bounce-short p-4">
                📖
              </div>
            )}

            {uploadFeedback && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 animate-pulse">
                <Check className="w-4 h-4" />
                <span>{uploadFeedback}</span>
              </div>
            )}
          </div>
        </div>


      )}

      {/* ANNOTATION UI: Speech Bubble (Popover) — always landscape rectangle */}
      {activeAnnotation && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent cursor-pointer" onClick={() => setActiveAnnotation(null)} />
          <div 
            ref={annotationBubbleRef}
            className="fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-5 transition-opacity duration-200"
            style={{
              /* Always landscape: min-width much wider than max-height allows it to grow tall */
              minWidth: 'min(560px, 90vw)',
              maxWidth: 'min(720px, 92vw)',
              maxHeight: '48vh',
              top: Math.max(10, activeAnnotation.rect.bottom + 10),
              /* Re-centre based on the wider 560px bubble */
              left: Math.max(10, Math.min(window.innerWidth - Math.min(560, window.innerWidth * 0.9) - 10,
                activeAnnotation.rect.left + activeAnnotation.rect.width / 2 - Math.min(560, window.innerWidth * 0.9) / 2))
            }}
          >
            {/* Tail arrow */}
            <div className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"></div>

            {/* Attached media image if present */}
            {activeAnnotation.mediaUrl && (
              <div 
                className="mb-3 max-h-48 rounded-lg overflow-hidden border border-slate-700 bg-black/60 flex items-center justify-center cursor-pointer group"
                onClick={() => {
                  setImageFrameSrc(activeAnnotation.mediaUrl);
                  setActiveAnnotation(null);
                }}
                title="Click to view full size"
              >
                <img src={activeAnnotation.mediaUrl} alt="Annotation media" className="max-h-48 w-auto object-contain group-hover:scale-105 transition-transform" />
              </div>
            )}

            {/* Scrollable text area */}
            <div 
              className="relative text-slate-200 font-serif leading-loose overflow-y-auto"
              style={{ fontSize: activeAnnotation.fontSize, maxHeight: activeAnnotation.mediaUrl ? 'calc(48vh - 220px)' : 'calc(48vh - 40px)' }}
              dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(activeAnnotation.text) }}
            />
          </div>
        </>
      )}

      {/* Fullscreen Image Frame for Annotations */}
      <ImageFrame 
        isOpen={!!imageFrameSrc}
        onClose={() => {
          setImageFrameSrc(null);
          setImageFrameDef(undefined);
        }}
        src={imageFrameSrc || ''}
        alt="Annotation Media"
        interactiveDef={imageFrameDef}
      />
    </div>
  );
}

