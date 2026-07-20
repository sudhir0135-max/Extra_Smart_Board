/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, HelpCircle, FileText, Move, Maximize, Video, Check, RotateCcw, AlertTriangle, Eye, EyeOff, X, Palette, Sparkles, Undo, Trash2, WifiOff } from 'lucide-react';
import { Book, AcademicSubject, Lesson, FlashQuestion, Note, InquiryQuestionObj } from '../types';
import { renderMathInRawHtml } from '../lib/mathPreprocessor';
import 'katex/dist/katex.min.css';
import ScribbleOverlay from './ScribbleOverlay';

interface FloatingButtonProps {
  currentLesson: Lesson | null;
  onToggleButtonDraw: () => void;
  isDrawingEnabled: boolean;
  onAddNote: (noteText: string) => void;
  savedNote: Note | null;
  addToast?: (text: string, type?: 'info' | 'success' | 'warn' | 'cloud') => void;
  globalLogo?: string | null;
}

const QuestionContent = React.memo(({ item }: { item: string | InquiryQuestionObj }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isAdvanced = typeof item !== 'string';
  const image = isAdvanced ? item.image : null;
  const pos = isAdvanced ? item.imagePosition || 'right' : 'right';



  return (
    <div className="flex-1 min-w-0 pointer-events-auto" ref={contentRef}>
      {image && pos === 'center' && (
        <div className="w-full flex justify-center mb-6">
          <img src={image} className="w-[80%] rounded-xl object-contain border border-slate-800" alt="Question" />
        </div>
      )}
      
      <div className="flex gap-6 items-start">
        {image && pos === 'left' && (
          <img src={image} className="w-[30%] shrink-0 rounded-xl object-contain border border-slate-800" alt="Question" />
        )}
        
        <div className="flex-1 font-medium">
          {isAdvanced ? (
            <div className="reader-content prose prose-invert prose-emerald max-w-none prose-p:my-2 prose-headings:my-3 prose-img:rounded-xl" dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(item.text) }} />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(item) }} />
          )}
        </div>

        {image && pos === 'right' && (
          <img src={image} className="w-[30%] shrink-0 rounded-xl object-contain border border-slate-800" alt="Question" />
        )}
      </div>
    </div>
  );
});

const FlashcardContent = React.memo(({ contentText, isFlipped }: { contentText: string, isFlipped: boolean }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={contentRef} className="flex items-start gap-4">
      <div className={`font-black shrink-0 mt-2 select-none ${isFlipped ? 'text-slate-900/60' : 'text-amber-500/70'}`}>
        {isFlipped ? 'A.-' : 'Q.-'}
      </div>
      <div 
        className={`flex-1 reader-content prose max-w-none prose-p:my-2 prose-headings:my-3 prose-img:rounded-xl ${isFlipped ? 'font-extrabold text-shadow-sm text-slate-950 prose-p:text-slate-950 prose-headings:text-slate-950 prose-strong:text-slate-950 prose-em:text-slate-950' : 'prose-invert prose-emerald font-semibold text-slate-100 prose-p:text-slate-100 prose-headings:text-slate-100'}`}
        dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(contentText) }} 
      />
    </div>
  );
});

function QuestionItem({ item }: { item: string | InquiryQuestionObj }) {
  const [minHeight, setMinHeight] = useState<number>(0);
  const dragStartRef = useRef<{ y: number, startHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
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

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="group relative p-6 md:p-8 rounded-xl border border-slate-900 bg-slate-950 text-slate-300 text-[16px] lg:text-[17px] min-[3840px]:text-[34px] leading-relaxed select-none shadow-md"
      style={{ minHeight: minHeight > 0 ? `${minHeight}px` : undefined }}
    >
      <div className="flex justify-between items-start gap-4">
        <QuestionContent item={item} />
      </div>

      {/* Resize Handle at Bottom Left */}
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute bottom-0 left-0 w-12 h-12 flex items-end justify-start p-2 cursor-ns-resize opacity-20 hover:opacity-100 transition-opacity pointer-events-auto touch-none"
        title="Drag to resize question area"
      >
        <Move className="w-5 h-5 text-emerald-400 rotate-45" />
      </div>
    </div>
  );
}

