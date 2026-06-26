/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Book, Lesson, ThemeMode, AcademicSubject, BookEditor } from '../types';
import DynamicFigure from './DynamicFigure';
import ScribbleOverlay from './ScribbleOverlay';
import PdfViewer from './PdfViewer';
import ImageViewer from './ImageViewer';
import { Plus, Info, Check, Upload, BookOpen, AlertCircle, FileText } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

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
  books: Book[];
  academicSubjects: AcademicSubject[];
  editors: BookEditor[];
  globalLogo?: string | null;
  pdfViewMode?: 'single' | 'double';
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
  pdfViewMode = 'single',
}: WorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

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

          {activeLesson.pagesReady && activeLesson.pageCount && selectedBook ? (
            /* ── WEBP MODE: new image-based viewer ── */
            <ImageViewer
              lessons={selectedBook.lessons.filter(l => l.pagesReady && l.pageCount)}
              initialLessonId={activeLesson.id}
              classId={selectedBook.classId || 'unknown'}
              subjectId={selectedBook.subjectId || 'unknown'}
              bookId={selectedBook.id}
            />
          ) : activeLesson.pdfUrl ? (
            /* ── PDF MODE: legacy fallback ── */
            <PdfViewer url={activeLesson.pdfUrl} viewMode={pdfViewMode} />
          ) : (
            /* ── PAGE MODE: render lesson pages as before ── */
            <div
              id="content-scroll"
              className="flex-1 overflow-y-auto relative outline-none select-text pb-20 cursor-text"
            >
              <div
                className={`w-full flex flex-col items-stretch px-[2%] ${themeStyles.paperBg} ${themeStyles.color} transition-all duration-300 rounded-xl pdf-shadow overflow-hidden relative`}
                style={{ fontSize: `${fontSizeScale}rem` }}
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
                {activeLesson.pages.map((page, index) => (
                  <div
                    key={index}
                    id={`pdf-page-${page.pageNumber}`}
                    className="relative px-[2%] py-6"
                  >
                    <div className="absolute right-6 top-3 text-[9px] font-mono opacity-50 select-none uppercase tracking-wider">
                      {page.pageNumber}
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 items-start w-full mt-4">
                      {(page as any).leftImage && (
                        <div className="w-full lg:w-[30%] flex-shrink-0">
                          <img 
                            src={(page as any).leftImage} 
                            alt="Left Side Column Illustration" 
                            className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                      )}
                      
                      <div className="flex-1 lg:w-[70%] min-w-0">
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
                        <div
                          className="font-serif leading-loose space-y-6 text-[16px] lg:text-[17px] min-[3840px]:text-[34px] min-[3840px]:leading-loose tracking-wide reader-content"
                          id={`page-paragraph-content-${page.pageNumber}`}
                          dangerouslySetInnerHTML={{ __html: page.content }}
                        />
                      </div>

                      {(page as any).rightImage && (
                        <div className="w-full lg:w-[30%] flex-shrink-0">
                          <img 
                            src={(page as any).rightImage} 
                            alt="Right Side Column Illustration" 
                            className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                      )}
                    </div>

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
                ))}
              </div>
            </div>
          )}
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
                <img src={globalLogo} alt="Global Logo" className="max-w-full max-h-full object-contain" />
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
    </div>
  );
}
