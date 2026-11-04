/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, HelpCircle, FileText, Move, Maximize, Video, Check, RotateCcw, AlertTriangle, Eye, EyeOff, X, Palette, Sparkles, Undo, Trash2, WifiOff, Calculator, Filter, ExternalLink, Tv, Film, Tag, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { Book, AcademicSubject, Lesson, Topic, FlashQuestion, Note, InquiryQuestionObj } from '../types';
import { renderMathInRawHtml } from '../lib/mathPreprocessor';
import 'katex/dist/katex.min.css';
import ScribbleOverlay from './ScribbleOverlay';
import AccountancyQuestionModal from './AccountancyQuestionModal';
import CachedImage from './CachedImage';
import { getEffectiveTopicInquiryQuestions, getEffectiveTopicFlashQuestions, getEffectiveTopicVideos } from '../lib/contentUtils';
import { getChapterVideoUrls, getPdfChapterQuestions, sourceKey } from '../lib/chapterMedia';
import { getChapterContentType } from '../lib/chapterContent';
import { getLocalImageSrc } from '../lib/imageCache';

/** Question image that uses the copy saved on the device when there is no internet. Hidden if it cannot load. */
const SavedImage: React.FC<{ src: string; className: string }> = ({ src, className }) => {
  const [resolved, setResolved] = React.useState(src);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    setFailed(false);
    setResolved(src);
    getLocalImageSrc(src).then(local => { if (alive) setResolved(local); }).catch(() => {});
    return () => { alive = false; };
  }, [src]);
  if (failed) return null;
  return <img src={resolved} className={className} alt="Question" onError={() => setFailed(true)} />;
};


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

interface FloatingButtonProps {
  currentLesson: Lesson | null;
  onToggleButtonDraw: () => void;
  isDrawingEnabled: boolean;
  onAddNote: (noteText: string) => void;
  savedNote: Note | null;
  addToast?: (text: string, type?: 'info' | 'success' | 'warn' | 'cloud') => void;
  globalLogo?: string | null;
  externalTopicModal?: { topic: Topic; panel: 'video' | 'questions' | 'notes' } | null;
  onCloseExternalTopicModal?: () => void;
  /** Show the round draggable launcher button. The panels (topic video/questions) work either way. */
  showLauncher?: boolean;
  /** Chapter-level panel opened from the closed greenboard's icons: lecture videos or "Some Extra Questions" */
  externalChapterPanel?: 'video' | 'notes' | null;
  onCloseExternalChapterPanel?: () => void;
  /** The book's source (admin panel); ticked by default in the chapter "Some Extra Questions" panel */
  bookSource?: string | null;
}

class QuestionListErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Question List Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900/90 text-rose-300 rounded-2xl border border-rose-500/40 text-center my-4 shadow-xl">
          <p className="font-bold text-base">An unexpected error occurred while displaying questions.</p>
          <p className="text-xs font-mono text-rose-400 mt-2 bg-rose-950/60 p-2 rounded border border-rose-800/50 max-w-xl mx-auto overflow-x-auto">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer text-white"
          >
            Retry Loading Questions
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const QuestionContent = React.memo(({ item, isOnline }: { item: string | InquiryQuestionObj; isOnline: boolean }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isAdvanced = Boolean(item) && typeof item === 'object';
  const image = isAdvanced && item ? (item as InquiryQuestionObj).image || null : null;
  const pos = isAdvanced && item ? (item as InquiryQuestionObj).imagePosition || 'right' : 'right';

  let qText = '';
  if (typeof item === 'string') {
    qText = item;
  } else if (isAdvanced && item) {
    const adv = item as any;
    qText = adv.text || adv.question || adv.questionText || adv.title || adv.content || (typeof adv === 'object' ? String(adv.id || '') : '');
  }


  if (!image) {
    return (
      <div className="w-full text-[#2c3a31] font-serif text-[15px] md:text-[18px] lg:text-[21px] xl:text-[25px] 2xl:text-[30px] min-[3840px]:text-[40px] leading-relaxed">
        <div dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(qText) }} />
      </div>
    );
  }

  if (pos === 'center') {
    return (
      <div className="w-full flex flex-col items-center gap-6 text-[#2c3a31] font-serif text-[15px] md:text-[18px] lg:text-[21px] xl:text-[25px] 2xl:text-[30px] min-[3840px]:text-[40px] leading-relaxed">
        <SavedImage src={image} className="w-[80%] rounded-xl object-contain border border-[#3f5a48]/20" />
        <div className="w-full" dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(qText) }} />
      </div>
    );
  }

  if (pos === 'left') {
    return (
      <div className="w-full flex flex-col md:flex-row items-start gap-6 text-[#2c3a31] font-serif text-[15px] md:text-[18px] lg:text-[21px] xl:text-[25px] 2xl:text-[30px] min-[3840px]:text-[40px] leading-relaxed">
        <SavedImage src={image} className="w-[30%] shrink-0 rounded-xl object-contain border border-[#3f5a48]/20" />
        <div className="flex-1" dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(qText) }} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col md:flex-row items-start gap-6 text-[#2c3a31] font-serif text-[15px] md:text-[18px] lg:text-[21px] xl:text-[25px] 2xl:text-[30px] min-[3840px]:text-[40px] leading-relaxed">
      <div className="flex-1" dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(qText) }} />
      <SavedImage src={image} className="w-[30%] shrink-0 rounded-xl object-contain border border-[#3f5a48]/20" />
    </div>
  );
});

const FlashcardContent = React.memo(({ contentText, isFlipped }: { contentText: string; isFlipped: boolean }) => {
  return (
    <div
      className={`reader-content prose max-w-none prose-p:my-2 prose-headings:my-3 prose-img:rounded-xl prose-img:mx-auto ${isFlipped ? 'text-[#2a1f08] prose-p:text-[#2a1f08] prose-headings:text-[#2a1f08] prose-strong:text-[#2a1f08] prose-li:text-[#2a1f08] text-left' : 'text-[#1b2b25] prose-p:text-[#1b2b25] prose-headings:text-[#1b2b25] prose-strong:text-[#1b2b25] prose-li:text-[#1b2b25]'}`}
      style={{ fontSize: 'inherit', lineHeight: 'inherit' }}
      dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(contentText) }}
    />
  );
});

