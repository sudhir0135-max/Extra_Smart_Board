/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Book } from '../types';
import { Bookmark, ChevronsLeft, ChevronsRight, Library } from 'lucide-react';

interface BookShelfProps {
  books: Book[];
  selectedBookId: number | null;
  onSelectBook: (bookId: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChangeGrade?: () => void;
}

export default function BookShelf({
  books,
  selectedBookId,
  onSelectBook,
  isExpanded,
  onToggleExpand,
  onChangeGrade,
}: BookShelfProps) {
  if (!isExpanded) return null;

  return (
    <div
      className={`h-full bg-[#060a13] border-r border-slate-900 flex flex-col overflow-hidden text-slate-200 select-none transition-all duration-300 ${
        isExpanded ? 'w-[240px]' : 'w-[72px]'
      }`}
      id="book-shelf-wrapper"
    >
      {/* Header section with brand info or squeeze action toggle */}
      <div className="flex flex-col border-b border-slate-900 bg-slate-950/40">
        {/* Change Grade Trigger when expanded */}
        {onChangeGrade && (
          <div className="p-3.5">
            {isExpanded ? (
              <button
                onClick={onChangeGrade}
                className="w-full bg-[#0d631b]/20 hover:bg-[#0d631b]/35 border border-[#0d631b]/40 hover:border-[#0d631b]/70 text-[#cbffc2] text-[10px] font-sans font-bold py-1.5 px-2 rounded-md transition-all cursor-pointer text-center uppercase tracking-wider block"
                id="btn-change-grade-shelf"
              >
                ← Back to Library
              </button>
            ) : (
              <button
                onClick={onChangeGrade}
                className="w-10 h-8 mx-auto bg-[#0d631b]/20 hover:bg-[#0d631b]/35 border border-[#0d631b]/40 text-[#cbffc2] text-[10px] font-mono font-black rounded-md transition-all cursor-pointer flex items-center justify-center uppercase"
                title="Back to Library"
                id="btn-change-grade-shelf-squeezed"
              >
                LIB
              </button>
            )}
          </div>
        )}
      </div>

      {/* Book cards vertical list view */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3" id="books-track">
        {(() => {
          const activeBook = books.find(b => b.id === selectedBookId);
          if (!activeBook) return null;

          if (isExpanded) {
            return (
              <div className="flex flex-col gap-2 py-2" id="selected-book-label">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-500/80">
                  Active Textbook
                </span>
                <div className="font-sans text-sm font-extrabold text-amber-400 tracking-wide uppercase leading-snug">
                  {activeBook.title}
                </div>
                <div className="text-[10px] text-slate-400 font-sans italic">
                  by {activeBook.author}
                </div>
                <div className="text-[9px] font-mono text-slate-500 uppercase mt-3">
                  {activeBook.lessons.length} Chapters Loaded
                </div>
              </div>
            );
          } else {
            // Squeezed compact label
            return (
              <div 
                className="flex flex-col items-center justify-center py-2" 
                id="selected-book-label-compact"
                title={`${activeBook.title} - by ${activeBook.author}`}
              >
                <div className="writing-mode-vertical text-orientation-mixed font-sans text-[11px] font-extrabold text-amber-400 leading-none tracking-[1.5px] uppercase">
                  {activeBook.title}
                </div>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
}
