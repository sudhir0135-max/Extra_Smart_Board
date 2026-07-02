/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Book, Lesson, ThemeMode, OfflineAction } from '../types';
import { ChevronsLeft, ChevronsRight, FileText, BookOpen, Columns2 } from 'lucide-react';

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
  imageViewMode,
  setImageViewMode,
}: SidebarProps) {
  return (
    <div
      className={`h-full flex-shrink-0 bg-[#0c1220] border-r border-slate-900 flex flex-col overflow-hidden text-slate-200 select-none transition-all duration-300 ${
        isExpanded ? 'w-[260px]' : 'w-[72px]'
      }`}
      id="sidebar"
    >


      {/* Chapters / Lessons Content list container */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 cursor-pointer"
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
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border border-slate-900/40 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900/40 border-amber-400/40 text-yellow-300 font-bold shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-slate-900/20 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <span className="font-mono text-[10px] text-amber-500 font-extrabold mt-0.5">
                    {stepNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] leading-snug truncate">
                      {lesson.title}
                    </div>
                    {lesson.subtitle && (
                      <div className="text-[9px] text-slate-550 font-mono truncate mt-0.5">
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
                  className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-mono text-[11px] transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-black border border-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-100 hover:bg-slate-900/40 border border-slate-850'
                  }`}
                  title={lesson.title}
                >
                  {stepNumber}
                  {isActive && (
                    <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-slate-950 border border-amber-300" />
                  )}
                </button>
              );
            }
          })
        ) : (
          <div className="p-4 text-center text-slate-500 italic font-mono text-[10px] leading-relaxed" id="no-book-msg">
            {isExpanded ? 'Choose a textbook first.' : '•'}
          </div>
        )}
      </div>

      {/* Conditional Layout Toggles for Content-less lessons */}
      {isLessonContentLess && isExpanded && setImageViewMode && (
        <div className="p-3 border-t border-slate-800/50 flex flex-col gap-2 shrink-0">
          <span className="text-[9px] font-mono uppercase text-slate-500 font-bold text-center block">Image Layout</span>
          <div className="flex gap-2">
            <button
              onClick={() => setImageViewMode('single')}
              className={`flex-1 p-2 flex justify-center items-center rounded-lg border transition-all ${
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
              className={`flex-1 p-2 flex justify-center items-center rounded-lg border transition-all ${
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
      )}

    </div>
  );
}