const QuestionItem = React.memo(({
  item,
  isOnline,
  onOpenAccountancyWorkspace,
  questionNumber,
  revealAll,
}: {
  item: string | InquiryQuestionObj;
  isOnline: boolean;
  onOpenAccountancyWorkspace?: (item: string | InquiryQuestionObj) => void;
  questionNumber?: number;
  revealAll?: { open: boolean; nonce: number };
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState<boolean>(revealAll?.open ?? false);
  useEffect(() => {
    if (revealAll && revealAll.nonce > 0) setShowAnswer(revealAll.open);
  }, [revealAll?.nonce]);
  const dragStartRef = useRef<{ y: number; startHeight: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    if (target.setPointerCapture) {
      target.setPointerCapture(e.pointerId);
    }
    dragStartRef.current = {
      y: e.clientY,
      startHeight: containerRef.current ? containerRef.current.offsetHeight : 0
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dy = e.clientY - dragStartRef.current.y;
    const newHeight = Math.max(0, dragStartRef.current.startHeight + dy);
    setMinHeight(newHeight);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  };

  const isAccountancyMode = Boolean(item) && typeof item !== 'string' && ((item as InquiryQuestionObj).displayMode === 'accountancy_tabs' || Boolean((item as InquiryQuestionObj).tabs && (item as InquiryQuestionObj).tabs!.length > 0));
  const hasAnswer = Boolean(item) && typeof item !== 'string' && Boolean((item as InquiryQuestionObj).answerText || (item as InquiryQuestionObj).answerImage);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="group relative rounded-2xl bg-[#fbfaf6] text-[#2c3a31] shadow-lg shadow-black/15 p-4 sm:p-6 md:p-7 flex gap-3 sm:gap-5 text-[15px] md:text-[18px] lg:text-[21px] xl:text-[25px] 2xl:text-[30px] min-[3840px]:text-[40px]"
      style={{ minHeight: minHeight > 0 ? `${minHeight}px` : undefined }}
    >
      {typeof questionNumber === 'number' && (
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#3f5a48] text-white text-sm sm:text-base font-semibold flex items-center justify-center shrink-0 select-none">
          {questionNumber}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {typeof item !== 'string' && item.topicTitle && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#EAF0E8] text-[#2f4a38]">{item.topicTitle}</span>
            )}
            {typeof item !== 'string' && item.marks !== undefined && item.marks !== null && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#f8e9e2] text-[#7a3520]">{item.marks} marks</span>
            )}
            {typeof item !== 'string' && (item as any).source && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-[#F1EFE8] text-[#444441]">{(item as any).source}</span>
            )}
          </div>
          {isAccountancyMode && onOpenAccountancyWorkspace && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenAccountancyWorkspace(item); }}
              className="bg-[#c8664a] hover:bg-[#b5573d] text-white px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
              title="Show Accounts/Journal Workspace"
            >
              <Calculator className="w-4 h-4" />
              <span className="text-xs font-semibold">Show Accounts/Journal</span>
            </button>
          )}
        </div>

        <div className="flex justify-between items-start gap-4">
          <QuestionContent item={item} isOnline={isOnline} />
        </div>

        {hasAnswer && (
          <div className="mt-4 flex flex-col">
            <div className="flex justify-end w-full">
              <button
                onClick={() => setShowAnswer(prev => !prev)}
                className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                  showAnswer ? 'bg-[#a8492e] border-[#a8492e] text-white' : 'border-[#a8492e] text-[#a8492e] hover:bg-[#f8e9e2]'
                }`}
                title={showAnswer ? 'Hide answer' : 'Show answer'}
              >
                {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showAnswer ? 'Hide answer' : 'Show answer'}
              </button>
            </div>

            {showAnswer && Boolean(item) && typeof item !== 'string' && (
              <div className="mt-3 p-4 sm:p-5 bg-[#f8e9e2] border-t-[3px] border-[#a8492e] rounded-b-xl space-y-3 animate-fade-in">
                <div className="text-[11px] sm:text-xs font-semibold tracking-[0.14em] text-[#a8492e]">ANSWER</div>
                {item.answerText && (
                  <div
                    dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(item.answerText) }}
                    className="text-[#4A1B0C] font-serif text-[15px] md:text-[18px] lg:text-[21px] xl:text-[25px] 2xl:text-[30px] min-[3840px]:text-[40px] leading-relaxed"
                  />
                )}
                {item.answerImage && (
                  <div className={`flex ${item.answerImagePosition === 'left' ? 'justify-start' : item.answerImagePosition === 'right' ? 'justify-end' : 'justify-center'} mt-2`}>
                    <img src={item.answerImage} alt="Solution Illustration" className="max-h-80 rounded-xl border border-[#a8492e]/30 shadow object-contain" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize Handle at Bottom Left */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute bottom-0 left-0 w-12 h-12 flex items-end justify-start p-2 cursor-ns-resize opacity-25 hover:opacity-100 transition-opacity pointer-events-auto touch-none"
        title="Drag to resize question area"
      >
        <Move className="w-5 h-5 text-[#3f5a48] rotate-45" />
      </div>
    </div>
  );
});

// Mock videos removed as per user request. Videos are now entirely dynamic based on Firebase lessons.

export default function FloatingButton({
  currentLesson,
  onToggleButtonDraw,
  isDrawingEnabled,
  onAddNote,
  savedNote,
  addToast,
  globalLogo,
  externalTopicModal,
  onCloseExternalTopicModal,
  showLauncher = true,
  externalChapterPanel = null,
  onCloseExternalChapterPanel,
  bookSource = null,
}: FloatingButtonProps) {
  // Movement management for responsive smartboards
  const [position, setPosition] = useState({ x: 4, y: 15 }); // percentages from bottom-right coords
  const [isDragging, setIsDragging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const elementPos = useRef({ x: 4, y: 4 });
  const hasMovedRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Panels visibility options
  const [activePanel, setActivePanel] = useState<'video' | 'questions' | 'notes' | null>(null);
  const [maximizedVideoId, setMaximizedVideoId] = useState<string | null>(null);
  const [videoMetaMap, setVideoMetaMap] = useState<Record<string, { title?: string; author?: string; thumbnail?: string }>>({});
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [globalLogo]);

  // Sync external topic modal triggers from Student Panel
  useEffect(() => {
    if (externalTopicModal) {
      setActivePanel(externalTopicModal.panel);
      if (externalTopicModal.panel === 'video') {
        // Videos open in 3-column grid view
        setMaximizedVideoId(null);
      }
    }
  }, [externalTopicModal, currentLesson]);

  // Chapter-level panels opened from the greenboard handle icons
  useEffect(() => {
    if (!externalChapterPanel) return;
    setActivePanel(externalChapterPanel);
    if (externalChapterPanel === 'video') {
      // Videos open in 3-column grid view
      setMaximizedVideoId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalChapterPanel]);

  const closeActivePanel = () => {
    setRevealAllAnswers({ open: false, nonce: 0 });
    setActivePanel(null);
    setMaximizedVideoId(null);
    setIsListDrawingMode(false);
    if (onCloseExternalTopicModal) {
      onCloseExternalTopicModal();
    }
    onCloseExternalChapterPanel?.();
  };

  // Full Screen Question Drawing State
  const [isListDrawingMode, setIsListDrawingMode] = useState(false);
  const [revealAllAnswers, setRevealAllAnswers] = useState<{ open: boolean; nonce: number }>({ open: false, nonce: 0 });
  const [qSelectedColor, setQSelectedColor] = useState('#f59e0b');
  const [qIsHighlighter, setQIsHighlighter] = useState(false);
  const PALETTE_COLORS = [
    { name: 'Classroom Amber', hex: '#f59e0b' },
    { name: 'Alert Red', hex: '#f43f5e' },
    { name: 'Sky Blue', hex: '#38bdf8' },
    { name: 'Chalk White', hex: '#ffffff' },
  ];

  // Lecture states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1.0x');
  const [lectureProgress, setLectureProgress] = useState(35); // simulated playback%

  // Quiz states
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scoreTeamA, setScoreTeamA] = useState(0);
  const [scoreTeamB, setScoreTeamB] = useState(0);
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');
  const [flashShuffleOrder, setFlashShuffleOrder] = useState<number[] | null>(null);

  // Handwritten notes state
  const [localNote, setLocalNote] = useState('');
  const [borderWidth, setBorderWidth] = useState(100);
  
  // Internet connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Accountancy Multi-Tab Modal State
  const [accountancyQuestion, setAccountancyQuestion] = useState<string | InquiryQuestionObj | null>(null);
  const [isAccountancyModalOpen, setIsAccountancyModalOpen] = useState(false);

  const handleOpenAccountancyWorkspace = (q: string | InquiryQuestionObj) => {
    setActivePanel('notes');
    setAccountancyQuestion(q);
    setIsAccountancyModalOpen(true);
  };

  // Dynamic videos list based on currentLesson or external topic override with rich metadata
  const activeVideos = React.useMemo(() => {
    if (externalTopicModal?.topic) {
      const topicUrls = getEffectiveTopicVideos(externalTopicModal.topic, currentLesson);
      if (topicUrls.length > 0) {
        return topicUrls.map((url, idx) => {
          const youtubeIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
          const youtubeId = youtubeIdMatch ? youtubeIdMatch[1] : '';
          const isDirect = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('/videos%2F') || url.includes('/videos/');
          let fileName = '';
          try {
            const decoded = decodeURIComponent(url);
            const m = decoded.match(/([^\/?#]+)\.(mp4|webm|ogg|mov)/i);
            if (m) fileName = m[1].replace(/^\d+[-_]/, '').replace(/[-_]/g, ' ');
          } catch {}

          return {
            id: `topic-video-${idx}`,
            partNumber: idx + 1,
            totalParts: topicUrls.length,
            title: externalTopicModal.topic.title + (topicUrls.length > 1 ? ` (Part ${idx + 1} of ${topicUrls.length})` : ''),
            scopeTitle: externalTopicModal.topic.title,
            scopeType: 'topic' as const,
            channel: 'Topic Lecture',
            youtubeId: youtubeId,
            rawUrl: url,
            isDirectVideo: isDirect,
            fileName: fileName,
            duration: topicUrls.length > 1 ? `Part ${idx + 1}` : 'Topic Video'
          };
        });
      }
    }

    if (!currentLesson) return [];
    
    // Chapter lecture videos (new array or legacy single URL; empty entries skipped)
    const urlsToProcess = getChapterVideoUrls(currentLesson);

    return urlsToProcess.map((url, idx) => {
      const youtubeIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      const youtubeId = youtubeIdMatch ? youtubeIdMatch[1] : '';
      const isDirect = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.includes('/videos%2F') || url.includes('/videos/');
      let fileName = '';
      try {
        const decoded = decodeURIComponent(url);
        const m = decoded.match(/([^\/?#]+)\.(mp4|webm|ogg|mov)/i);
        if (m) fileName = m[1].replace(/^\d+[-_]/, '').replace(/[-_]/g, ' ');
      } catch {}
      
      return {
        id: `lesson-video-${idx}`,
        partNumber: idx + 1,
        totalParts: urlsToProcess.length,
        title: currentLesson.title + (urlsToProcess.length > 1 ? ` (Part ${idx + 1} of ${urlsToProcess.length})` : ' (Active Chapter)'),
        scopeTitle: currentLesson.title,
        scopeType: 'chapter' as const,
        channel: 'Chapter Lecture',
        youtubeId: youtubeId,
        rawUrl: url,
        isDirectVideo: isDirect,
        fileName: fileName,
        duration: urlsToProcess.length > 1 ? `Part ${idx + 1}` : 'Current'
      };
    });
  }, [currentLesson, externalTopicModal]);

  // Fetch online YouTube metadata (real titles, channel names, thumbnails)
  useEffect(() => {
    if (activePanel !== 'video' || !isOnline) return;
    activeVideos.forEach(vid => {
      if (vid.youtubeId && !videoMetaMap[vid.youtubeId]) {
        fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${vid.youtubeId}`)
          .then(res => res.json())
          .then(data => {
            if (data && (data.title || data.author_name)) {
              setVideoMetaMap(prev => ({
                ...prev,
                [vid.youtubeId]: {
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
  }, [activePanel, activeVideos, isOnline, videoMetaMap]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setBorderWidth(12);
      } else if (window.innerWidth < 1024) {
        setBorderWidth(40);
      } else {
        setBorderWidth(100);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (savedNote) {
      setLocalNote(savedNote.text);
    } else {
      setLocalNote('');
    }
  }, [savedNote, currentLesson]);

  // Touch and mouse coordinate logic
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    setIsDragging(true);
    hasMovedRef.current = false;
    dragStart.current = { x: clientX, y: clientY };
    elementPos.current = { ...position };
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const deltaX = clientX - dragStart.current.x;
    const deltaY = clientY - dragStart.current.y;

    if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
      hasMovedRef.current = true;
    }

    // Convert pixel delta to viewport width/height % limits
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const newX = Math.max(2, Math.min(95, elementPos.current.x - (deltaX / screenW) * 100));
    // Clamp Y to 15% - 85% to guarantee the 12 o'clock and 6 o'clock buttons never overflow the screen edges
    const newY = Math.max(15, Math.min(85, elementPos.current.y - (deltaY / screenH) * 100));

    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    // Only reset dragging state, tap handling is delegated to the button's explicit handlers
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: true });
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, position]);

  const togglePanel = (panel: 'video' | 'questions' | 'notes') => {
    if (activePanel === panel) {
      closeActivePanel();
    } else {
      setActivePanel(panel);
      if (panel === 'video') {
        setMaximizedVideoId(null);
      }
    }
  };

  const handleSaveNote = () => {
    onAddNote(localNote);
  };

  const getLessonQuestions = (): (string | InquiryQuestionObj)[] => {
    if (externalTopicModal?.topic) {
      return getEffectiveTopicInquiryQuestions(externalTopicModal.topic, currentLesson);
    }
    // PDF chapters (Q icon on the greenboard handle): only questions that have a source
    if (getChapterContentType(currentLesson) === 'pdf') return getPdfChapterQuestions(currentLesson);
    return (currentLesson?.inquiryQuestions || []).filter(Boolean);
  };

  // ── Source filter for "Some Extra Questions from Lesson" ──
  // One checkbox per distinct source. By default only NCERT is ticked (or every
  // source when the list has no NCERT questions). Questions without a source are
  // not filtered and always stay visible.
  // Default ticked source: the book's source for the chapter panel (Q icon); NCERT for topic panels
  const DEFAULT_QUESTION_SOURCE = !externalTopicModal?.topic && sourceKey(bookSource) ? sourceKey(bookSource) : 'ncert';
  const [selectedQuestionSources, setSelectedQuestionSources] = useState<string[] | null>(null); // null = default
  useEffect(() => {
    setSelectedQuestionSources(null);
  }, [currentLesson?.id, externalTopicModal?.topic?.title, externalChapterPanel]);

  /** "T.S. Grewal", "TS Grewal" and "t s grewal" are the same source. */
  const questionSourceKey = (q: string | InquiryQuestionObj): string => {
    if (!q || typeof q === 'string') return '';
    return (q.source || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  };

  const getQuestionSourceOptions = () => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const q of getLessonQuestions()) {
      const key = questionSourceKey(q);
      if (!key) continue;
      const entry = map.get(key);
      if (entry) entry.count += 1;
      else map.set(key, { key, label: String((q as InquiryQuestionObj).source).trim(), count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  };

  const getEffectiveQuestionSources = (): string[] => {
    if (selectedQuestionSources) return selectedQuestionSources;
    const keys = getQuestionSourceOptions().map(o => o.key);
    return keys.includes(DEFAULT_QUESTION_SOURCE) ? [DEFAULT_QUESTION_SOURCE] : keys;
  };

  const getVisibleLessonQuestions = () => {
    const selected = getEffectiveQuestionSources();
    return getLessonQuestions().filter(q => {
      const key = questionSourceKey(q);
      return !key || selected.includes(key);
    });
  };

  const toggleQuestionSource = (key: string) => {
    const current = getEffectiveQuestionSources();
    setSelectedQuestionSources(current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  };

  const allFlashQuestions = React.useMemo(() => {
    if (externalTopicModal?.topic) {
      return getEffectiveTopicFlashQuestions(externalTopicModal.topic, currentLesson);
    }
    return currentLesson?.flashQuestions || [];
  }, [currentLesson, externalTopicModal]);

  const filteredFlashQuestions = React.useMemo(() => {
    if (difficultyFilter === 'all') return allFlashQuestions;
    return allFlashQuestions.filter(q => (q.difficulty || '').toLowerCase() === difficultyFilter.toLowerCase());
  }, [allFlashQuestions, difficultyFilter]);

  const easyCount = React.useMemo(() => allFlashQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'easy').length, [allFlashQuestions]);
  const mediumCount = React.useMemo(() => allFlashQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'medium').length, [allFlashQuestions]);
  const hardCount = React.useMemo(() => allFlashQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'hard').length, [allFlashQuestions]);

  const orderedFlashQuestions = React.useMemo(() => {
    if (flashShuffleOrder && flashShuffleOrder.length === filteredFlashQuestions.length) {
      return flashShuffleOrder.map(k => filteredFlashQuestions[k]);
    }
    return filteredFlashQuestions;
  }, [filteredFlashQuestions, flashShuffleOrder]);

  const hasFlash = orderedFlashQuestions.length > 0;
  const activeQuestion: FlashQuestion | null = hasFlash
    ? orderedFlashQuestions[currentQuestionIdx % orderedFlashQuestions.length]
    : null;

  // Keyboard: ← → move, Space flips (retrieval cards only)
  useEffect(() => {
    if (activePanel !== 'questions') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const n = orderedFlashQuestions.length;
      if (!n) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setCurrentQuestionIdx(p => (p + 1) % n); setIsFlipped(false); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setCurrentQuestionIdx(p => (p - 1 + n) % n); setIsFlipped(false); }
      else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); setIsFlipped(f => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activePanel, orderedFlashQuestions.length]);

  const isOnLeft = position.x >= 50;

  return (
    <>
      {/* Draggable FAB Container Layer (only when the launcher is enabled, e.g. PDF chapters) */}
      {showLauncher && (
      <div
        className="absolute z-40"
        style={{
          right: `${position.x}%`,
          bottom: `${position.y}%`,
          transform: isDragging ? 'scale(1.05)' : 'scale(1)',
          transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        id="movable-fab-container"
      >
        <div className="relative flex items-center justify-center w-16 h-16">
          {/* Radial Menu Options (with class-based visibility or styles) */}
          <div 
            id="fab-options-menu"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(prev => !prev);
            }}
            className={`absolute flex items-center justify-center w-16 h-16 transition-all duration-300 ${
              isMenuOpen ? 'opacity-100 scale-100 pointer-events-auto z-55' : 'opacity-0 scale-75 pointer-events-none -z-10'
            }`}
          >
            {/* Option 1: Video icon directly on top (12 o'clock) - Static */}
            <button
              id="fab-opt-video"
              onClick={(e) => {
                e.stopPropagation();
                togglePanel('video');
                setIsMenuOpen(false);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePanel('video');
                setIsMenuOpen(false);
              }}
              style={{
                position: 'absolute',
                transform: isMenuOpen ? 'translateY(-96px)' : 'translateY(0px) scale(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                opacity: isMenuOpen ? 1 : 0,
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer border border-zinc-800 shadow-xl hover:scale-110 active:scale-95 pointer-events-auto z-50 ${
                activePanel === 'video' ? 'bg-sky-500 text-white font-bold' : 'bg-stone-900 hover:bg-stone-850 text-sky-400'
              }`}
              title="Video Lecture Summary"
            >
              <Video className="w-5 h-5 pointer-events-none" />
            </button>

            {/* Option 2: Flashcards */}
            <button
              id="fab-opt-flash"
              onClick={(e) => {
                e.stopPropagation();
                togglePanel('questions');
                setIsMenuOpen(false);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePanel('questions');
                setIsMenuOpen(false);
              }}
              style={{
                position: 'absolute',
                transform: isMenuOpen 
                  ? (isOnLeft ? 'rotate(60deg) translateY(-96px) rotate(-60deg)' : 'rotate(-60deg) translateY(-96px) rotate(60deg)')
                  : 'rotate(0deg) translateY(0px) rotate(0deg) scale(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                opacity: isMenuOpen ? 1 : 0,
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer border border-zinc-800 shadow-xl hover:scale-110 active:scale-95 pointer-events-auto z-50 ${
                activePanel === 'questions' ? 'bg-amber-500 text-[#1a1208] font-bold' : 'bg-stone-900 hover:bg-stone-850 text-amber-500'
              }`}
              title="Flash Retrieval Cards"
            >
              <HelpCircle className="w-5 h-5 pointer-events-none" />
            </button>

            {/* Option 3: Draw */}
            <button
              id="fab-opt-draw"
              onClick={(e) => {
                e.stopPropagation();
                onToggleButtonDraw();
                setIsMenuOpen(false);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleButtonDraw();
                setIsMenuOpen(false);
              }}
              style={{
                position: 'absolute',
                transform: isMenuOpen 
                  ? (isOnLeft ? 'rotate(120deg) translateY(-96px) rotate(-120deg)' : 'rotate(-120deg) translateY(-96px) rotate(120deg)')
                  : 'rotate(0deg) translateY(0px) rotate(0deg) scale(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                opacity: isMenuOpen ? 1 : 0,
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer border border-zinc-800 shadow-xl hover:scale-110 active:scale-95 pointer-events-auto z-50 ${
                isDrawingEnabled ? 'bg-red-500 text-white font-bold' : 'bg-stone-900 hover:bg-stone-850 text-red-400'
              }`}
              title="Smartboard stylus highlighter drawing"
            >
              <Palette className="w-5 h-5 pointer-events-none" />
            </button>

            {/* Option 4: Notes (Q) */}
            <button
              id="fab-opt-notes"
              onClick={(e) => {
                e.stopPropagation();
                togglePanel('notes');
                setIsMenuOpen(false);
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                togglePanel('notes');
                setIsMenuOpen(false);
              }}
              style={{
                position: 'absolute',
                transform: isMenuOpen ? 'translateY(96px)' : 'translateY(0px) scale(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                opacity: isMenuOpen ? 1 : 0,
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer border border-zinc-800 shadow-xl hover:scale-110 active:scale-95 pointer-events-auto z-50 ${
                activePanel === 'notes' ? 'bg-emerald-500 text-slate-950 font-sans font-bold border-emerald-400' : 'bg-stone-900 hover:bg-stone-850 text-emerald-400 font-sans font-extrabold'
              }`}
              title="Interactive Lesson Questions (Q)"
            >
              <span className="text-base pointer-events-none select-none">Q</span>
            </button>
          </div>

          {/* Main FAB Trigger button which is now draggable and click-toggled */}
          <button
            ref={buttonRef}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onTouchEnd={(e) => {
              if (!hasMovedRef.current) {
                e.preventDefault(); // Prevent synthesized mouse click on mobile
                setIsMenuOpen(prev => !prev);
              }
            }}
            onClick={() => {
              if (!hasMovedRef.current) {
                setIsMenuOpen(prev => !prev);
              }
            }}
            id="fab-button"
            className="relative z-10 flex h-16 w-16 cursor-grab active:cursor-grabbing items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-[0_12px_24px_rgba(245,158,11,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 touch-none border border-amber-400/80"
          >
            {isMenuOpen ? (
              <X className="w-7 h-7" />
            ) : (
              globalLogo && !logoError ? (
                <CachedImage 
                  src={globalLogo} 
                  alt="Logo" 
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-cover rounded-full pointer-events-none" 
                />
              ) : (
                <Sparkles className="w-7 h-7" />
              )
            )}
          </button>
        </div>
      </div>
      )}

      {/* RENDER DYNAMIC ACTIVE CONTROL PANELS */}

      {/* 1. LECTURE VIDEO PANEL */}
      {activePanel === 'video' && (
        <div 
          id="youtube-dashboard-modal" 
          className="fixed inset-0 bg-[#030712]/75 backdrop-blur-md z-50 flex flex-col animate-fade-in"
        >
          {/* Chapter / Topic name displayed on the border on top-left aligned */}
          <div className="absolute top-[10px] left-[16px] md:top-[28px] md:left-[40px] z-55 flex items-center gap-2.5 pointer-events-none max-w-[calc(100vw-120px)] md:max-w-[75vw]">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-sm">
              <Video className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-sans text-xs md:text-base font-bold text-white tracking-tight truncate drop-shadow-sm">
                {externalTopicModal?.topic ? externalTopicModal.topic.title : (currentLesson?.title || 'Video Lectures')}
              </h2>
              {externalTopicModal?.topic && currentLesson?.title && (
                <p className="text-[10px] md:text-xs font-mono text-slate-400 truncate">
                  {currentLesson.title}
                </p>
              )}
            </div>
          </div>

          {/* Top-Right Border: Close Button */}
          <button
            onClick={closeActivePanel}
            className="absolute top-[10px] right-[16px] md:top-[28px] md:right-[40px] z-55 bg-slate-900/80 hover:bg-rose-600 border border-slate-700/80 hover:border-transparent text-slate-300 hover:text-white p-2 md:p-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-lg flex items-center justify-center pointer-events-auto"
            title="Close Video Box"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* Main Content box containing several youtube videos with dynamic translucent border */}
          <div 
            className="flex-1 w-full bg-slate-950/95 rounded-xl flex flex-col relative overflow-hidden text-slate-100"
            style={{ 
              border: `${borderWidth}px solid rgba(30, 41, 59, 0.65)`, 
            }}
          >
            {/* ── OFFLINE GATE: replaces entire panel when no internet ── */}
            {!isOnline ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 select-none text-center">
                <Video className="w-12 h-12 text-slate-600" />
                <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                  Videos will play when the device is connected to the internet.
                </p>
              </div>
            ) : maximizedVideoId ? (
              (() => {
                const activeVid = activeVideos.find(v => v.id === maximizedVideoId);
                if (!activeVid) return null;
                return (
                  <div className="h-full flex flex-col p-4 md:p-6 space-y-4 animate-fade-in">
                    {/* Full screen video header inside the borders */}
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2 flex-shrink-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[3px] text-amber-400 font-mono font-bold">
                            Now Playing • Full Screen Mode
                          </span>
                          {activeVideos.length > 1 && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                              Part {(activeVideos.findIndex(v => v.id === maximizedVideoId) + 1 || 1)} of {activeVideos.length}
                            </span>
                          )}
                        </div>
                        <h3 className="font-sans text-xs md:text-base font-extrabold text-slate-100 mt-0.5 truncate" title={videoMetaMap[activeVid.youtubeId]?.title || activeVid.title}>
                          {videoMetaMap[activeVid.youtubeId]?.title || activeVid.title}
                        </h3>
                        {videoMetaMap[activeVid.youtubeId]?.author && (
                          <p className="text-[11px] font-mono text-slate-400 truncate">
                            Channel: {videoMetaMap[activeVid.youtubeId]?.author} • {activeVid.scopeType === 'topic' ? `Topic: ${activeVid.scopeTitle}` : `Chapter: ${activeVid.scopeTitle}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {activeVideos.length > 1 && (
                          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg">
                            {activeVideos.map((vid, vIdx) => {
                              const isCurrent = vid.id === maximizedVideoId;
                              return (
                                <button
                                  key={vid.id}
                                  onClick={() => setMaximizedVideoId(vid.id)}
                                  className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                  }`}
                                  title={`Switch to Part ${vIdx + 1}`}
                                >
                                  Part {vIdx + 1}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* "All Videos" button to return to 3-column grid view */}
                        <button
                          onClick={() => setMaximizedVideoId(null)}
                          className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-amber-400 hover:text-amber-300 font-sans text-[10px] md:text-[11px] font-bold uppercase tracking-wider px-2 py-1 md:px-3 md:py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 shadow-md flex-shrink-0"
                          title="Back to grid view"
                        >
                          <RotateCcw className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          <span className="hidden sm:inline">All </span>Videos ({activeVideos.length})
                        </button>
                        <button
                          onClick={closeActivePanel}
                          className="bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white p-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center ml-1"
                          title="Close Video Box"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Full screen video display */}
                    <div className="flex-1 min-h-0 relative bg-black rounded-lg overflow-hidden border border-slate-900 shadow-2xl flex items-center justify-center">
                      {!isOnline ? (
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <Video className="w-12 h-12 mb-4 text-slate-600" />
                          <p className="text-sm">Videos will play when the device is connected to the internet.</p>
                        </div>
                      ) : activeVid.youtubeId ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${activeVid.youtubeId}?autoplay=1`}
                          title={activeVid.title}
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (activeVid.rawUrl && (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(activeVid.rawUrl) || activeVid.rawUrl.includes('/videos%2F') || activeVid.rawUrl.includes('/videos/'))) ? (
                        <video
                          src={activeVid.rawUrl}
                          controls
                          autoPlay
                          className="absolute inset-0 w-full h-full object-contain bg-black"
                        />
                      ) : (
                        <iframe
                          src={activeVid.rawUrl}
                          title={activeVid.title}
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      )}
                    </div>

                    {/* Multi-video parts selector strip below the player */}
                    {activeVideos.length > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
                            Lecture Parts:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {activeVideos.map((vid, vIdx) => {
                              const isCurrent = vid.id === maximizedVideoId;
                              return (
                                <button
                                  key={vid.id}
                                  onClick={() => setMaximizedVideoId(vid.id)}
                                  className={`text-[11px] font-mono px-3 py-1 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all ${
                                    isCurrent
                                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-md shadow-amber-950/40'
                                      : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-850 hover:text-white'
                                  }`}
                                >
                                  <Play className={`w-3 h-3 ${isCurrent ? 'fill-slate-950 text-slate-950' : 'text-amber-400'}`} />
                                  <span>Part {vIdx + 1}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {activeVideos.length} videos available for this topic
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              /* YouTube-Style Video Library Grid (3-column) - Top ribbon removed */
              <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">

                {activeVideos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                    <Video className="w-12 h-12 mb-4 text-slate-700/50" />
                    <p className="text-sm font-semibold text-slate-300">No videos available</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">There are no lecture videos attached to this topic or chapter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6 md:gap-x-5 md:gap-y-7">
                    {activeVideos.map((vid, vIdx) => {
                      const meta = vid.youtubeId ? videoMetaMap[vid.youtubeId] : null;
                      const displayTitle = meta?.title || (vid.fileName ? `${vid.title}: ${vid.fileName}` : vid.title);
                      const authorName = meta?.author || (vid.youtubeId ? 'YouTube Channel' : (vid.isDirectVideo ? 'Classroom Video' : vid.channel));
                      const isYouTube = Boolean(vid.youtubeId);
                      const ytMeta = getYouTubeStyleMeta(vid.id, vid.partNumber, vid.duration);

                      return (
                        <div
                          key={vid.id}
                          onClick={() => setMaximizedVideoId(vid.id)}
                          className="group flex flex-col cursor-pointer select-none"
                        >
                          {/* 1. Video Thumbnail: 16:9 aspect ratio, rounded corners, duration badge */}
                          <div className="relative aspect-video w-full bg-slate-900 rounded-xl overflow-hidden">
                            {isYouTube ? (
                              <img
                                src={meta?.thumbnail || `https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg`}
                                alt={displayTitle}
                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (!img.src.includes('mqdefault')) {
                                    img.src = `https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg`;
                                  }
                                }}
                              />
                            ) : vid.isDirectVideo ? (
                              <video
                                src={`${vid.rawUrl}#t=0.5`}
                                preload="metadata"
                                className="w-full h-full object-cover pointer-events-none group-hover:scale-[1.02] transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                                <Video className="w-10 h-10 text-slate-600" />
                              </div>
                            )}

                            {/* Subtle dark overlay on hover */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />

                            {/* Duration Badge at Bottom-Right Corner */}
                            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-medium px-1.5 py-0.5 rounded backdrop-blur-xs tracking-tight">
                              {ytMeta.duration}
                            </div>
                          </div>

                          {/* Content Details Below Thumbnail */}
                          <div className="mt-2.5 space-y-1">
                            {/* 2. Video Title: Prominent font, medium/semi-bold weight, max 2 lines with ellipsis */}
                            <h4
                              className="font-medium md:font-semibold text-slate-100 group-hover:text-white text-sm md:text-[15px] leading-snug line-clamp-2 transition-colors"
                              title={displayTitle}
                            >
                              {displayTitle}
                            </h4>

                            {/* 3. Video Metadata: Single horizontal row beneath title */}
                            <div className="flex items-center text-xs text-slate-400 gap-1.5 font-normal truncate">
                              <span className="truncate max-w-[140px] sm:max-w-[180px] hover:text-slate-200 transition-colors">
                                {authorName}
                              </span>
                              <span className="text-slate-500">•</span>
                              <span className="shrink-0">{ytMeta.views}</span>
                              <span className="text-slate-500">•</span>
                              <span className="shrink-0">{ytMeta.date}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Close button placed at the bottom-left of the translucent wide border */}
          <button
            id="close-video-modal"
            onClick={closeActivePanel}
            className="absolute bottom-[20px] left-[20px] md:bottom-[40px] md:left-[40px] z-55 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white p-3 md:p-4 rounded-lg md:rounded-xl transition-all duration-200 cursor-pointer shadow-xl shadow-rose-600/30 flex items-center justify-center pointer-events-auto"
            title="Close Library"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      )}      {/* 2. FLASH QUESTIONS ACTIVE RETRIEVAL CARDS */}
      {activePanel === 'questions' && (() => {
        const total = orderedFlashQuestions.length;
        const pos = total ? (currentQuestionIdx % total) + 1 : 0;
        const scopeLabel = externalTopicModal?.topic?.title || currentLesson?.title || '';
        const selectFilter = (f: 'all' | 'Easy' | 'Medium' | 'Hard') => { setDifficultyFilter(f); setCurrentQuestionIdx(0); setIsFlipped(false); setFlashShuffleOrder(null); };
        const filterBtns: { key: 'all' | 'Easy' | 'Medium' | 'Hard'; label: string; count: number; dot?: string }[] = [
          { key: 'all', label: 'All', count: allFlashQuestions.length },
          { key: 'Easy', label: 'Easy', count: easyCount, dot: '#5DCAA5' },
          { key: 'Medium', label: 'Medium', count: mediumCount, dot: '#EF9F27' },
          { key: 'Hard', label: 'Hard', count: hardCount, dot: '#F09595' },
        ];
        const diff = (activeQuestion?.difficulty || '').toLowerCase();
        const diffChip = diff === 'easy' ? 'bg-[#E1F5EE] text-[#085041]' : diff === 'hard' ? 'bg-[#FCEBEB] text-[#791F1F]' : 'bg-[#FAEEDA] text-[#633806]';
        const roundBtn = 'w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95';
        const scoreBtn = 'w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-white/25 bg-black/20 hover:bg-black/35 text-[#e3efe7] text-lg font-medium cursor-pointer active:scale-95 transition-all';
        return (
        <div
          className="fixed inset-0 w-full h-full text-[#e3efe7] z-[100] flex flex-col overflow-hidden animate-fade-in font-sans"
          id="panel-flashcards"
          style={{ background: 'linear-gradient(160deg, #1a3d2b 0%, #14532d 30%, #0f3d24 70%, #0a2e1b 100%)' }}
        >
          {/* Floating translucent header */}
          <div className="m-2 sm:m-3 px-3 sm:px-4 py-2 rounded-2xl bg-[#e3f1e8]/[0.12] backdrop-blur-xl border border-white/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="text-[15px] sm:text-base font-semibold text-[#f3e6c4] leading-tight">Retrieval Cards</div>
              {scopeLabel && <div className="text-[11px] sm:text-xs text-[#a9cbb8] truncate max-w-[60vw] sm:max-w-[320px]">{scopeLabel}</div>}
            </div>
            <div className="flex items-center gap-0.5 bg-black/25 rounded-full p-1 order-3 sm:order-none w-full sm:w-auto justify-center">
              {filterBtns.map(b => (
                <button
                  key={b.key}
                  onClick={() => selectFilter(b.key)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-[13px] whitespace-nowrap font-semibold transition-all cursor-pointer ${difficultyFilter === b.key ? 'bg-[#d4b06a] text-[#2a1f08] shadow' : 'text-[#cfe0d7] hover:text-white hover:bg-white/10'}`}
                  title={`Show ${b.label.toLowerCase()} questions`}
                >
                  {b.dot && <span className="w-2 h-2 rounded-full" style={{ background: b.dot }} />}
                  {b.label} <span className="opacity-70">{b.count}</span>
                </button>
              ))}
            </div>
            <button id="close-flash" onClick={closeActivePanel} className="w-9 h-9 rounded-full border border-white/25 bg-black/20 hover:bg-rose-600 hover:border-rose-500 text-[#e3efe7] flex items-center justify-center transition-all cursor-pointer" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-6 pb-4">
            {activeQuestion ? (
              <div className="max-w-5xl mx-auto w-full flex flex-col gap-3 sm:gap-4 pt-1">
                {/* Progress */}
                <div className="flex items-center gap-3 px-1 sm:px-16">
                  <div className="flex-1 h-1.5 bg-white/[0.12] rounded-full overflow-hidden">
                    <div className="h-full bg-[#d4b06a] rounded-full transition-all duration-300" style={{ width: `${total ? Math.round((pos / total) * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-[#cfe0d7] tabular-nums">{pos} / {total}</span>
                </div>

                {/* Card with arrows */}
                <div className="flex items-center gap-1.5 sm:gap-4">
                  <button
                    id="btn-prev-card"
                    onClick={() => { setCurrentQuestionIdx(p => (p - 1 + total) % total); setIsFlipped(false); }}
                    className={`${roundBtn} border border-white/25 bg-black/20 hover:bg-black/35 text-[#e3efe7]`}
                    title="Previous (←)"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <div className="flex-1 min-w-0" style={{ perspective: '1400px' }}>
                    <div
                      id="flash-deck-card"
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="relative w-full cursor-pointer select-none"
                      style={{ height: 'min(56vh, 520px)', minHeight: '240px', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)', transform: isFlipped ? 'rotateY(180deg)' : 'none' }}
                    >
                      {/* Front: question */}
                      <div className="absolute inset-0 rounded-2xl bg-[#fbf8f1] text-[#1b2b25] shadow-2xl shadow-black/30 flex flex-col p-4 sm:p-7" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                        <div className="flex justify-between items-center shrink-0">
                          <span className="text-[11px] sm:text-xs font-semibold tracking-[0.14em] text-[#3d6354]">QUESTION</span>
                          {activeQuestion.difficulty && <span className={`px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold ${diffChip}`}>{activeQuestion.difficulty}</span>}
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0 my-3 flex">
                          <div className="m-auto w-full text-center font-serif text-xl sm:text-[26px] leading-relaxed">
                            <FlashcardContent contentText={activeQuestion.question} isFlipped={false} />
                          </div>
                        </div>
                        <div className="text-center text-[11px] sm:text-xs text-[#6b8a7c] flex items-center justify-center gap-1.5 shrink-0">
                          <RotateCcw className="w-3.5 h-3.5" /> Tap to reveal answer
                        </div>
                      </div>
                      {/* Back: answer */}
                      <div className="absolute inset-0 rounded-2xl bg-[#f6ecd2] text-[#2a1f08] shadow-2xl shadow-black/30 border-t-[5px] border-[#b8923f] flex flex-col p-4 sm:p-7" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                        <div className="text-[11px] sm:text-xs font-semibold tracking-[0.14em] text-[#854F0B] shrink-0">ANSWER</div>
                        <div className="flex-1 overflow-y-auto min-h-0 my-3 flex">
                          <div className="my-auto w-full text-lg sm:text-[22px] leading-relaxed">
                            <FlashcardContent contentText={activeQuestion.answer} isFlipped={true} />
                          </div>
                        </div>
                        <div className="text-center text-[11px] sm:text-xs text-[#854F0B] flex items-center justify-center gap-1.5 shrink-0">
                          <RotateCcw className="w-3.5 h-3.5" /> Tap to see question
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    id="btn-next-card"
                    onClick={() => { setCurrentQuestionIdx(p => (p + 1) % total); setIsFlipped(false); }}
                    className={`${roundBtn} bg-[#d4b06a] hover:bg-[#e0bf7c] text-[#2a1f08] shadow-lg`}
                    title="Next (→)"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Team arena */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:px-16" id="classroom-arena-scores">
                  <div className="rounded-2xl px-3 sm:px-5 py-2.5 flex items-center justify-between bg-[#378ADD]/[0.18] border border-[#85B7EB]/40">
                    <div>
                      <div className="text-[11px] sm:text-xs font-semibold text-[#B5D4F4] tracking-wide">Team A</div>
                      <div className="text-3xl sm:text-4xl font-bold text-[#E6F1FB] leading-tight tabular-nums">{scoreTeamA}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button id="score-ta-down" onClick={(e) => { e.stopPropagation(); setScoreTeamA(Math.max(0, scoreTeamA - 1)); }} className={scoreBtn}>−</button>
                      <button id="score-ta-up" onClick={(e) => { e.stopPropagation(); setScoreTeamA(scoreTeamA + 1); }} className={scoreBtn}>+</button>
                    </div>
                  </div>
                  <div className="rounded-2xl px-3 sm:px-5 py-2.5 flex items-center justify-between bg-[#d4b06a]/[0.18] border border-[#d4b06a]/45">
                    <div>
                      <div className="text-[11px] sm:text-xs font-semibold text-[#FAC775] tracking-wide">Team B</div>
                      <div className="text-3xl sm:text-4xl font-bold text-[#FAEEDA] leading-tight tabular-nums">{scoreTeamB}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button id="score-tb-down" onClick={(e) => { e.stopPropagation(); setScoreTeamB(Math.max(0, scoreTeamB - 1)); }} className={scoreBtn}>−</button>
                      <button id="score-tb-up" onClick={(e) => { e.stopPropagation(); setScoreTeamB(scoreTeamB + 1); }} className={scoreBtn}>+</button>
                    </div>
                  </div>
                </div>

                {/* Quiet tools */}
                <div className="flex items-center justify-center gap-5 text-xs sm:text-[13px] text-[#a9cbb8]">
                  <button
                    onClick={() => {
                      const n = filteredFlashQuestions.length;
                      const order = Array.from({ length: n }, (_, k) => k);
                      for (let k = n - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
                      setFlashShuffleOrder(order); setCurrentQuestionIdx(0); setIsFlipped(false);
                    }}
                    className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                    title="Shuffle cards"
                  >
                    <Shuffle className="w-4 h-4" /> Shuffle
                  </button>
                  <button
                    id="btn-reset-flash-scores"
                    onClick={() => { setScoreTeamA(0); setScoreTeamB(0); setCurrentQuestionIdx(0); setIsFlipped(false); setFlashShuffleOrder(null); }}
                    className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                    title="Reset scores and deck"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                  <span className="hidden md:flex items-center gap-1.5 text-[#a9cbb8]/80">← → move · Space flips</span>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-4 text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-[#d4b06a]/15 border border-[#d4b06a]/30 flex items-center justify-center text-[#d4b06a]">
                  <Filter className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-lg font-semibold text-[#f3e6c4]">
                    No {difficultyFilter !== 'all' ? difficultyFilter.toLowerCase() : ''} questions yet
                  </h3>
                  <p className="text-sm text-[#a9cbb8] leading-relaxed">
                    {difficultyFilter !== 'all'
                      ? `This lesson has no ${difficultyFilter.toLowerCase()} retrieval questions.`
                      : 'This lesson has no retrieval questions.'}
                  </p>
                </div>
                {difficultyFilter !== 'all' && allFlashQuestions.length > 0 && (
                  <button
                    onClick={() => selectFilter('all')}
                    className="px-5 py-2 bg-[#d4b06a] text-[#2a1f08] hover:bg-[#e0bf7c] font-semibold rounded-full text-sm transition-all cursor-pointer shadow-md"
                  >
                    Show all questions ({allFlashQuestions.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* 3. ACTIVE CLASSROOM QUESTIONS LIST PANEL */}
      {activePanel === 'notes' && (() => {
        const sourceOptions = getQuestionSourceOptions();
        const selectedSources = getEffectiveQuestionSources();
        const visibleQs = getVisibleLessonQuestions();
        const allQs = getLessonQuestions();
        const isAccountancyList = allQs.some(q => Boolean(q) && typeof q !== 'string' && (q.displayMode === 'accountancy_tabs' || Boolean(q.tabs && q.tabs.length > 0)));
        const anyAnswer = visibleQs.some(q => Boolean(q) && typeof q !== 'string' && Boolean(q.answerText || q.answerImage));
        const scopeLabel = externalTopicModal?.topic?.title || currentLesson?.title || '';
        const iconBtn = 'w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0';
        return (
        <div className="fixed inset-0 w-full h-full bg-[#5f7a68] text-[#f2f5f0] z-[100] flex flex-col overflow-hidden animate-fade-in font-sans" id="panel-classroom-questions">

          <ScribbleOverlay
            lessonId={`questions-${currentLesson?.id || 'default'}`}
            isDrawingMode={isListDrawingMode}
            onStrokeSaved={() => {}}
            selectedColor={qSelectedColor}
            isHighlighter={qIsHighlighter}
          />

          {/* Floating translucent header with sources */}
          <div className="m-2 sm:m-3 px-3 sm:px-4 py-2 rounded-2xl bg-white/[0.12] backdrop-blur-xl border border-white/25 flex flex-wrap items-center gap-x-3 gap-y-2 shrink-0 relative z-50 pointer-events-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#c8664a] text-white font-bold flex items-center justify-center select-none shrink-0">Q</div>
              <div className="min-w-0">
                <div className="text-[15px] sm:text-base font-semibold text-white leading-tight">Extra Questions</div>
                <div className="text-[11px] sm:text-xs text-[#dfe8e0] truncate max-w-[60vw] sm:max-w-[380px]">
                  {scopeLabel ? `${scopeLabel} · ` : ''}{visibleQs.length} question{visibleQs.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {sourceOptions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap order-3 lg:order-none w-full lg:w-auto lg:flex-1 lg:justify-center" id="question-source-filter">
                <span className="text-[11px] sm:text-xs text-[#dfe8e0] mr-0.5">Source</span>
                {sourceOptions.map(opt => {
                  const checked = selectedSources.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggleQuestionSource(opt.key)}
                      aria-pressed={checked}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs sm:text-[13px] font-semibold transition-all cursor-pointer select-none ${
                        checked ? 'bg-[#c8664a] border-[#c8664a] text-white shadow-sm' : 'border-white/30 text-[#dfe8e0] hover:bg-white/10'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                      {opt.label} <span className="opacity-75">{opt.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {anyAnswer && (
                <button
                  onClick={() => setRevealAllAnswers(prev => ({ open: !prev.open, nonce: prev.nonce + 1 }))}
                  className="hidden sm:flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#f2f5f0] hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-all cursor-pointer"
                  title={revealAllAnswers.open ? 'Hide all answers' : 'Show all answers'}
                >
                  {revealAllAnswers.open ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {revealAllAnswers.open ? 'Hide all answers' : 'Show all answers'}
                </button>
              )}

              {isListDrawingMode && (
                <div className="flex items-center gap-1.5 bg-black/20 py-1 px-2 rounded-full animate-fade-in">
                  {PALETTE_COLORS.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => { setQSelectedColor(c.hex); setQIsHighlighter(false); }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${qSelectedColor === c.hex && !qIsHighlighter ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                  <div className="w-px h-5 bg-white/25 mx-1" />
                  <button onClick={() => setQIsHighlighter(!qIsHighlighter)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${qIsHighlighter ? 'bg-[#c8664a] text-white' : 'text-[#dfe8e0] hover:text-white'}`} title="Highlighter">
                    <Palette className="w-4 h-4" />
                  </button>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('classroom-canvas-undo'))} className="w-7 h-7 rounded-full flex items-center justify-center text-[#dfe8e0] hover:text-white hover:bg-white/10 transition-all cursor-pointer" title="Undo">
                    <Undo className="w-4 h-4" />
                  </button>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('classroom-canvas-clear'))} className="w-7 h-7 rounded-full flex items-center justify-center text-[#ffd2c4] hover:bg-[#a8492e]/40 transition-all cursor-pointer" title="Clear all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!isAccountancyList && (
                <button
                  onClick={() => setIsListDrawingMode(!isListDrawingMode)}
                  className={`${iconBtn} ${isListDrawingMode ? 'bg-[#c8664a] border-[#c8664a] text-white' : 'border-white/30 bg-black/15 text-[#f2f5f0] hover:bg-black/25'}`}
                  title={isListDrawingMode ? 'Stop drawing' : 'Draw on questions'}
                >
                  <Palette className="w-4 h-4" />
                </button>
              )}

              <button
                id="close-questions"
                onClick={closeActivePanel}
                className={`${iconBtn} border-white/30 bg-black/15 text-[#f2f5f0] hover:bg-[#a8492e] hover:border-[#a8492e]`}
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-3 sm:px-6 md:px-8 flex-1 flex flex-col min-h-0 relative z-10 pointer-events-none">
            <div className={`flex-1 overflow-y-auto space-y-4 sm:space-y-5 pr-1 pb-6 max-w-6xl w-full mx-auto ${isListDrawingMode ? 'pointer-events-none' : 'pointer-events-auto'}`}>
              {allQs.length > 0 && visibleQs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
                    <Filter className="w-8 h-8 text-white/90" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">No questions from the selected source</h3>
                  <p className="text-sm text-[#dfe8e0] max-w-sm">Tick one or more sources at the top to see their questions.</p>
                </div>
              ) : allQs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-white/90" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">No questions yet</h3>
                  <p className="text-sm text-[#dfe8e0] max-w-sm">This lesson has no extra questions saved.</p>
                </div>
              ) : (
                <QuestionListErrorBoundary>
                  {visibleQs.map((qItem, index) => (
                    <QuestionItem
                      key={`${typeof qItem === 'string' ? 's' : (qItem.id || 'q')}-${index}`}
                      item={qItem}
                      isOnline={isOnline}
                      questionNumber={index + 1}
                      revealAll={revealAllAnswers}
                      onOpenAccountancyWorkspace={handleOpenAccountancyWorkspace}
                    />
                  ))}
                </QuestionListErrorBoundary>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {accountancyQuestion && (
        <AccountancyQuestionModal
          question={accountancyQuestion}
          isOpen={isAccountancyModalOpen}
          onClose={() => {
            setIsAccountancyModalOpen(false);
            setAccountancyQuestion(null);
            setActivePanel('notes');
          }}
        />
      )}
    </>
  );
}
