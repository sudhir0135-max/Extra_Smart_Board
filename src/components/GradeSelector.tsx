/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Book } from '../types';
import { Sparkles, BookOpenCheck, Library } from 'lucide-react';
import { StudyClass } from './ClassSelector';

interface GradeSelectorProps {
  books: Book[];
  onSelectBook: (bookId: number) => void;
  onEnterAdmin?: () => void;
  globalLogo?: string | null;
  isBooksLoaded?: boolean;
  studyClasses?: StudyClass[];
  activeClassIndex?: number;
  onSelectClassIndex?: (index: number) => void;
  onGoBackToProfiles?: () => void;
  onGoBackToLanding?: () => void;
}

export default function GradeSelector({
  books,
  onSelectBook,
  onEnterAdmin,
  globalLogo,
  isBooksLoaded = true,
  studyClasses,
  activeClassIndex,
  onSelectClassIndex,
  onGoBackToProfiles,
  onGoBackToLanding,
}: GradeSelectorProps) {
  // Take exactly 12 books or slice/pad to ensure we have 12 items for the two 6-column rows
  const displayBooks = books.slice(0, 12);

  return (
    <div className="min-h-screen bg-[#f7fbf0] text-[#181d17] font-manrope font-sans selection:bg-[#c6e9be]">
      {/* Fixed top appbar navigation bar */}
      <header className="fixed top-0 w-full z-50 bg-[#f7fbf0]/80 backdrop-blur-md border-b border-[#ebefe5]">
        <div className="flex items-center justify-between px-6 h-14 max-w-6xl mx-auto">
          {/* Logo and title */}
          <div className="flex items-center gap-2">
            {globalLogo ? (
              <img src={globalLogo} alt="Global Logo" className="w-7 h-7 rounded-lg object-contain bg-[#0d631b]/10" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#0d631b] flex items-center justify-center text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}
            <h1 className="font-manrope font-extrabold text-lg tracking-tight text-[#0d631b] hidden sm:block">
              Extra Padhai
            </h1>
          </div>

          {/* Class switcher tabs in center */}
          {studyClasses && studyClasses.length > 1 && (
            <div className="flex bg-[#0d631b]/5 p-0.5 rounded-xl border border-[#0d631b]/10 gap-0.5 select-none">
              {studyClasses.map((sc, idx) => {
                const isActive = idx === activeClassIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectClassIndex?.(idx)}
                    className={`px-3.5 py-1 rounded-lg text-xs font-bold font-manrope transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0d631b] text-white shadow-sm font-extrabold'
                        : 'text-[#0d631b]/70 hover:text-[#0d631b] hover:bg-[#0d631b]/5'
                    }`}
                  >
                    Class {sc.className}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons on the right */}
          <div className="flex items-center gap-2">
            {onGoBackToProfiles && (
              <button
                onClick={onGoBackToProfiles}
                className="px-3.5 py-1.5 bg-[#0d631b]/10 hover:bg-[#0d631b]/20 border border-[#0d631b]/15 text-[#0d631b] rounded-xl text-xs font-bold font-manrope cursor-pointer transition-all flex items-center gap-1 shadow-sm active:scale-95"
                title="Go back to Class Profiles"
              >
                Profiles
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container tailored to fit perfectly in 1 screen height */}
      <main className="pt-16 pb-6 px-6 max-w-6xl mx-auto flex flex-col justify-between h-[calc(100vh-16px)] overflow-hidden">
        {!isBooksLoaded ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0d631b] tracking-tight text-center animate-pulse">
              Syncing Offline Database...
            </h2>
          </div>
        ) : displayBooks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0d631b] tracking-tight text-center">
              No Book Available for your class and subjects
            </h2>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-8 mb-auto select-none">
            {displayBooks.map((book) => (
              <div
                key={book.id}
                id={`selector-book-${book.id}`}
              onClick={() => onSelectBook(book.id)}
              className="h-[32.3vh] min-h-[187px] max-h-[252px] rounded-2xl relative cursor-pointer group transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#0d631b]/10 active:scale-95 border border-[#ebefe5] overflow-hidden flex flex-col justify-between p-3"
              style={{
                background: `linear-gradient(135deg, ${book.color}e0, ${book.color}bb)`,
              }}
            >
              {/* Book Cover Image (if available) */}
              {book.coverImage && (
                <div className="absolute inset-0 z-0">
                  <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover rounded-2xl opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
              )}

              {/* Spine shadow overlay recreating a premium hardbound cover look */}
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/40 to-transparent pointer-events-none rounded-l-2xl z-10" />
              
              {/* Book Details */}
              <div className="pl-2 relative z-10">
                <span className="text-[8.5px] uppercase font-mono tracking-widest text-white/70 block">
                  Book 0{book.id}
                </span>
                <h3 className="font-display font-medium text-sm sm:text-base text-white tracking-tight leading-snug line-clamp-2 mt-1 decoration-yellow-400 group-hover:underline">
                  {book.title}
                </h3>
              </div>

              <div className="pl-2 flex items-end justify-between relative z-10">
                <span className="text-[9.5px] font-serif italic text-white/80 line-clamp-1 max-w-[80px]">
                  {book.author}
                </span>
                <span className="bg-black/30 backdrop-blur-sm text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border border-white/10">
                  <BookOpenCheck className="w-2.5 h-2.5" />
                  {book.lessons.length} Ch
                </span>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Footer info line brand alignment */}
        <footer className="mb-2 text-center opacity-40 text-[10px] text-[#181d17]">
          <span>Extrapadhai.com • Continuous cloud state replication active • Aligned with national curricula</span>
        </footer>
      </main>
    </div>
  );
}
