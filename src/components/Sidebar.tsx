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
  pdfViewMode: 'single' | 'double';
  onPdfViewModeChange: (mode: 'single' | 'double') => void;
}

export default function Sidebar({
  selectedBook,
  activeLessonId,
  activeLesson,
  onSelectLesson,
  isExpanded,
  onToggleExpand,
  pdfViewMode,
  onPdfViewModeChange,
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

      {/* PDF View Mode Toggle — only visible when active lesson has a PDF */}
      {activeLesson?.pdfUrl && (
        <div className={`border-t border-slate-800/80 p-3 flex-shrink-0 ${
          isExpanded ? 'flex flex-col gap-2' : 'flex flex-col items-center gap-2'
        }`}>
          {isExpanded && (
            <span className="text-[8px] uppercase font-mono tracking-widest text-slate-500 font-extrabold px-1">
              PDF View Mode
            </span>
          )}
          <div className={`flex gap-1.5 ${isExpanded ? '' : 'flex-col items-center'}`}>
            {/* Single Page */}
            <button
              id="btn-pdf-single-page"
              onClick={() => onPdfViewModeChange('single')}
              title="Single page view"
              className={`flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer ${
                isExpanded ? 'flex-1 px-3 py-2' : 'w-10 h-10 justify-center'
              } ${
                pdfViewMode === 'single'
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-400'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              {isExpanded && <span className="text-[10px] font-bold font-sans">Single Page</span>}
            </button>
            {/* Double Page */}
            <button
              id="btn-pdf-double-page"
              onClick={() => onPdfViewModeChange('double')}
              title="Two page view"
              className={`flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer ${
                isExpanded ? 'flex-1 px-3 py-2' : 'w-10 h-10 justify-center'
              } ${
                pdfViewMode === 'double'
                  ? 'bg-indigo-400/15 border-indigo-400/50 text-indigo-400'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <Columns2 className="w-4 h-4 flex-shrink-0" />
              {isExpanded && <span className="text-[10px] font-bold font-sans">Two Pages</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
