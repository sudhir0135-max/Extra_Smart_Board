/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Book, Lesson, ThemeMode, OfflineAction } from '../types';
import { ChevronsLeft, ChevronsRight, FileText, BookOpen, Columns2 } from 'lucide-react';
import { getChapterContentType } from '../lib/chapterContent';

interface SidebarProps {
  selectedBook: Book | null;
  activeLessonId: string | null;
  activeLesson: Lesson | null;
  onSelectLesson: (lessonId: string) => void;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  fontSizeScale: number;
  onFontSizeScaleChange: (scale: number) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  offlineQueue: OfflineAction[];
  onTriggerSync: () => void;
  isSyncing: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isLessonContentLess?: boolean;
  isPdfBook?: boolean;
  imageViewMode?: 'single' | 'two';
  setImageViewMode?: (mode: 'single' | 'two') => void;
}

export default function Sidebar({
  selectedBook,
  activeLessonId,
  activeLesson,
  onSelectLesson,
  isExpanded,
  onToggleExpand,
  isLessonContentLess,
  isPdfBook,
  imageViewMode,
  setImageViewMode,
}: SidebarProps) {
  // Image layout toggle is applicable ONLY for PDF books
  const isPdf = Boolean(
    isPdfBook ?? (
      selectedBook?.bookType === 'pdf' ||
      getChapterContentType(activeLesson) === 'pdf' ||
      (activeLesson?.pdfUrl && activeLesson.pdfUrl.trim().length > 0) ||
      (selectedBook?.lessons && selectedBook.lessons.some(l => (l.pdfUrl && l.pdfUrl.trim().length > 0) || l.contentType === 'pdf'))
    )
  );
  return (
    <div className="relative h-full flex-shrink-0 z-20" style={{ width: isExpanded ? '352px' : '64px' }}>
      <div
        className={`absolute top-0 left-0 h-full border-r border-[#2d6a4f] flex flex-col overflow-hidden text-[#e3efe7] select-none transition-all duration-300 shadow-2xl ${
          isExpanded ? 'w-[352px]' : 'w-[64px]'
        }`}
        // Same chalkboard green as the greenboard (BlackboardPanel), with its chalk grain
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='3'%3E%3Ccircle cx='1.5' cy='1.5' r='0.7' fill='rgba(255,255,255,0.025)'/%3E%3C/svg%3E"), linear-gradient(160deg, #1a3d2b 0%, #14532d 30%, #0f3d24 70%, #0a2e1b 100%)`,
        }}
        id="sidebar"
      >


      {/* Chapters / Lessons Content list container */}
      <div
        className={`flex-1 overflow-y-auto no-scrollbar space-y-3 cursor-pointer ${
          isExpanded ? 'px-3 pb-3 pt-[84px]' : 'pb-3 pt-[84px] px-1.5'
        }`}
        id="lessons-list"
        onClick={(e) => {
          if (!isExpanded) {
            onToggleExpand();
          } else if (e.target === e.currentTarget) {
            onToggleExpand();
          }
        }}
      >
        {selectedBook ? (
          selectedBook.lessons.map((lesson, idx) => {
            const isActive = lesson.id === activeLessonId;
            const stepNumber = String(idx + 1).padStart(2, '0');

            if (isExpanded) {
              return (
                <button
                  key={lesson.id}
                  id={`lesson-item-${lesson.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLesson(lesson.id);
                  }}
                  className={`w-full text-left flex items-start gap-3.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.07] border-[#d4b06a]/40 text-white font-semibold shadow-md'
                      : 'bg-transparent border-transparent hover:bg-white/[0.04] text-[#cfe0d7] hover:text-white'
                  }`}
                >
                  <span className="font-mono text-[14px] text-[#d4b06a] font-bold mt-0.5 flex-shrink-0">
                    {stepNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[17px] font-semibold leading-snug break-words">
                      {lesson.title}
                    </div>
                    {lesson.subtitle && (
                      <div className="text-[13px] text-[#a9cbb8] mt-1 leading-tight">
                        {lesson.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              );
            } else {
              // Compact, squeezed indicator badge list
              return (
                <button
                  key={lesson.id}
                  id={`lesson-item-compact-${lesson.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLesson(lesson.id);
                  }}
                  className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-mono text-[15.5px] font-bold shrink-0 transition-all cursor-pointer relative overflow-visible ${
                    isActive
                      ? 'bg-[#b8923f] text-[#0f1f1a] font-black border border-[#a07c30] shadow-md'
                      : 'bg-black/30 text-[#b7cfc2] hover:text-white hover:bg-black/40 border border-white/[0.1]'
                  }`}
                  title={lesson.title}
                >
                  <span className="leading-none text-center select-none">{stepNumber}</span>
                  {isActive && (
                    <span className="absolute -bottom-0.5 w-2 h-2 rounded-full bg-[#0f1f1a] border border-[#d4b06a]" />
                  )}
                </button>
              );
            }
          })
        ) : (
          <div className="p-4 text-center text-slate-500 italic font-mono text-xs leading-relaxed" id="no-book-msg">
            {isExpanded ? 'Choose a textbook first.' : '•'}
          </div>
        )}
      </div>

      {/* Image Layout Toggles (Applicable for PDF books only) */}
      {isPdf && setImageViewMode && (
        isExpanded ? (
          <div className="p-3 border-t border-white/[0.06] flex flex-col gap-2 shrink-0" id="image-layout-box">
            <span className="text-[9px] font-mono uppercase text-slate-500 font-bold text-center block">Image Layout</span>
            <div className="flex gap-2">
              <button
                onClick={() => setImageViewMode('single')}
                className={`flex-1 p-2 flex justify-center items-center rounded-lg border transition-all cursor-pointer ${
                  imageViewMode === 'single'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-md shadow-amber-900/20'
                    : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
                title="Single Page View (Stacked)"
              >
                <div className="flex flex-col gap-1 w-4">
                  <div className="w-full h-2 bg-current rounded-sm"></div>
                  <div className="w-full h-2 bg-current rounded-sm"></div>
                </div>
              </button>
              <button
                onClick={() => setImageViewMode('two')}
                className={`flex-1 p-2 flex justify-center items-center rounded-lg border transition-all cursor-pointer ${
                  imageViewMode === 'two'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-md shadow-amber-900/20'
                    : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
                title="Two Page View (Side-by-side)"
              >
                <div className="flex gap-1 h-5 w-5">
                  <div className="w-1/2 h-full bg-current rounded-sm"></div>
                  <div className="w-1/2 h-full bg-current rounded-sm"></div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2.5 px-1 border-t border-white/[0.06] flex flex-col items-center gap-1.5 shrink-0" id="image-layout-box-compact">
            <button
              onClick={() => setImageViewMode(imageViewMode === 'single' ? 'two' : 'single')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                imageViewMode === 'two'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-md shadow-amber-900/20'
                  : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
              }`}
              title={imageViewMode === 'single' ? 'Switch to Two Page View (Side-by-side)' : 'Switch to Single Page View (Stacked)'}
            >
              {imageViewMode === 'two' ? (
                <div className="flex gap-1 h-4 w-4">
                  <div className="w-1/2 h-full bg-current rounded-sm"></div>
                  <div className="w-1/2 h-full bg-current rounded-sm"></div>
                </div>
              ) : (
                <div className="flex flex-col gap-1 w-3.5">
                  <div className="w-full h-1.5 bg-current rounded-sm"></div>
                  <div className="w-full h-1.5 bg-current rounded-sm"></div>
                </div>
              )}
            </button>
          </div>
        )
      )}

    </div>
    </div>
  );
}
