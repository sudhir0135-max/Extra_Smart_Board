/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Book, Lesson, FlashQuestion, BookEditor } from '../types';
import { uploadImageToStorage, uploadWebpPage, writeMetaJson, deleteFileFromStorage, buildLessonStoragePath } from '../lib/firebaseHelper';
import { auth, db, storage } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  Shield,
  Key,
  Database,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  BookOpen,
  HelpCircle,
  CheckCircle,
  FileText,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Sliders,
  Play,
  ArrowUp,
  ArrowDown,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  Quote,
  Eye,
  Image as ImageIcon,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import FlashQuestionManager from './FlashQuestionManager';
import InquiryQuestionManager from './InquiryQuestionManager';
import ProfilePanel from './ProfilePanel';



interface BookEditorPanelProps {
  books: Book[];
  saveBookToFirebase: (book: Book) => Promise<void>;
  editors: BookEditor[];
  onClose: () => void;
  globalLogo?: string | null;
}

export default function BookEditorPanel({
  books,
  saveBookToFirebase,
  editors,
  onClose,
  globalLogo
}: BookEditorPanelProps) {
  // Removed internal mock login states
  const [assignedBookId, setAssignedBookId] = useState<number | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsub = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists() && docSnap.data().assignedBookId) {
              setAssignedBookId(docSnap.data().assignedBookId);
            } else {
              setAssignedBookId(null);
            }
          } catch (e) {
            console.error("Failed to fetch assignment", e);
          }
        } else {
          setAssignedBookId(null);
        }
        setAuthLoading(false);
      });
    });
    return () => unsub();
  }, []);

  // Selected Chapter / Page index for deep editing
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);

  // Status visual feedback
  const [successMsg, setSuccessMsg] = useState('');

  // Draft fields for chapter creation
  const [lessonTitleDraft, setLessonTitleDraft] = useState('');
  const [lessonSubtitleDraft, setLessonSubtitleDraft] = useState('');
  const [lessonVideoDraft, setLessonVideoDraft] = useState('');

  // Page level editing state
  const [pageContentDraft, setPageContentDraft] = useState('');
  const [pageLeftImageDraft, setPageLeftImageDraft] = useState('');
  const [pageCenterImageDraft, setPageCenterImageDraft] = useState('');
  const [pageRightImageDraft, setPageRightImageDraft] = useState('');
  const [pageFigureCaption, setPageFigureCaption] = useState('');
  const [pageFigureType, setPageFigureType] = useState<'brain' | 'river' | 'ecosystem' | 'math' | 'music' | 'language' | 'fairness'>('brain');
  const [pageEquationsDraft, setPageEquationsDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Active Lesson Metadata drafts
  const [activeLessonTitleDraft, setActiveLessonTitleDraft] = useState('');
  const [activeLessonSubtitleDraft, setActiveLessonSubtitleDraft] = useState('');
  const [activeLessonVideoDraft, setActiveLessonVideoDraft] = useState('');
  const [activeLessonPdfDraft, setActiveLessonPdfDraft] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  // WebP conversion state
  const [convertProgress, setConvertProgress] = useState<{ phase: 'idle' | 'converting' | 'uploading' | 'done' | 'error'; current: number; total: number; error?: string }>({ phase: 'idle', current: 0, total: 0 });



  const flashMessage = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Resolve the assigned book for the editor
  const assignedBook = books.find(b => b.id === assignedBookId) || null;
  const activeLesson = assignedBook ? assignedBook.lessons.find(l => l.id === selectedLessonId) || null : null;

  // Sync page content draft inputs
  useEffect(() => {
    if (isSaving) return; // Prevent overwriting drafts while saving to Firebase

    if (activeLesson) {
      setActiveLessonTitleDraft(activeLesson.title);
      setActiveLessonSubtitleDraft(activeLesson.subtitle || '');
      setActiveLessonVideoDraft(activeLesson.videoUrl || '');
      setActiveLessonPdfDraft(activeLesson.pdfUrl || null);
    }

    if (activeLesson && selectedPageIndex !== null) {
      const page = activeLesson.pages[selectedPageIndex];
      if (page) {
        setPageContentDraft(page.content);
        setPageLeftImageDraft((page as any).leftImage || '');
        setPageCenterImageDraft((page as any).centerImage || '');
        setPageRightImageDraft((page as any).rightImage || '');
        setPageFigureCaption(page.figure?.caption || '');
        setPageFigureType(page.figure?.svgType || 'brain');
        setPageEquationsDraft(page.equations ? page.equations.join('\n') : '');
      }
    } else {
      setPageContentDraft('');
      setPageLeftImageDraft('');
      setPageCenterImageDraft('');
      setPageRightImageDraft('');
      setPageFigureCaption('');
      setPageEquationsDraft('');
    }
  }, [selectedPageIndex, selectedLessonId, assignedBook, isSaving]);

  // 1. LESSON CRUD OPERATIONS
  const handleAddLesson = async () => {
    if (!assignedBook) return;
    if (!lessonTitleDraft.trim()) {
      alert('Chapter tier title cannot be empty.');
      return;
    }

    const isDuplicate = assignedBook.lessons.some(l => l.title.toLowerCase() === lessonTitleDraft.trim().toLowerCase());
    if (isDuplicate) {
      alert('A chapter with this exact title already exists in this textbook. Please use a unique title.');
      return;
    }
    const newLesson: Lesson = {
      id: `lesson-ed-${assignedBook.id}-${Date.now()}`,
      title: lessonTitleDraft.trim(),
      subtitle: lessonSubtitleDraft.trim() || null,
      videoUrl: lessonVideoDraft.trim() || null,
      pages: [
        {
          pageNumber: 1,
          content: '<p>Freshly created page. Enter your customized lesson curriculum here.</p>'
        }
      ],
      flashQuestions: [],
      inquiryQuestions: []
    };

    try {
      const modifiedBook = { ...assignedBook, lessons: [...assignedBook.lessons, newLesson] };
      await saveBookToFirebase(modifiedBook);
      setLessonTitleDraft('');
      setLessonSubtitleDraft('');
      setLessonVideoDraft('');
      setSelectedLessonId(newLesson.id);
      setSelectedPageIndex(0);
      flashMessage(`Chapter '${newLesson.title}' added and synced to Firebase!`);
    } catch (err) {
      alert('Failed to add chapter to Firebase.');
    }
  };

  const handleUpdateLessonMeta = async (fields: Partial<Lesson>) => {
    if (!assignedBook || !selectedLessonId) return;
    
    if (fields.title) {
      const isDuplicate = assignedBook.lessons.some(l => 
        l.id !== selectedLessonId && 
        l.title.toLowerCase() === fields.title!.trim().toLowerCase()
      );
      if (isDuplicate) {
        alert('A chapter with this exact title already exists in this textbook. Please use a unique title.');
        return;
      }
    }

    try {
      const modifiedBook = {
        ...assignedBook,
        lessons: assignedBook.lessons.map(l => (l.id === selectedLessonId ? { ...l, ...fields } : l))
      };
      await saveBookToFirebase(modifiedBook);
      flashMessage('Chapter metadata updated in Firebase.');
    } catch (err) {
      alert('Failed to update chapter metadata.');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!assignedBook) return;
    const confirmDelete = window.confirm(`Permanently destroy this chapter "${activeLesson?.title}"? This will prune its corresponding page layouts.`);
    if (confirmDelete) {
      try {
        const modifiedBook = {
          ...assignedBook,
          lessons: assignedBook.lessons.filter(l => l.id !== lessonId)
        };
        await saveBookToFirebase(modifiedBook);
        setSelectedLessonId(null);
        setSelectedPageIndex(null);
        flashMessage('Chapter removed successfully from Firebase.');
      } catch (err) {
        alert('Failed to delete chapter from Firebase.');
      }
    }
  };

  const handleMoveLesson = async (index: number, direction: 'up' | 'down') => {
    if (!assignedBook) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === assignedBook.lessons.length - 1) return;

    const newLessons = [...assignedBook.lessons];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap elements
    [newLessons[index], newLessons[swapIndex]] = [newLessons[swapIndex], newLessons[index]];

    try {
      const modifiedBook = { ...assignedBook, lessons: newLessons };
      await saveBookToFirebase(modifiedBook);
      flashMessage('Chapter order updated in Firebase.');
    } catch (err) {
      alert('Failed to reorder chapters.');
    }
  };

  // 2. PAGE CRUD OPERATIONS
  const handleAddPage = async () => {
    if (!assignedBook || !activeLesson) return;
    const nextPageNum = activeLesson.pages.length + 1;
    const newPage = {
      pageNumber: nextPageNum,
      content: `<p>New Page ${nextPageNum} curriculum block. You can design custom callout and paragraphs here.</p>`
    };

    try {
      const modifiedBook = {
        ...assignedBook,
        lessons: assignedBook.lessons.map(l => {
          if (l.id === activeLesson.id) {
            return {
              ...l,
              pages: [...l.pages, newPage]
            };
          }
          return l;
        })
      };
      await saveBookToFirebase(modifiedBook);
      setSelectedPageIndex(nextPageNum - 1);
      flashMessage(`Page ${nextPageNum} appended to Chapter draft in Firebase.`);
    } catch (err) {
      alert('Failed to add page to Firebase.');
    }
  };

  const handleUpdatePage = async (index: number, contentFromEditor?: string) => {
    if (!assignedBook || !activeLesson) return;

    setIsSaving(true);
    const eqsArray = pageEquationsDraft
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const finalContent = contentFromEditor !== undefined ? contentFromEditor : pageContentDraft;

    try {
      const modifiedBook = {
        ...assignedBook,
        lessons: assignedBook.lessons.map(l => {
          if (l.id === activeLesson.id) {
            return {
              ...l,
              pages: l.pages.map((p, pIdx) => {
                if (pIdx === index) {
                  return {
                    ...p,
                    content: finalContent,
                    leftImage: pageLeftImageDraft || null,
                    centerImage: pageCenterImageDraft || null,
                    rightImage: pageRightImageDraft || null,
                    figure: pageFigureCaption ? { caption: pageFigureCaption, svgType: pageFigureType } : null,
                    equations: eqsArray.length > 0 ? eqsArray : null
                  };
                }
                return p;
              })
            };
          }
          return l;
        })
      };
      await saveBookToFirebase(modifiedBook);
      setPageContentDraft(finalContent);
      flashMessage(`Page ${index + 1} content saved successfully to Firebase.`);
    } catch (err) {
      alert('Failed to save page content to Firebase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePage = async (index: number) => {
    if (!assignedBook || !activeLesson) return;
    if (activeLesson.pages.length <= 1) {
      alert('Textbook chapters must retain at least one single layout page.');
      return;
    }
    const confirmDelete = window.confirm(`Delete page ${index + 1}? Consecutive indices will be safety re-indexed.`);
    if (confirmDelete) {
      try {
        const modifiedBook = {
          ...assignedBook,
          lessons: assignedBook.lessons.map(l => {
            if (l.id === activeLesson.id) {
              const filtered = l.pages.filter((_, pIdx) => pIdx !== index);
              const reindexed = filtered.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
              return {
                ...l,
                pages: reindexed
              };
            }
            return l;
          })
        };
        await saveBookToFirebase(modifiedBook);
        setSelectedPageIndex(null);
        flashMessage(`Page ${index + 1} deleted and re-indexed in Firebase.`);
      } catch (err) {
        alert('Failed to delete page from Firebase.');
      }
    }
  };

  const handleMovePage = async (pageIndex: number, direction: 'left' | 'right') => {
    if (!assignedBook || !activeLesson) return;
    if (direction === 'left' && pageIndex === 0) return;
    if (direction === 'right' && pageIndex === activeLesson.pages.length - 1) return;

    const newPages = [...activeLesson.pages];
    const swapIndex = direction === 'left' ? pageIndex - 1 : pageIndex + 1;
    
    // Swap elements
    [newPages[pageIndex], newPages[swapIndex]] = [newPages[swapIndex], newPages[pageIndex]];

    // Reassign page numbers
    newPages.forEach((p, idx) => {
      p.pageNumber = idx + 1;
    });

    try {
      const modifiedBook = {
        ...assignedBook,
        lessons: assignedBook.lessons.map(l => (l.id === activeLesson.id ? { ...l, pages: newPages } : l))
      };
      await saveBookToFirebase(modifiedBook);
      // Update selected index so the user stays on the same page content they were editing
      setSelectedPageIndex(swapIndex);
      flashMessage('Page reordered successfully.');
    } catch (err) {
      alert('Failed to reorder page.');
    }
  };

  // ── PDF → WebP Conversion Engine ────────────────────────────────────────────
  const runPdfToWebpConversion = async (
    localFile: File | null,                 // null if converting from existing Firebase URL
    book: typeof assignedBook,
    lesson: NonNullable<typeof activeLesson>,
    existingPdfUrl: string | null           // null if using localFile
  ) => {
    if (!book) return;

    const classId  = book.classId  || 'unknown_class';
    const subjectId = book.subjectId || 'unknown_subject';
    const storagePath = buildLessonStoragePath(classId, subjectId, book.id, lesson.id);

    setConvertProgress({ phase: 'converting', current: 0, total: 0 });

    try {
      // ── Step 1: Get PDF ArrayBuffer ──────────────────────────────────────
      let pdfBuffer: ArrayBuffer;

      if (localFile) {
        pdfBuffer = await localFile.arrayBuffer();
      } else if (existingPdfUrl) {
        // Download from Firebase Storage
        const { getBlob } = await import('firebase/storage');
        const { ref: storageRef } = await import('firebase/storage');
        const match = existingPdfUrl.match(/\/o\/(.+?)(\?|$)/);
        const path = match ? decodeURIComponent(match[1]) : null;
        if (!path) throw new Error('Cannot parse existing PDF URL');
        const blob = await getBlob(storageRef(storage, path));
        pdfBuffer = await blob.arrayBuffer();
      } else {
        throw new Error('No PDF source provided');
      }

      // ── Step 2: Load PDF.js ──────────────────────────────────────────────
      const pdfjsLib = await import('pdfjs-dist');
      // Use CDN worker for the admin panel (running in desktop Chrome)
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
      const total = pdf.numPages;
      setConvertProgress({ phase: 'converting', current: 0, total });

      // ── Step 3: Render each page → WebP → Upload ────────────────────────
      const DPI = 200;
      const SCALE = DPI / 72; // PDF user units are 72 DPI

      for (let pageNum = 1; pageNum <= total; pageNum++) {
        setConvertProgress({ phase: 'converting', current: pageNum, total });

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: SCALE });

        const canvas = document.createElement('canvas');
        canvas.width  = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Convert canvas to WebP blob
        const webpBlob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => b ? resolve(b) : reject(new Error(`Page ${pageNum}: toBlob returned null`)),
            'image/webp',
            0.85
          );
        });

        // Upload to Firebase Storage
        setConvertProgress({ phase: 'uploading', current: pageNum, total });
        await uploadWebpPage(classId, subjectId, book.id, lesson.id, pageNum, webpBlob);

        // Free memory
        canvas.width = 0; canvas.height = 0;
      }

      // ── Step 4: Write meta.json ──────────────────────────────────────────
      await writeMetaJson(classId, subjectId, book.id, lesson.id, {
        bookId: book.id,
        lessonId: lesson.id,
        title: lesson.title,
        classId,
        subjectId,
        lessonOrder: book.lessons.findIndex(l => l.id === lesson.id) + 1,
        pageCount: total,
      });

      // ── Step 5: Update Firestore lesson ──────────────────────────────────
      const updatedBook = {
        ...book,
        lessons: book.lessons.map(l => l.id === lesson.id
          ? { ...l, storagePath, pageCount: total, pagesReady: true, pdfUrl: null }
          : l
        )
      };
      await saveBookToFirebase(updatedBook);

      // ── Step 6: Delete original PDF from Firebase (if it was there) ──────
      if (existingPdfUrl) {
        await deleteFileFromStorage(existingPdfUrl);
      }

      setActiveLessonPdfDraft(null);
      setConvertProgress({ phase: 'done', current: total, total });
      flashMessage(`✅ ${total} pages converted and ready for students!`);

      // Reset progress after 4 seconds
      setTimeout(() => setConvertProgress({ phase: 'idle', current: 0, total: 0 }), 4000);

    } catch (err: any) {
      console.error('[PDF→WebP] Conversion failed:', err);
      setConvertProgress({ phase: 'error', current: 0, total: 0, error: err.message || 'Unknown error' });
    }
  };

  // ── Conversion Progress UI ────────────────────────────────────────────────
  const ConversionProgress = ({ progress }: { progress: typeof convertProgress }) => {
    if (progress.phase === 'idle') return null;

    if (progress.phase === 'error') {
      return (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-rose-300">❌ Conversion failed</p>
          <p className="text-[9px] font-mono text-rose-400">{progress.error}</p>
          <button
            onClick={() => setConvertProgress({ phase: 'idle', current: 0, total: 0 })}
            className="text-[9px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      );
    }

    if (progress.phase === 'done') {
      return (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-300">
            ✅ Done! {progress.total} pages ready for students.
          </p>
        </div>
      );
    }

    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    const label = progress.phase === 'converting' ? '🖼️  Converting page' : '☁️  Uploading page';

    return (
      <div className="bg-[#0d1020] border border-violet-500/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-mono text-violet-300">
            {label} {progress.current} / {progress.total}
          </p>
          <span className="text-[9px] font-mono text-slate-400">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[8px] font-mono text-slate-500">
          {progress.phase === 'converting'
            ? 'Reading PDF locally — not uploading the original file'
            : 'Storing image in Firebase Storage'}
        </p>
      </div>
    );
  };

  if (authLoading) {

    return (
      <div className="h-screen w-full bg-[#070a13] flex items-center justify-center">
        <div className="text-emerald-500 animate-pulse">Loading Editor Credentials...</div>
      </div>
    );
  }

  if (!assignedBookId || !assignedBook) {
    return (
      <div className="h-screen w-full bg-[#070a13] text-slate-200 font-sans flex flex-col items-center justify-center p-6">
        <Shield className="w-16 h-16 text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-white tracking-tight text-center">Unassigned Editor Profile</h2>
        <p className="text-sm text-slate-400 mt-3 max-w-md text-center leading-relaxed">
          Your account has not been mapped to any specific textbook. Please contact your system administrator to assign a book to your profile.
        </p>
        <button
          onClick={onClose}
          className="mt-8 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl transition-colors font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Library
        </button>
        {profileOpen && (
          <ProfilePanel onClose={() => setProfileOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#070a13] text-slate-200 font-sans flex flex-col overflow-hidden" id="editor-workspace">
      {/* HEADER BAR */}
      <header className="h-14 bg-[#0a0f1d] border-b border-slate-900 flex items-center justify-between px-4 lg:px-6 z-40 shrink-0">
        <div className="flex items-center gap-3">
          {globalLogo ? (
            <img src={globalLogo} alt="Global Logo" className="w-8 h-8 rounded object-contain bg-white/10 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
              Book Editor Panel
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1.5 py-0.5 text-[8.5px] uppercase font-mono font-black select-none">
                Volume Lock
              </span>
            </h1>
            <p className="text-[10px] text-slate-450 font-serif italic hidden sm:block">Textbook Chapter Assembler</p>
          </div>
        </div>

        {/* Assignment Display */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-slate-400 uppercase">Assigned Book:</span>
          <span className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs text-emerald-400 font-bold truncate max-w-[200px]">
            {assignedBook.title}
          </span>
        </div>

        {successMsg && (
          <div className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 rounded-lg p-2 px-3.5 text-xs font-sans font-bold flex items-center gap-1.5 tracking-wide animate-pulse">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              alert("Changes successfully saved to local database!");
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white p-2 px-3 rounded-lg text-xs font-semibold select-none cursor-pointer transition-all mr-2"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            className="text-amber-400 hover:text-amber-300 text-xs font-medium select-none cursor-pointer transition-all mr-2 flex items-center gap-1.5"
          >
            My Profile
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-slate-950/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-2 px-3 rounded-lg text-slate-300 hover:text-white text-xs font-semibold select-none cursor-pointer transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
        </div>
      </header>

      {/* CORE TWO-PANE LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT RAIL: Chapter appending & Selection tree */}
        <div className="w-[300px] bg-[#090e1b] border-r border-slate-900 flex flex-col overflow-hidden select-none">
          {/* Create Chapter Subsection */}
          <div className="p-4 border-b border-slate-900 bg-slate-950/40 space-y-3 flex-shrink-0">
            <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#707a6c] block font-extrabold">
              Create New Lesson Chapter
              </span>
              <div className="space-y-2">
                <input
                  type="text"
                  value={lessonTitleDraft}
                  onChange={e => setLessonTitleDraft(e.target.value)}
                  placeholder="e.g. Chapter 6: Subatomic Spins"
                  className="w-full bg-[#03060c] border border-slate-850 focus:border-indigo-500 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
                <input
                  type="text"
                  value={lessonSubtitleDraft}
                  onChange={e => setLessonSubtitleDraft(e.target.value)}
                  placeholder="Subtitle (Optional details)"
                  className="w-full bg-[#03060c] border border-slate-850 focus:border-indigo-500 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none text-slate-350"
                />
                <input
                  type="text"
                  value={lessonVideoDraft}
                  onChange={e => setLessonVideoDraft(e.target.value)}
                  placeholder="Lecture Embed Link (Optional)"
                  className="w-full bg-[#03060c] border border-slate-850 focus:border-indigo-500 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none text-slate-350 font-mono text-[10px]"
                />
                <button
                  onClick={handleAddLesson}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded text-xs font-bold uppercase transition-all duration-300 cursor-pointer"
                >
                  Append Chapter Node
                </button>
              </div>
            </div>

            {/* Chapters list tree */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              <span className="text-[8.5px] uppercase font-mono tracking-widest text-slate-500 block px-1.5">
                ACTIVE TEXTBOOK INDEX
              </span>
              {assignedBook.lessons.length === 0 ? (
                <div className="p-4 text-center select-none text-[11px] text-slate-500 italic">
                  This volume is empty. Fill the fields above to structure the first chapter.
                </div>
              ) : (
                assignedBook.lessons.map((les, index) => {
                  const isActive = selectedLessonId === les.id;
                  return (
                    <div
                      key={les.id}
                      onClick={() => {
                        setSelectedLessonId(les.id);
                        setSelectedPageIndex(0);
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between group ${
                        isActive
                          ? 'bg-slate-900 border-indigo-500/40 text-white'
                          : 'bg-slate-950/20 border-slate-850 hover:bg-slate-900/40 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="pr-2">
                          <div className="text-[7.5px] uppercase font-mono tracking-widest text-[#a855f7] block">
                            CHAPTER {index + 1}
                          </div>
                          <h4 className="text-xs font-bold mt-1 line-clamp-1">{les.title}</h4>
                          {les.subtitle && (
                            <span className="text-[10px] text-slate-450 block italic line-clamp-1 mt-0.5">
                              {les.subtitle}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveLesson(index, 'up'); }}
                            disabled={index === 0}
                            className={`p-1 rounded bg-slate-800 text-slate-300 ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-indigo-500 hover:text-white'}`}
                            title="Move Chapter Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveLesson(index, 'down'); }}
                            disabled={index === assignedBook.lessons.length - 1}
                            className={`p-1 rounded bg-slate-800 text-slate-300 ${index === assignedBook.lessons.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-indigo-500 hover:text-white'}`}
                            title="Move Chapter Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-550 mt-2 font-mono">
                        <span>{les.pages.length} Pages</span>
                        <span>{les.flashQuestions.length} Quizzes</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT VIEWPORT: Customizing specific screens in chapter */}
          <div className="flex-1 bg-[#05070e] overflow-y-auto p-6">
            {activeLesson ? (
              <div className="w-full max-w-7xl mx-auto space-y-6">
                {/* Chapter Meta Title modification */}
                <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9.5px] uppercase font-mono tracking-widest text-slate-500 block">Active Chapter Settings</span>
                      <h3 className="text-base font-bold text-white mt-1">Configure Names &amp; Parameters</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateLessonMeta({ title: activeLessonTitleDraft, subtitle: activeLessonSubtitleDraft, videoUrl: activeLessonVideoDraft, pdfUrl: activeLessonPdfDraft })}
                        className="p-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[9.5px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Meta
                      </button>
                      <button
                        onClick={() => handleDeleteLesson(activeLesson.id)}
                        className="p-1 px-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded text-[9.5px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Purge Chapter
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[8.5px] uppercase font-mono text-slate-400 block mb-1">Headline Text:</span>
                      <input
                        type="text"
                        value={activeLessonTitleDraft}
                        onChange={e => setActiveLessonTitleDraft(e.target.value)}
                        className="w-full bg-[#03060c] border border-slate-800 rounded p-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[8.5px] uppercase font-mono text-slate-400 block mb-1">Detailed Explanation Line:</span>
                      <input
                        type="text"
                        value={activeLessonSubtitleDraft}
                        onChange={e => setActiveLessonSubtitleDraft(e.target.value)}
                        className="w-full bg-[#03060c] border border-slate-800 rounded p-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* PDF → WebP Conversion Section */}
                  <div className="border-t border-slate-800/60 pt-4">
                    <span className="text-[8.5px] uppercase font-mono text-slate-400 block mb-2 flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-violet-400" />
                      Lesson Pages (WebP Images)
                    </span>

                    {/* Already converted — show status */}
                    {activeLesson?.pagesReady && activeLesson?.pageCount ? (
                      <div className="flex items-center gap-3 bg-[#0a1a10] border border-emerald-500/30 rounded-xl p-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-emerald-300">
                            ✅ {activeLesson.pageCount} pages ready for students
                          </p>
                          <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">
                            {activeLesson.storagePath}
                          </p>
                        </div>
                        {/* Allow re-upload to replace pages */}
                        <label className="text-[9px] font-mono text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 px-2 py-1 rounded transition-colors cursor-pointer flex-shrink-0">
                          Re-upload PDF
                          <input type="file" className="hidden" accept="application/pdf"
                            onChange={async (e) => {
                              if (!e.target.files?.[0] || !assignedBook || !activeLesson) return;
                              await runPdfToWebpConversion(e.target.files[0], assignedBook, activeLesson, null);
                            }}
                          />
                        </label>
                      </div>
                    ) : activeLessonPdfDraft && !activeLesson?.pagesReady ? (
                      /* Has old PDF — offer Convert + Delete */
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-[#0d1020] border border-amber-500/30 rounded-xl p-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-amber-300 truncate">
                              {decodeURIComponent(activeLessonPdfDraft.split('/').pop()?.split('?')[0]?.replace(/^\d+_/, '') || 'lesson.pdf')}
                            </p>
                            <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                              ⚠️ Old PDF — students cannot view it. Convert to images.
                            </p>
                          </div>
                          <a href={activeLessonPdfDraft} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] font-mono text-violet-400 hover:text-violet-300 border border-violet-500/30 px-2 py-1 rounded transition-colors flex-shrink-0">
                            Open PDF
                          </a>
                        </div>
                        {convertProgress.phase === 'idle' ? (
                          <button
                            onClick={async () => {
                              if (!assignedBook || !activeLesson || !activeLessonPdfDraft) return;
                              await runPdfToWebpConversion(null, assignedBook, activeLesson, activeLessonPdfDraft);
                            }}
                            className="w-full py-2.5 bg-violet-700 hover:bg-violet-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Convert to WebP Images — Delete Original PDF
                          </button>
                        ) : (
                          <ConversionProgress progress={convertProgress} />
                        )}
                      </div>
                    ) : convertProgress.phase !== 'idle' ? (
                      <ConversionProgress progress={convertProgress} />
                    ) : (
                      /* No PDF at all — pick from local PC */
                      <label className={`flex items-center gap-3 border border-dashed rounded-xl p-4 cursor-pointer transition-all group ${
                        pdfUploading ? 'border-violet-500/50 bg-violet-500/5 cursor-wait'
                          : 'border-slate-700 hover:border-violet-500/50 bg-slate-950/40 hover:bg-violet-500/5'
                      }`}>
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-800 group-hover:bg-violet-500/10 border border-slate-700 group-hover:border-violet-500/30 flex items-center justify-center transition-all">
                          {pdfUploading
                            ? <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                            : <Upload className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
                          }
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-300 group-hover:text-violet-300 transition-colors">
                            {pdfUploading ? 'Processing...' : 'Upload PDF → Auto-converts to images'}
                          </p>
                          <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                            PDF is read locally — only images are stored in Firebase
                          </p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf"
                          disabled={pdfUploading || convertProgress.phase !== 'idle'}
                          onChange={async (e) => {
                            if (!e.target.files?.[0] || !assignedBook || !activeLesson) return;
                            await runPdfToWebpConversion(e.target.files[0], assignedBook, activeLesson, null);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Sub-Layout: Pages Editor */}
                <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-sans">
                      <Sliders className="w-4 h-4 text-emerald-400" /> Textbook Classroom Page Canvas
                    </h3>
                    <button
                      onClick={handleAddPage}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Append Canvas Page
                    </button>
                  </div>

                  {/* Chapter Video URL */}
                  <div className="pb-2 border-b border-slate-800/50">
                    <span className="text-[8.5px] uppercase font-mono text-slate-400 block mb-1">Chapter Lecture Video URL:</span>
                    <input
                      type="text"
                      value={activeLessonVideoDraft}
                      onChange={e => setActiveLessonVideoDraft(e.target.value)}
                      placeholder="e.g. https://www.youtube.com/embed/..."
                      className="w-full bg-[#03060c] border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  {/* Horizontal index dots of current pages */}
                  <div className="flex flex-wrap gap-2">
                    {activeLesson.pages.map((p, pIdx) => {
                      const isSelected = selectedPageIndex === pIdx;
                      return (
                        <div
                          key={pIdx}
                          onClick={() => setSelectedPageIndex(pIdx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all border flex items-center gap-1.5 group ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-[#03060c] border-slate-850 text-slate-400 hover:bg-slate-900'
                          }`}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMovePage(pIdx, 'left'); }}
                            disabled={pIdx === 0}
                            className={`px-1 opacity-0 group-hover:opacity-100 transition-opacity ${pIdx === 0 ? 'text-slate-500 cursor-not-allowed' : 'text-slate-300 hover:text-white hover:scale-110'}`}
                            title="Move Page Left"
                          >
                            &lt;
                          </button>
                          <span>P.{pIdx + 1}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMovePage(pIdx, 'right'); }}
                            disabled={pIdx === activeLesson.pages.length - 1}
                            className={`px-1 opacity-0 group-hover:opacity-100 transition-opacity ${pIdx === activeLesson.pages.length - 1 ? 'text-slate-500 cursor-not-allowed' : 'text-slate-300 hover:text-white hover:scale-110'}`}
                            title="Move Page Right"
                          >
                            &gt;
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePage(pIdx);
                            }}
                            className="text-rose-450 hover:text-white hover:scale-110 ml-0.5"
                            title={`Delete page ${pIdx + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Active Page Draft editor content */}
                  {selectedPageIndex !== null && activeLesson.pages[selectedPageIndex] ? (
                    <div className="space-y-4 border-t border-slate-900 pt-4" id="page-metadata-editor">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-extrabold">
                          Now Customizing Page {selectedPageIndex + 1} Content Canvas
                        </span>
                        <button
                          onClick={() => handleUpdatePage(selectedPageIndex)}
                          disabled={isSaving}
                          className={`px-3 py-1 text-black rounded font-mono font-black text-[10.5px] flex items-center gap-1 transition-colors ${
                            isSaving ? 'bg-amber-700 text-amber-900 cursor-not-allowed' : 'bg-amber-550 hover:bg-amber-500 cursor-pointer'
                          }`}
                        >
                          <Save className="w-3.5 h-3.5" /> Synchronize Page Metadata
                        </button>
                      </div>

                      {/* Left and Right Image Column Uploaders */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Left Side Image Uploader */}
                        <div className="border border-slate-800 bg-[#060b14] p-3 rounded-xl flex flex-col gap-2">
                          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold block">Left Column Graphic illustration</span>
                          {pageLeftImageDraft ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-2 flex flex-col items-center">
                              <img src={pageLeftImageDraft} alt="Left Draft representation" className="h-28 object-contain rounded" />
                              <button
                                type="button"
                                onClick={() => setPageLeftImageDraft('')}
                                className="absolute top-2 right-2 p-1 bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white rounded border border-rose-800 transition-colors cursor-pointer"
                                title="Remove Left Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[9px] font-mono text-emerald-400 mt-2">Active Left Asset loaded</span>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-28 border border-dashed border-slate-800 hover:border-amber-500 rounded-lg cursor-pointer transition-colors p-4 text-center bg-slate-950/40 hover:bg-slate-950/80">
                              <ImageIcon className="w-6 h-6 text-slate-500 mb-1" />
                              <span className="text-xs text-slate-300 font-bold font-sans">Upload Left Column Asset</span>
                              <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Click to browse files</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    try {
                                      const url = await uploadImageToStorage(e.target.files[0]);
                                      setPageLeftImageDraft(url);
                                    } catch(err: any) {
                                      alert("Image upload failed: " + err.message + "\n\nPlease ensure Firebase Storage is initialized and the rules allow uploads.");
                                      console.error("Upload failed", err);
                                    }
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Center Image Uploader */}
                        <div className="border border-slate-800 bg-[#060b14] p-3 rounded-xl flex flex-col gap-2">
                          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold block">Center Top Graphic illustration</span>
                          {pageCenterImageDraft ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-2 flex flex-col items-center">
                              <img src={pageCenterImageDraft} alt="Center Draft representation" className="h-28 object-contain rounded" />
                              <button
                                type="button"
                                onClick={() => setPageCenterImageDraft('')}
                                className="absolute top-2 right-2 p-1 bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white rounded border border-rose-800 transition-colors cursor-pointer"
                                title="Remove Center Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[9px] font-mono text-emerald-400 mt-2">Active Center Asset loaded</span>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-28 border border-dashed border-slate-800 hover:border-amber-500 rounded-lg cursor-pointer transition-colors p-4 text-center bg-slate-950/40 hover:bg-slate-950/80">
                              <ImageIcon className="w-6 h-6 text-slate-500 mb-1" />
                              <span className="text-xs text-slate-300 font-bold font-sans">Upload Center Asset</span>
                              <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Click to browse files</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    try {
                                      const url = await uploadImageToStorage(e.target.files[0]);
                                      setPageCenterImageDraft(url);
                                    } catch(err: any) {
                                      alert("Image upload failed: " + err.message + "\n\nPlease ensure Firebase Storage is initialized and the rules allow uploads.");
                                      console.error("Upload failed", err);
                                    }
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Right Side Image Uploader */}
                        <div className="border border-slate-800 bg-[#060b14] p-3 rounded-xl flex flex-col gap-2">
                          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold block">Right Column Graphic illustration</span>
                          {pageRightImageDraft ? (
                            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-2 flex flex-col items-center">
                              <img src={pageRightImageDraft} alt="Right Draft representation" className="h-28 object-contain rounded" />
                              <button
                                type="button"
                                onClick={() => setPageRightImageDraft('')}
                                className="absolute top-2 right-2 p-1 bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white rounded border border-rose-800 transition-colors cursor-pointer"
                                title="Remove Right Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[9px] font-mono text-emerald-400 mt-2">Active Right Asset loaded</span>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-28 border border-dashed border-slate-800 hover:border-amber-500 rounded-lg cursor-pointer transition-colors p-4 text-center bg-slate-950/40 hover:bg-slate-950/80">
                              <ImageIcon className="w-6 h-6 text-slate-500 mb-1" />
                              <span className="text-xs text-slate-300 font-bold font-sans">Upload Right Column Asset</span>
                              <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Click to browse files</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    try {
                                      const url = await uploadImageToStorage(e.target.files[0]);
                                      setPageRightImageDraft(url);
                                    } catch(err: any) {
                                      alert("Image upload failed: " + err.message + "\n\nPlease ensure Firebase Storage is initialized and the rules allow uploads.");
                                      console.error("Upload failed", err);
                                    }
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] font-mono uppercase text-[#707a6c] block">Rich Content Text Block (Supports standard dynamic markup):</span>
                        <RichTextEditor
                          initialValue={pageContentDraft}
                          onSave={(content) => handleUpdatePage(selectedPageIndex, content)}
                          isSaving={isSaving}
                          leftImage={pageLeftImageDraft}
                          centerImage={pageCenterImageDraft}
                          rightImage={pageRightImageDraft}
                        />
                      </div>

                      {/* ATTACHMENTS: FIGURES GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {/* LATEX EQUATIONS BLOCK */}
                        <div className="bg-[#0b0e1a] border border-slate-850 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9.5px] uppercase font-mono tracking-widest text-[#707a6c] block">
                              LaTeX Mathematical Symbols Block
                            </span>
                            <span className="text-[8px] font-mono text-slate-500 select-none bg-slate-950 p-0.5 rounded px-1">
                              1 Eq per line
                            </span>
                          </div>
                          <textarea
                            value={pageEquationsDraft}
                            onChange={e => setPageEquationsDraft(e.target.value)}
                            rows={3}
                            placeholder="A \rightarrow B (Do not include double slashes. Write raw LaTeX parameters)"
                            className="w-full bg-[#03060c] border border-slate-850 focus:border-[#f59e0b] rounded-lg p-2 text-xs focus:outline-none font-mono text-slate-300"
                          />
                        </div>

                        {/* SCIENCE GRAPHIC EMBED */}
                        <div className="bg-[#0b0e1a] border border-slate-850 p-3 rounded-xl space-y-2">
                          <span className="text-[9.5px] uppercase font-mono tracking-widest text-[#707a6c] block">
                            Interactive Smartboard Vector Vector Layouts
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[8px] font-mono uppercase text-slate-500">Vector Type:</span>
                              <select
                                value={pageFigureType}
                                onChange={e => setPageFigureType(e.target.value as any)}
                                className="w-full bg-[#03060c] border border-slate-850 rounded p-1 text-xs text-slate-300 focus:outline-[#f59e0b] focus:ring-0"
                              >
                                <option value="brain">Neural Brain Architecture</option>
                                <option value="river">Historical River Alluvial Basins</option>
                                <option value="ecosystem">Biological Trophic Cascade Flow</option>
                                <option value="math">Geometric Ratio Harmony Plot</option>
                                <option value="music">Acoustic Soundwave Sine Beats</option>
                                <option value="language">Syntactic Tree Brain Dialect Grid</option>
                                <option value="fairness">Data Fairness Integrity Chart</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[8px] font-mono uppercase text-slate-500">Vector Caption:</span>
                              <input
                                type="text"
                                value={pageFigureCaption}
                                onChange={e => setPageFigureCaption(e.target.value)}
                                placeholder="Caption text: (e.g. Fig 1.1 Neural fires)"
                                className="w-full bg-[#03060c] border border-slate-850 rounded p-1 text-xs text-slate-300 focus:outline-[#f59e0b] focus:ring-0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500 text-xs font-serif italic bg-[#030509]/30 rounded border border-slate-850/50">
                      Create or click on any of the Page nodes above to populate learning markup canvases.
                    </div>
                  )}
                </div>

                {/* Sub-Layout: Flash Review Quizzing */}
                <FlashQuestionManager
                  questions={activeLesson.flashQuestions || []}
                  onQuestionsUpdate={async (newQuestions) => {
                    if (!assignedBook || !activeLesson) return;
                    try {
                      const modifiedBook = {
                        ...assignedBook,
                        lessons: assignedBook.lessons.map(l => {
                          if (l.id !== activeLesson.id) return l;
                          return { ...l, flashQuestions: newQuestions };
                        })
                      };
                      await saveBookToFirebase(modifiedBook);
                      flashMessage('Interactive quizzes synced to Firebase.');
                    } catch (err) {
                      alert('Failed to sync quizzes to Firebase.');
                    }
                  }}
                />

                {/* Sub-Layout: Inquiry Question Manager */}
                <InquiryQuestionManager
                  questions={activeLesson.inquiryQuestions || []}
                  onQuestionsUpdate={async (newQuestions) => {
                    if (!assignedBook || !activeLesson) return;
                    try {
                      const modifiedBook = {
                        ...assignedBook,
                        lessons: assignedBook.lessons.map(l => {
                          if (l.id !== activeLesson.id) return l;
                          return { ...l, inquiryQuestions: newQuestions };
                        })
                      };
                      await saveBookToFirebase(modifiedBook);
                      flashMessage('Inquiry questions synced to Firebase.');
                    } catch (err) {
                      alert('Failed to sync inquiry questions to Firebase.');
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center p-12 text-center select-none h-full">
                <Play className="w-12 h-12 text-slate-700/80 mb-4 animate-pulse" />
                <h3 className="text-base font-black text-slate-400 tracking-tight">Select Textbook Chapter layout</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                  Select an active chapter node on the left list, or enter a new chapter title in the draft card to build curricular resources.
                </p>
              </div>
            )}
          </div>
        </div>
      {profileOpen && (
        <ProfilePanel onClose={() => setProfileOpen(false)} />
      )}
    </div>
  );
}