// Mock videos removed as per user request. Videos are now entirely dynamic based on Firebase lessons.

export default function FloatingButton({
  currentLesson,
  onToggleButtonDraw,
  isDrawingEnabled,
  onAddNote,
  savedNote,
  addToast,
  globalLogo,
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

  // Full Screen Question Drawing State
  const [isListDrawingMode, setIsListDrawingMode] = useState(false);
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

  // Dynamic videos list based on currentLesson
  const activeVideos = React.useMemo(() => {
    if (!currentLesson) return [];
    
    // Combine new array and legacy single URL
    const urlsToProcess = currentLesson.videoUrls && currentLesson.videoUrls.length > 0 
      ? currentLesson.videoUrls 
      : (currentLesson.videoUrl ? [currentLesson.videoUrl] : []);

    return urlsToProcess.map((url, idx) => {
      // Try to extract youtube ID, or just use the raw URL if it's already an embed
      const youtubeIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      const youtubeId = youtubeIdMatch ? youtubeIdMatch[1] : '';
      
      return {
        id: `lesson-video-${idx}`,
        title: currentLesson.title + (urlsToProcess.length > 1 ? ` (Part ${idx + 1})` : ' (Active Chapter)'),
        channel: 'Chapter Lecture',
        youtubeId: youtubeId,
        rawUrl: url, // Use this directly if youtubeId extraction fails
        duration: urlsToProcess.length > 1 ? `Part ${idx + 1}` : 'Current'
      };
    });
  }, [currentLesson]);

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
      setActivePanel(null);
    } else {
      setActivePanel(panel);
    }
  };

  const handleSaveNote = () => {
    onAddNote(localNote);
  };

  const getLessonQuestions = (): (string | InquiryQuestionObj)[] => {
    return currentLesson?.inquiryQuestions || [];
  };

  const hasFlash = currentLesson?.flashQuestions && currentLesson.flashQuestions.length > 0;
  const activeQuestion: FlashQuestion | null = hasFlash
    ? currentLesson!.flashQuestions[currentQuestionIdx % currentLesson!.flashQuestions.length]
    : null;

  const isOnLeft = position.x >= 50;

  return (
    <>
      {/* Draggable FAB Container Layer */}
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
              globalLogo ? (
                <img src={globalLogo} alt="Logo" className="w-full h-full object-cover rounded-full pointer-events-none" />
              ) : (
                <Sparkles className="w-7 h-7" />
              )
            )}
          </button>
        </div>
      </div>

      {/* RENDER DYNAMIC ACTIVE CONTROL PANELS */}

      {/* 1. LECTURE VIDEO PANEL */}
      {activePanel === 'video' && (
        <div 
          id="youtube-dashboard-modal" 
          className="fixed inset-0 bg-[#030712]/75 backdrop-blur-md z-50 flex flex-col animate-fade-in"
        >
          {/* Main Content box containing several youtube videos with dynamic translucent border */}
          <div 
            className="flex-1 w-full bg-slate-950/95 rounded-xl flex flex-col relative overflow-hidden text-slate-100"
            style={{ 
              border: `${borderWidth}px solid rgba(30, 41, 59, 0.65)`, 
            }}
          >
            {/* ── OFFLINE GATE: replaces entire panel when no internet ── */}
            {!isOnline ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 select-none">
                {/* Pulsing wifi-off icon */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
                  <div className="relative w-24 h-24 rounded-full bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-center">
                    <WifiOff className="w-10 h-10 text-rose-400" />
                  </div>
                </div>

                {/* Message */}
                <div className="text-center space-y-2">
                  <h2 className="text-white font-black text-2xl tracking-tight">
                    Internet Connection Required
                  </h2>
                  <p className="text-slate-400 text-sm font-mono max-w-xs leading-relaxed">
                    Video lectures need an active internet connection to stream from YouTube.
                    Please reconnect and try again.
                  </p>
                </div>

                {/* Status pill */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  <span className="text-rose-400 text-xs font-bold font-mono uppercase tracking-widest">
                    Offline
                  </span>
                </div>
              </div>
            ) : maximizedVideoId ? (
              (() => {
                const activeVid = activeVideos.find(v => v.id === maximizedVideoId);
                if (!activeVid) return null;
                return (
                  <div className="h-full flex flex-col p-4 md:p-6 space-y-4 animate-fade-in">
                    {/* Full screen video header inside the borders */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
                      <div>
                        <div className="text-[10px] uppercase tracking-[3px] text-amber-400 font-mono font-bold">
                          Now Playing • Full Screen Mode
                        </div>
                        <h3 className="font-sans text-xs md:text-base font-extrabold text-slate-100 mt-0.5 max-w-[200px] md:max-w-none truncate md:normal-case">
                          {activeVid.title}
                        </h3>
                      </div>
                      <button
                        onClick={() => setMaximizedVideoId(null)}
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-amber-400 hover:text-amber-300 font-sans text-[10px] md:text-[11px] font-bold uppercase tracking-wider px-2 py-1 md:px-3.5 md:py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 shadow-md flex-shrink-0"
                        title="Back to grid"
                      >
                        <RotateCcw className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        <span className="hidden sm:inline">Back to </span>Library
                      </button>
                    </div>

                    {/* Full screen video display */}
                    <div className="flex-1 min-h-0 relative bg-black rounded-lg overflow-hidden border border-slate-900 shadow-2xl flex items-center justify-center">
                      {!isOnline ? (
                        <div className="flex flex-col items-center justify-center text-slate-500 animate-pulse">
                          <WifiOff className="w-12 h-12 mb-4 text-rose-500" />
                          <p className="text-sm font-bold font-mono">No Internet Connection</p>
                          <p className="text-[10px] mt-2">Cannot load YouTube video stream.</p>
                        </div>
                      ) : (
                        <iframe
                          src={activeVid.youtubeId ? `https://www.youtube.com/embed/${activeVid.youtubeId}?autoplay=1` : activeVid.rawUrl}
                          title={activeVid.title}
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Scrollable contents within the bordered frame showing the library */
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 no-scrollbar">
                {activeVideos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                    <Video className="w-12 h-12 mb-4 text-slate-700/50" />
                    <p className="text-sm font-bold font-mono uppercase tracking-widest text-slate-400">No Video Available for This Lesson</p>
                    <p className="text-[10px] mt-2 max-w-xs text-center leading-relaxed">The instructor has not attached a video lecture URL to this specific chapter. Please check your reading materials.</p>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-slate-800 pb-2 mb-2 flex justify-between items-end">
                      <span className="hidden md:inline font-mono text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                        {activeVideos.length} active lecture{activeVideos.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5">
                      {activeVideos.map((vid) => (
                        <div 
                          key={vid.id}
                          onClick={() => setMaximizedVideoId(vid.id)}
                          className="bg-slate-900/50 border border-slate-850 rounded-lg md:rounded-xl p-1.5 md:p-2.5 flex flex-col gap-1 md:gap-2 group hover:border-amber-400/40 transition-all duration-300 cursor-pointer shadow-md select-none"
                        >
                          <div className="relative aspect-video bg-black rounded md:rounded-lg overflow-hidden border border-slate-950 flex items-center justify-center">
                            {/* Static thumbnail cover / embedded loader so we can intercept mouse clicks perfectly */}
                            {!isOnline ? (
                              <div className="flex flex-col items-center justify-center text-slate-700">
                                <WifiOff className="w-6 h-6 mb-1 text-rose-500/50" />
                                <span className="text-[8px] uppercase tracking-widest font-bold">Offline</span>
                              </div>
                            ) : (
                              <>
                                <iframe
                                  src={vid.youtubeId ? `https://www.youtube.com/embed/${vid.youtubeId}` : vid.rawUrl}
                                  title={vid.title}
                                  className="absolute inset-0 w-full h-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                                  frameBorder="0"
                                ></iframe>
                                <div className="absolute inset-0 bg-slate-950/50 group-hover:bg-slate-950/20 flex items-center justify-center transition-all">
                                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-amber-400/90 text-slate-950 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-all shadow-md md:shadow-lg shadow-amber-500/20">
                                    <Play className="w-3.5 h-3.5 md:w-5 md:h-5 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 px-0.5">
                            <div className="flex items-center justify-between text-[7px] md:text-[9px] font-mono text-amber-400/80 uppercase tracking-tight">
                              <span>{vid.channel}</span>
                              <span>{vid.duration}</span>
                            </div>
                            <h4 className="text-[10px] md:text-xs font-bold leading-tight line-clamp-2 md:line-clamp-1 group-hover:text-amber-400 transition-colors">
                              {vid.title}
                            </h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Close button placed at the bottom-left of the translucent wide border */}
          <button
            id="close-video-modal"
            onClick={() => {
              setActivePanel(null);
              setMaximizedVideoId(null);
            }}
            className="absolute bottom-[20px] left-[20px] md:bottom-[40px] md:left-[40px] z-55 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white p-3 md:p-4 rounded-lg md:rounded-xl transition-all duration-200 cursor-pointer shadow-xl shadow-rose-600/30 flex items-center justify-center pointer-events-auto"
            title="Close Library"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      )}      {/* 2. FLASH QUESTIONS ACTIVE RETRIEVAL CARDS */}
      {activePanel === 'questions' && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[95vw] sm:w-[800px] max-h-[85vh] bg-[#0b0f19] text-slate-100 rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-slate-800/80 z-[100] flex flex-col overflow-hidden animate-fade-in font-sans" id="panel-flashcards">
          <div className="bg-slate-950 p-4 px-6 flex items-center justify-between border-b border-slate-900 shrink-0">
            <div className="flex items-center gap-2 text-amber-500 font-bold">
              <HelpCircle className="w-4 h-4" />
              <span className="font-bold uppercase text-[10px] tracking-widest font-sans">Classroom Retrieval Cards</span>
            </div>
            <button id="close-flash" onClick={() => setActivePanel(null)} className="hover:text-amber-400 text-slate-400 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 sm:p-4 flex-1 overflow-y-auto min-h-0">
            {activeQuestion ? (
              <div className="space-y-3">
                {/* Visual Flipped Deck and question detail */}
                <div
                  id="flash-deck-card"
                  onClick={() => setIsFlipped(!isFlipped)}
                  className={`w-full max-w-2xl mx-auto rounded-xl relative cursor-pointer select-none transition-all duration-300 border p-3 sm:p-4 flex flex-col justify-between ${
                    isFlipped
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xl text-center scale-[1.01]'
                      : 'bg-slate-900 border-slate-800 text-slate-100 hover:border-slate-700'
                  }`}
                  style={{ minHeight: '120px', maxHeight: '38vh' }}
                >
                  {/* Status header */}
                  <div className="flex justify-between items-center text-[8px] font-sans font-bold uppercase tracking-widest opacity-70 shrink-0">
                    <span>Card {currentQuestionIdx + 1} of {currentLesson?.flashQuestions.length}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${activeQuestion.difficulty === 'Easy' ? 'bg-emerald-500/20 text-emerald-400' : activeQuestion.difficulty === 'Medium' ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-400'}`}>
                      {activeQuestion.difficulty}
                    </span>
                  </div>

                  {/* Body textual block */}
                  <div className="my-2 font-sans text-base sm:text-xl leading-relaxed overflow-y-auto flex-1">
                    <FlashcardContent 
                      contentText={isFlipped ? activeQuestion.answer : activeQuestion.question}
                      isFlipped={isFlipped}
                    />
                  </div>

                  {/* Flip Prompt Footer */}
                  <div className="text-[8px] font-sans font-bold text-center uppercase tracking-widest opacity-60 shrink-0">
                    {isFlipped ? 'Reveal active question prompts' : 'Tap cardboard to flip and reveal answer keys'}
                  </div>
                </div>

                {/* Live scoreboard co-op multi-team tracker */}
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 flex items-center justify-between max-w-2xl mx-auto w-full" id="classroom-arena-scores">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-sans uppercase font-bold text-sky-400 tracking-wider">Class Team A</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button id="score-ta-down" onClick={(e) => { e.stopPropagation(); setScoreTeamA(Math.max(0, scoreTeamA - 1)); }} className="w-5.5 h-5.5 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 hover:bg-slate-800 cursor-pointer">-</button>
                      <span className="text-sm font-sans font-bold text-sky-400 w-5 text-center">{scoreTeamA}</span>
                      <button id="score-ta-up" onClick={(e) => { e.stopPropagation(); setScoreTeamA(scoreTeamA + 1); }} className="w-5.5 h-5.5 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 hover:bg-slate-800 cursor-pointer">+</button>
                    </div>
                  </div>

                  <span className="text-[9px] font-sans uppercase font-bold text-slate-500 tracking-widest text-shadow">Arena Score</span>

                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-sans uppercase font-bold text-amber-400 tracking-wider">Class Team B</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button id="score-tb-down" onClick={(e) => { e.stopPropagation(); setScoreTeamB(Math.max(0, scoreTeamB - 1)); }} className="w-5.5 h-5.5 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 hover:bg-slate-800 cursor-pointer">-</button>
                      <span className="text-sm font-sans font-bold text-amber-400 w-5 text-center">{scoreTeamB}</span>
                      <button id="score-tb-up" onClick={(e) => { e.stopPropagation(); setScoreTeamB(scoreTeamB + 1); }} className="w-5.5 h-5.5 flex items-center justify-center rounded bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 hover:bg-slate-800 cursor-pointer">+</button>
                    </div>
                  </div>
                </div>

                {/* Card controllers (Next, Reset) */}
                <div className="flex items-center justify-between font-sans border-t border-slate-850 pt-3 max-w-2xl mx-auto w-full">
                  <button
                    id="close-flashcards-bottom-left"
                    onClick={() => setActivePanel(null)}
                    className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-[10px] font-sans font-bold uppercase px-3.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" /> Close
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      id="btn-prev-card"
                      disabled={currentQuestionIdx === 0}
                      onClick={() => {
                        setCurrentQuestionIdx(p => p - 1);
                        setIsFlipped(false);
                      }}
                      className="text-[10px] font-sans font-bold uppercase px-3 py-1.5 border border-slate-800 rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-40 cursor-pointer text-slate-300"
                    >
                      Previous
                    </button>

                    <button
                      id="btn-reset-flash-scores"
                      onClick={() => {
                        setScoreTeamA(0);
                        setScoreTeamB(0);
                        setCurrentQuestionIdx(0);
                        setIsFlipped(false);
                      }}
                      className="p-1.5 rounded hover:bg-slate-900 bg-transparent text-slate-500 hover:text-slate-350 transition-colors cursor-pointer"
                      title="Reset deck parameters"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      id="btn-next-card"
                      onClick={() => {
                        setCurrentQuestionIdx(p => (p + 1) % currentLesson!.flashQuestions.length);
                        setIsFlipped(false);
                      }}
                      className="text-[10px] font-sans font-bold uppercase px-4 py-1.5 bg-amber-400 hover:bg-amber-350 text-slate-950 rounded-lg transition-colors cursor-pointer animate-pulse"
                    >
                      Next Deck
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm italic opacity-50 space-y-4 flex flex-col justify-center items-start">
                <div className="w-full flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 opacity-60" />
                  <p>No interactive recall cards are mapped onto this chapter.</p>
                </div>
                <div className="border-t border-slate-850 pt-3 w-full flex justify-start">
                  <button
                    id="close-flashcards-bottom-left-placeholder"
                    onClick={() => setActivePanel(null)}
                    className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-[10px] font-sans font-bold uppercase px-3.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md"
                  >
                    <X className="w-3.5 h-3.5" /> Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ACTIVE CLASSROOM QUESTIONS LIST PANEL */}
      {activePanel === 'notes' && (
        <div className="fixed top-[72px] left-0 right-0 bottom-0 bg-[#0b0f19] text-slate-100 z-[100] flex flex-col overflow-hidden animate-fade-in font-sans border-t border-slate-800/80 shadow-[0_-10px_50px_rgba(0,0,0,0.8)]" id="panel-classroom-questions">
          
          <ScribbleOverlay 
            lessonId={`questions-${currentLesson?.id || 'default'}`}
            isDrawingMode={isListDrawingMode}
            onStrokeSaved={() => {}}
            selectedColor={qSelectedColor}
            isHighlighter={qIsHighlighter}
          />
          
          <div className="bg-slate-950 py-2 px-6 flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-900 shadow-sm shrink-0 gap-2 relative z-50 pointer-events-auto">
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold shrink-0">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-extrabold select-none shadow-inner">Q</span>
              <span className="font-bold uppercase text-sm tracking-widest font-sans">Some Extra Questions from Lesson</span>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsListDrawingMode(!isListDrawingMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border ${
                  isListDrawingMode
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
                }`}
              >
                <Palette className="w-4 h-4" />
                {isListDrawingMode ? 'Drawing ON' : 'Enable Drawing'}
              </button>

              {isListDrawingMode && (
                <div className="flex items-center gap-2 bg-slate-900 p-1.5 px-3 rounded-lg border border-slate-800 animate-fade-in">
                  {PALETTE_COLORS.map(c => (
                    <button 
                      key={c.hex} 
                      onClick={() => { setQSelectedColor(c.hex); setQIsHighlighter(false); }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${qSelectedColor === c.hex && !qIsHighlighter ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent'}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                  <div className="w-px h-6 bg-slate-700 mx-2" />
                  <button 
                    onClick={() => setQIsHighlighter(!qIsHighlighter)}
                    className={`w-8 h-8 rounded flex items-center justify-center transition-all ${qIsHighlighter ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Highlighter"
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('classroom-canvas-undo'))}
                    className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
                    title="Undo"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('classroom-canvas-clear'))}
                    className="w-8 h-8 rounded flex items-center justify-center text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all ml-1"
                    title="Clear All"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button 
                id="close-questions" 
                onClick={() => {
                  setActivePanel(null);
                  setIsListDrawingMode(false);
                }} 
                className="w-10 h-10 md:w-12 md:h-12 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/25 hover:border-transparent text-rose-400 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 ml-2 md:ml-6"
                title="Close List"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 md:p-8 space-y-6 flex-1 flex flex-col min-h-0 pt-6 relative z-10 pointer-events-none">
            <div className={`flex-1 overflow-y-auto space-y-8 pr-2 pb-4 ${isListDrawingMode ? 'pointer-events-none' : 'pointer-events-auto'}`}>
              {getLessonQuestions().length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 opacity-80" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-300">No question available</h3>
                  <p className="text-sm text-slate-500 text-center max-w-sm">
                    There are no open-ended inquiry questions saved for this lesson.
                  </p>
                </div>
              ) : (
                getLessonQuestions().map((qItem, index) => (
                  <QuestionItem 
                    key={index}
                    item={qItem}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
