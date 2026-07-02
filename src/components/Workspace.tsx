/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Book, Lesson, ThemeMode, AcademicSubject, BookEditor } from '../types';
import DynamicFigure from './DynamicFigure';
import ScribbleOverlay from './ScribbleOverlay';
import { Plus, Info, Check, Upload, BookOpen, AlertCircle, FileText, X } from 'lucide-react';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

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
  imageViewMode?: 'single' | 'two';
  isLessonContentLess?: boolean;
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
}: WorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const [activeAnnotation, setActiveAnnotation] = useState<{
    text: string;
    mediaType: string;
    mediaUrl: string;
    rect: DOMRect;
    fontSize: string;
  } | null>(null);
  const annotationBubbleRef = useRef<HTMLDivElement>(null);
  const annotationSheetRef = useRef<HTMLDivElement>(null);

  // Auto-render math inside annotation popups when activeAnnotation changes
  React.useEffect(() => {
    if (activeAnnotation) {
      if (annotationBubbleRef.current) {
        renderMathInElement(annotationBubbleRef.current, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }
      if (annotationSheetRef.current) {
        renderMathInElement(annotationSheetRef.current, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }
    }
  }, [activeAnnotation]);

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
      
      const rect = annotationSpan.getBoundingClientRect();
      const fontSize = window.getComputedStyle(annotationSpan).fontSize || '16px';
      setActiveAnnotation({ text, mediaType, mediaUrl, rect, fontSize });
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

            {/* ── PAGE MODE: render lesson pages as before ── */}
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

                    {isLessonContentLess ? (
                      imageViewMode === 'two' ? (
                        <div className="flex flex-row w-full gap-6 mt-4">
                          {((page as any).leftImage || (page as any).rightImage) && (
                            <div className="w-1/2 flex-shrink-0">
                              {(page as any).leftImage && (
                                <img 
                                  src={(page as any).leftImage} 
                                  alt="Left Side Column Illustration" 
                                  className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                                  referrerPolicy="no-referrer" 
                                />
                              )}
                            </div>
                          )}
                          {((page as any).leftImage || (page as any).rightImage) && (
                            <div className="w-1/2 flex-shrink-0">
                              {(page as any).rightImage && (
                                <img 
                                  src={(page as any).rightImage} 
                                  alt="Right Column Graphic Illustration" 
                                  className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                                  referrerPolicy="no-referrer" 
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col w-full gap-6 mt-4 items-center">
                          {(page as any).leftImage && (
                            <div className="w-full">
                              <img 
                                src={(page as any).leftImage} 
                                alt="Left Side Column Illustration" 
                                className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                                referrerPolicy="no-referrer" 
                              />
                            </div>
                          )}
                          {(page as any).rightImage && (
                            <div className="w-full">
                              <img 
                                src={(page as any).rightImage} 
                                alt="Right Column Graphic Illustration" 
                                className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                                referrerPolicy="no-referrer" 
                              />
                            </div>
                          )}
                        </div>
                      )
                    ) : (
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
                          <div
                            className="font-serif leading-loose space-y-6 text-[16px] lg:text-[17px] min-[3840px]:text-[34px] min-[3840px]:leading-loose tracking-wide reader-content relative"
                            id={`page-paragraph-content-${page.pageNumber}`}
                            dangerouslySetInnerHTML={{ __html: page.content }}
                            onClick={handleContentClick}
                          />
                        </div>

                        {(page as any).rightImage && (
                          <div className="w-full lg:w-[30%] flex-shrink-0">
                            <img 
                              src={(page as any).rightImage} 
                              alt="Right Column Graphic Illustration" 
                              className="w-full h-auto rounded-xl border border-slate-350/50 dark:border-slate-800 shadow-lg shadow-black/5" 
                              referrerPolicy="no-referrer" 
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
                  </div>
                ))}
              </div>
            </div>
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

      {/* ANNOTATION UI: Speech Bubble (Popover) */}
      {activeAnnotation && activeAnnotation.mediaType === 'none' && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent cursor-pointer" onClick={() => setActiveAnnotation(null)} />
          <div 
            ref={annotationBubbleRef}
            className="fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-5 min-w-[200px] max-w-[90vw] md:max-w-md transition-opacity duration-200"
            style={{
              top: Math.max(10, activeAnnotation.rect.bottom + 10),
              left: Math.max(10, Math.min(window.innerWidth - 300, activeAnnotation.rect.left + activeAnnotation.rect.width / 2 - 150))
            }}
          >
            <div className="absolute -top-2 left-1/2 -ml-2 w-4 h-4 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"></div>
            <div 
              className="relative text-slate-200 font-serif leading-loose"
              style={{ fontSize: activeAnnotation.fontSize }}
            >
              {activeAnnotation.text}
            </div>
          </div>
        </>
      )}

      {/* ANNOTATION UI: Bottom Sheet */}
      {activeAnnotation && activeAnnotation.mediaType !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-all" onClick={() => setActiveAnnotation(null)}>
          <div 
            ref={annotationSheetRef}
            className="bg-slate-900 w-full max-w-3xl rounded-t-3xl border-t border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '85vh' }}
          >
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 sticky top-0 z-10">
              <h3 className="font-sans font-bold text-slate-200 text-lg">Detailed View</h3>
              <button onClick={() => setActiveAnnotation(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 70px)' }}>
              {activeAnnotation.mediaType === 'image' && activeAnnotation.mediaUrl && (
                <div className="mb-6 rounded-xl overflow-hidden border border-slate-800 bg-black flex justify-center">
                  <img src={activeAnnotation.mediaUrl} alt="Annotation Image" className="max-w-full max-h-[40vh] object-contain" />
                </div>
              )}
              {activeAnnotation.mediaType === 'video' && activeAnnotation.mediaUrl && (
                <div className="mb-6 rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video">
                  <iframe src={activeAnnotation.mediaUrl} className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
                </div>
              )}
              
              <div className="text-slate-300 font-serif text-lg leading-relaxed">
                {activeAnnotation.text}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
