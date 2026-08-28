/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, AcademicSubject, BookBookmark } from '../types';
import { Sparkles, BookOpenCheck, Library, Hammer, Bookmark } from 'lucide-react';
import { StudyClass } from './ClassSelector';
import CachedImage from './CachedImage';

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
  academicSubjects?: AcademicSubject[];
  bookmarks?: Record<number, BookBookmark>;
  onSelectBookBookmark?: (bookId: number, lessonId: string, pageNumber: number) => void;
}

/**
 * Split lengthy subject names into up to 2 lines so they fit nicely
 * on the vertical 90-degree library shelf end-plate.
 */
const formatSubjectNameLines = (name: string): string[] => {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    return [trimmed];
  }
  if (words.length === 2) {
    return [words[0], words[1]];
  }
  // For 3+ words (e.g., "Physical Education and Well-being"):
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');
  return [line1, line2];
};

/**
 * Determine dynamic font size & tracking for subject end-plate text
 * based on line character lengths.
 */
const getSubjectFontSizeClass = (lines: string[]): string => {
  const maxLineLength = Math.max(...lines.map(l => l.length));

  if (maxLineLength > 22) {
    return 'text-[8.5px] sm:text-[9.5px] leading-tight tracking-[0.1em]';
  } else if (maxLineLength > 15) {
    return 'text-[9.5px] sm:text-[11px] leading-tight tracking-[0.12em]';
  } else if (maxLineLength > 10) {
    return 'text-[11px] sm:text-xs leading-snug tracking-[0.15em]';
  } else {
    return 'text-xs sm:text-sm leading-snug tracking-[0.2em]';
  }
};

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
  academicSubjects = [],
  bookmarks = {},
  onSelectBookBookmark,
}: GradeSelectorProps) {
  // Determine selected subjects to display as shelf rows (1 shelf per subject)
  const activeClass = studyClasses && activeClassIndex !== undefined ? studyClasses[activeClassIndex] : undefined;
  
  let selectedSubjectNames: string[] = [];
  if (activeClass && activeClass.subjects && activeClass.subjects.length > 0) {
    selectedSubjectNames = activeClass.subjects;
  } else if (academicSubjects && academicSubjects.length > 0) {
    selectedSubjectNames = academicSubjects.map(s => s.name);
  } else {
    // Collect unique subjects directly from books if no subject list is configured
    const bookSubjectIds = Array.from(new Set(books.map(b => b.subjectId).filter(Boolean)));
    selectedSubjectNames = bookSubjectIds as string[];
    if (selectedSubjectNames.length === 0) {
      selectedSubjectNames = ['General Library'];
    }
  }

  // Filter books matching a given subject name
  const getBooksForSubject = (subjectName: string): Book[] => {
    const matchedSubjectObj = academicSubjects.find(
      s => s.name.toLowerCase() === subjectName.toLowerCase() || s.id === subjectName
    );

    return books.filter(book => {
      if (matchedSubjectObj && book.subjectId === matchedSubjectObj.id) {
        return true;
      }
      if (book.subjectId && book.subjectId.toLowerCase() === subjectName.toLowerCase()) {
        return true;
      }
      if (!book.subjectId && book.title && book.title.toLowerCase().includes(subjectName.toLowerCase())) {
        return true;
      }
      return false;
    });
  };

  return (
    <div className="h-full w-full bg-[#160b03] text-amber-100 font-manrope font-sans selection:bg-amber-900/60 overflow-y-auto relative">
      {/* Background ambient wood grain gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#381e0b] via-[#1a0c03] to-[#0c0501] pointer-events-none z-0" />

      {/* Fixed top wooden header appbar */}
      <header className="fixed top-0 w-full z-50 bg-[#1e0f05]/90 backdrop-blur-md border-b-2 border-[#5c3414] shadow-xl">
        <div className="flex items-center justify-between px-6 h-14 max-w-7xl mx-auto">
          {/* Logo and title */}
          <div className="flex items-center gap-2.5">
            {globalLogo ? (
              <img src={globalLogo} alt="Global Logo" className="w-7 h-7 rounded-lg object-contain bg-black/40 border border-amber-500/20" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-amber-100 shadow-md">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif font-black text-lg tracking-wide text-amber-350 hidden sm:block drop-shadow-md">
                Extra Padhai Library
              </h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/60 hidden md:inline">
                WOODEN SHELF VIEW
              </span>
            </div>
          </div>

          {/* Class switcher tabs in center */}
          {studyClasses && studyClasses.length > 1 && (
            <div className="flex bg-black/40 p-1 rounded-xl border border-amber-900/40 gap-1 select-none">
              {studyClasses.map((sc, idx) => {
                const isActive = idx === activeClassIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectClassIndex?.(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-600 text-amber-950 shadow-md font-extrabold'
                        : 'text-amber-200/70 hover:text-amber-100 hover:bg-white/5'
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
                className="px-3.5 py-1.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/40 text-amber-300 rounded-xl text-xs font-bold font-sans cursor-pointer transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                title="Go back to Class Profiles"
              >
                Profiles
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Library Shelf Content Container */}
      <main className="pt-16 pb-12 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col min-h-screen relative z-10">
        {!isBooksLoaded ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-amber-400 tracking-wide text-center animate-pulse drop-shadow-md">
              Syncing Library Database...
            </h2>
          </div>
        ) : selectedSubjectNames.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-amber-400 tracking-wide text-center">
              No Subject Configured
            </h2>
          </div>
        ) : (
          <div className="flex flex-col gap-6 mt-4 mb-6">
            {selectedSubjectNames.map((subjectName, index) => {
              const subjectBooks = getBooksForSubject(subjectName);
              const subjectLines = formatSubjectNameLines(subjectName);
              const fontSizeClass = getSubjectFontSizeClass(subjectLines);

              return (
                <section
                  key={index}
                  id={`subject-shelf-${index}`}
                  className="w-full h-[40vh] min-h-[260px] max-h-[340px] flex flex-row relative overflow-hidden bg-gradient-to-r from-[#241306] via-[#1a0c03] to-[#241306] border-b-4 border-[#3d2008] shadow-[inset_0_10px_25px_rgba(0,0,0,0.85)] rounded-xl group border border-[#4a270b]/60"
                >
                  {/* Left Static Vertical Subject End-Plate */}
                  <div
                    className={`flex-shrink-0 bg-gradient-to-b from-[#3a1f0c] via-[#241205] to-[#140802] border-r-2 border-[#5c3414] flex items-center justify-center relative shadow-2xl select-none z-20 p-1.5 ${
                      subjectLines.length > 1 ? 'w-16 sm:w-20 md:w-24' : 'w-12 sm:w-16 md:w-20'
                    }`}
                  >
                    {/* Inner gold frame inlay line */}
                    <div className="absolute inset-1.5 border border-amber-600/25 rounded pointer-events-none" />
                    
                    {/* Brass corner rivet accents */}
                    <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />
                    <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />
                    <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />

                    {/* Vertical (90-degree) Subject Name text container */}
                    <div className="flex flex-row items-center justify-center gap-1 sm:gap-1.5 py-3 h-full max-h-full overflow-hidden">
                      {subjectLines.map((line, lIdx) => (
                        <span
                          key={lIdx}
                          className={`[writing-mode:vertical-lr] rotate-180 font-serif font-black uppercase text-[#e8c383] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-center whitespace-nowrap ${fontSizeClass}`}
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Shelf Bay Container */}
                  <div className="flex-1 h-full relative overflow-hidden flex flex-col justify-between z-10">
                    {/* Inner top shelf shadow for 3D alcove effect */}
                    <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />

                    {/* Wooden Shelf Floor Base Plank */}
                    <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-b from-[#5c3414] via-[#3a200c] to-[#1f0f05] border-t border-[#7e471b] shadow-[0_10px_20px_rgba(0,0,0,0.9)] pointer-events-none z-10" />

                    {subjectBooks.length > 0 ? (
                      /* Horizontal Books Track resting on wooden shelf */
                      <div className="overflow-x-auto flex items-end gap-6 px-6 pb-6 pt-4 h-full no-scrollbar z-0 relative">
                        {subjectBooks.map((book) => {
                          const bookmark = bookmarks?.[book.id];
                          const bookmarkLesson = bookmark ? book.lessons.find(l => l.id === bookmark.lessonId) : null;
                          const bookmarkLessonIdx = bookmark && bookmarkLesson ? book.lessons.findIndex(l => l.id === bookmark.lessonId) + 1 : 0;

                          return (
                            <div
                              key={book.id}
                              id={`selector-book-${book.id}`}
                              onClick={() => onSelectBook(book.id)}
                              className="h-[200px] sm:h-[220px] w-[135px] sm:w-[150px] flex-shrink-0 relative cursor-pointer group/book transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 shadow-[0_15px_25px_rgba(0,0,0,0.85)] border border-[#5c3718]/80 overflow-hidden flex flex-col justify-between p-3 rounded-md select-none"
                              style={{
                                background: `linear-gradient(135deg, ${book.color}e0, ${book.color}bb)`,
                              }}
                            >
                              {/* Bookmark Ribbon Badge */}
                              {bookmark && bookmarkLesson && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectBookBookmark?.(book.id, bookmark.lessonId, bookmark.pageNumber);
                                  }}
                                  className="absolute top-2 right-2 z-20 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 px-1.5 py-0.5 rounded-md shadow-xl border border-amber-300 font-sans text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 group/bm"
                                  title={`Jump directly to Bookmark: Chapter ${bookmarkLessonIdx} (${bookmarkLesson.title}) - Page ${bookmark.pageNumber}`}
                                >
                                  <Bookmark className="w-2.5 h-2.5 fill-slate-950 text-slate-950 flex-shrink-0" />
                                  <span className="truncate max-w-[95px]">
                                    Ch {bookmarkLessonIdx} • Pg {bookmark.pageNumber}
                                  </span>
                                </button>
                              )}

                              {/* Book Cover Image (if available) */}
                              {book.coverImage && (
                                <div className="absolute inset-0 z-0">
                                  <CachedImage
                                    src={book.coverImage}
                                    alt={book.title}
                                    className="w-full h-full object-cover opacity-90 group-hover/book:opacity-100 transition-opacity"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                </div>
                              )}

                            {/* Book Spine Shadow Overlay */}
                            <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/50 to-transparent pointer-events-none z-10" />

                            {/* Spacer */}
                            <div className="flex-1 pointer-events-none" />

                            {/* Book Details */}
                            <div className="pl-1.5 relative z-10 mb-1">
                              <span className="text-[8px] uppercase font-mono tracking-widest text-white/70 block">
                                Book 0{book.id}
                              </span>
                              <h3
                                className={`font-display font-medium text-white tracking-tight leading-snug line-clamp-2 mt-0.5 decoration-yellow-400 group-hover/book:underline ${
                                  book.coverImage ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'
                                }`}
                              >
                                {book.title}
                              </h3>
                            </div>

                            <div className="pl-1.5 flex items-end justify-between relative z-10">
                              <span
                                className="text-[9px] font-serif italic text-white/80 line-clamp-1"
                                title={book.author === 'ExtraPadhai AI' ? (book.source || 'ExtraPadhai AI') : book.author}
                              >
                                {book.author === 'ExtraPadhai AI' ? (book.source || 'ExtraPadhai AI') : book.author}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    ) : (
                      /* Under Construction Plaque for empty subjects */
                      <div className="flex-1 h-full flex flex-col items-center justify-center p-4 z-0">
                        <div className="bg-gradient-to-b from-[#2a1708] to-[#160b03] border-2 border-[#7e471b] rounded-xl px-6 py-4 text-center shadow-[0_12px_24px_rgba(0,0,0,0.85)] relative max-w-sm">
                          {/* Brass corner rivet accents */}
                          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />
                          <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />
                          <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-amber-600/80 border border-amber-400/80 shadow-sm" />

                          <div className="flex items-center justify-center gap-2 mb-1">
                            <Hammer className="w-4 h-4 text-amber-400 animate-pulse" />
                            <span className="font-serif font-black uppercase text-amber-400 tracking-widest text-xs sm:text-sm">
                              Under Construction
                            </span>
                            <Hammer className="w-4 h-4 text-amber-400 animate-pulse" />
                          </div>
                          <p className="text-[11px] font-sans text-amber-200/70 italic mt-0.5">
                            Textbooks for <span className="font-bold text-amber-300">{subjectName}</span> are currently under development.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Footer info line brand & copyright alignment */}
        <footer className="mt-auto pt-6 pb-4 text-center opacity-60 text-[10px] text-amber-200/70 font-serif tracking-wider select-none">
          <p>© {new Date().getFullYear()} ExtraPadhai.com • All Rights Reserved • Classic Wooden Library Bay • Aligned with National Curricula</p>
        </footer>
      </main>
    </div>
  );
}
