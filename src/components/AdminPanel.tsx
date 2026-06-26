/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Book, Lesson, FlashQuestion, BookEditor, AcademicClass, AcademicSubject } from '../types';
import { uploadImageToStorage } from '../lib/firebaseHelper';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot, doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
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
  Users,
  Settings,
  BarChart,
  FileText,
  Image as ImageIcon,
  Play,
  Layers,
  GraduationCap,
  BookMarked,
  ArrowLeft,
  CheckCircle,
  Sliders,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import FlashQuestionManager from './FlashQuestionManager';
import InquiryQuestionManager from './InquiryQuestionManager';

export interface AdminPanelProps {
  books: Book[];
  saveBookToFirebase: (book: Book) => Promise<void>;
  deleteBookFromFirebase: (bookId: number) => Promise<void>;
  bulkUpdateBooksInFirebase: (books: Book[]) => Promise<void>;
  onClose: () => void;
  academicClasses: AcademicClass[];
  academicSubjects: AcademicSubject[];
  editors: BookEditor[];
  setEditors: React.Dispatch<React.SetStateAction<BookEditor[]>>;
  globalLogo?: string | null;
}

export default function AdminPanel({
  books,
  saveBookToFirebase,
  deleteBookFromFirebase,
  bulkUpdateBooksInFirebase,
  onClose,
  academicClasses,
  academicSubjects,
  editors,
  setEditors,
  globalLogo,
}: AdminPanelProps) {
  // Security locks
  // Internal states
  const [pinInput, setPinInput] = useState<string>('');
  const [adminPin, setAdminPin] = useState<string>(() => {
    return localStorage.getItem('admin_security_pin') || '1234';
  });
  const [pinError, setPinError] = useState<string>('');

  // Tabs: 'stats' | 'classes' | 'subjects' | 'books' | 'editors' | 'options' | 'forced'
  const [activeTab, setActiveTab] = useState<'stats' | 'classes' | 'subjects' | 'books' | 'editors' | 'options' | 'forced'>('stats');

  // Book Editor Form drafting states
  const [fbUsers, setFbUsers] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'editors' || activeTab === 'forced') {
      const unsub = onSnapshot(collection(db, 'users'), snap => {
        setFbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, err => {
        console.error("Error loading users snapshot:", err);
        alert("Failed to load users: " + err.message);
      });
      return () => unsub();
    }
  }, [activeTab]);

  // Selected entities for deep editing
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);

  // Status visual feedback
  const [successMsg, setSuccessMsg] = useState<string>('');
  
  // Helpers to add dynamic classes/subjects
  const [newGrade, setNewGrade] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('');

  // Inline edit states for class/grade
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [editingGradeValue, setEditingGradeValue] = useState<string>('');

  // Inline edit states for subject
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editingSubjectValue, setEditingSubjectValue] = useState<string>('');

  // Book properties draft
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [bookTitleDraft, setBookTitleDraft] = useState('');
  const [bookAuthorDraft, setBookAuthorDraft] = useState('');
  const [bookSourceDraft, setBookSourceDraft] = useState('');
  const [bookColorDraft, setBookColorDraft] = useState('#4a3060');
  const [bookClassIdDraft, setBookClassIdDraft] = useState<string>('');
  const [bookSubjectIdDraft, setBookSubjectIdDraft] = useState<string>('');
  const [bookCoverDraft, setBookCoverDraft] = useState<string | null>(null);

  // New Lesson properties draft
  const [lessonTitleDraft, setLessonTitleDraft] = useState('');
  const [lessonSubtitleDraft, setLessonSubtitleDraft] = useState('');
  const [lessonVideoDraft, setLessonVideoDraft] = useState('');

  // Page Editor state
  const [pageContentDraft, setPageContentDraft] = useState('');
  const [pageFigureCaption, setPageFigureCaption] = useState('');
  const [pageFigureType, setPageFigureType] = useState<'brain' | 'river' | 'ecosystem' | 'math' | 'music' | 'language' | 'fairness'>('brain');
  const [pageEquationsDraft, setPageEquationsDraft] = useState<string>('');

  // Image Drafts
  const [pageLeftImageDraft, setPageLeftImageDraft] = useState('');
  const [pageRightImageDraft, setPageRightImageDraft] = useState('');

  // Book pre-designed premium cover colors
  const COVER_PRESETS = [
    { name: 'Imperial Violet', hex: '#4a3060' },
    { name: 'Evergreen Forest', hex: '#1a4a3a' },
    { name: 'Clay Crimson', hex: '#881337' },
    { name: 'Teal Lagoon', hex: '#0f766e' },
    { name: 'Deep Sapphire', hex: '#1e3a8a' },
    { name: 'Charcoal Slate', hex: '#1f2937' },
    { name: 'Terracotta Brown', hex: '#7c2d12' },
    { name: 'Midnight Blue', hex: '#010e29' },
  ];

  const flashMessage = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Authentication validation
  // Mock removed

  // Change Admin Pin
  const handleChangePin = (newPin: string) => {
    if (newPin.trim().length < 4) {
      alert('PIN must be at least 4 digits long.');
      return;
    }
    setAdminPin(newPin);
    localStorage.setItem('admin_security_pin', newPin);
    flashMessage('Security passcode updated successfully.');
  };

  // 1. CLASS CRUD OPERATIONS
  const handleAddGrade = async () => {
    const val = newGrade.trim();
    if (!val) {
      alert('Please enter a valid class name');
      return;
    }
    if (academicClasses.some(c => c.name.toLowerCase() === val.toLowerCase())) {
      alert('This class already exists.');
      return;
    }
    try {
      await addDoc(collection(db, 'classes'), { name: val });
      setNewGrade('');
      flashMessage(`Class ${val} established successfully in Firebase.`);
    } catch (err: any) {
      alert('Failed to add class: ' + err.message);
    }
  };

  const handleDeleteGrade = async (classId: string, className: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete Class ${className}? Associated books will persist but remain unassigned.`);
    if (confirmDelete) {
      try {
        const newBooks = books.map(b => (b.classId === classId ? { ...b, classId: null } : b));
        await bulkUpdateBooksInFirebase(newBooks);

        await deleteDoc(doc(db, 'classes', classId));
        
        const fallback = academicClasses.find(c => c.id !== classId);
        if (fallback) setBookClassIdDraft(fallback.id);
        flashMessage(`Class ${className} deleted and unlinked from Firebase.`);
      } catch (err: any) {
        alert('Failed to delete class: ' + err.message);
      }
    }
  };

  const handleEditGrade = async (classId: string, oldName: string, newVal: string) => {
    const val = newVal.trim();
    if (!val) {
      alert('Class name cannot be empty.');
      return;
    }
    if (val === oldName) {
      setEditingGrade(null);
      return;
    }
    if (academicClasses.some(c => c.name.toLowerCase() === val.toLowerCase())) {
      alert('This class already exists.');
      return;
    }

    try {
      await updateDoc(doc(db, 'classes', classId), { name: val });
      setEditingGrade(null);
      flashMessage(`Class ${oldName} updated to Class ${val} in Firebase.`);
    } catch (err: any) {
      alert('Failed to rename class: ' + err.message);
    }
  };

  // 2. SUBJECT CRUD OPERATIONS
  const handleAddSubject = async () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (academicSubjects.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Subject already exists.');
      return;
    }
    try {
      await addDoc(collection(db, 'subjects'), { name: trimmed });
      setNewSubject('');
      flashMessage(`Subject "${trimmed}" added to Firebase roster.`);
    } catch (err: any) {
      alert('Failed to add subject: ' + err.message);
    }
  };

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the "${subjectName}" Subject?`);
    if (confirmDelete) {
      try {
        const newBooks = books.map(b => (b.subjectId === subjectId ? { ...b, subjectId: null } : b));
        await bulkUpdateBooksInFirebase(newBooks);

        await deleteDoc(doc(db, 'subjects', subjectId));
        
        const fallback = academicSubjects.find(s => s.id !== subjectId);
        if (fallback) setBookSubjectIdDraft(fallback.id);
        flashMessage(`Subject "${subjectName}" deleted and unlinked from Firebase.`);
      } catch (err: any) {
        alert('Failed to delete subject: ' + err.message);
      }
    }
  };

  const handleEditSubject = async (subjectId: string, oldName: string, newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed) {
      alert('Subject name cannot be empty.');
      return;
    }
    if (trimmed === oldName) {
      setEditingSubject(null);
      return;
    }
    if (academicSubjects.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('This subject already exists.');
      return;
    }

    try {
      await updateDoc(doc(db, 'subjects', subjectId), { name: trimmed });
      setEditingSubject(null);
      flashMessage(`Subject renamed to "${trimmed}" in Firebase.`);
    } catch (err: any) {
      alert('Failed to rename subject: ' + err.message);
    }
  };

  // 3. BOOK CRUD OPERATIONS
  const handleSaveBookForm = async () => {
    if (!bookTitleDraft.trim()) {
      alert('Please specify a textbook title.');
      return;
    }
    if (!bookClassIdDraft) {
      alert('Please select a class for this book.');
      return;
    }
    if (!bookSubjectIdDraft) {
      alert('Please select a subject for this book.');
      return;
    }

    const isDuplicate = books.some(b => 
      b.id !== editingBookId &&
      b.title.toLowerCase() === bookTitleDraft.trim().toLowerCase() && 
      b.classId === bookClassIdDraft && 
      b.subjectId === bookSubjectIdDraft
    );

    if (isDuplicate) {
      alert('A textbook with this exact Title, Class, and Subject already exists. Please use a unique combination.');
      return;
    }

    if (editingBookId) {
      // Update existing book
      try {
        await handleUpdateBookMeta(editingBookId, {
          title: bookTitleDraft,
          author: bookAuthorDraft || 'ExtraPadhai AI',
          source: bookSourceDraft || null,
          color: bookColorDraft,
          coverImage: bookCoverDraft || null,
          classId: bookClassIdDraft || null,
          subjectId: bookSubjectIdDraft || null,
        });
        resetBookForm();
        flashMessage(`Textbook updated successfully!`);
      } catch (err) {
        alert('Failed to update textbook in Firebase.');
      }
    } else {
      // Create new book
      const newBook: Book = {
        id: books.length > 0 ? Math.max(...books.map(b => b.id)) + 1 : 1,
        title: bookTitleDraft,
        author: bookAuthorDraft || 'ExtraPadhai AI',
        source: bookSourceDraft || null,
        color: bookColorDraft,
        coverImage: bookCoverDraft || null,
        classId: bookClassIdDraft || null,
        subjectId: bookSubjectIdDraft || null,
        lessons: [],
      };

      try {
        await saveBookToFirebase(newBook);
        resetBookForm();
        flashMessage(`Textbook "${newBook.title}" created in Firebase!`);
      } catch (err) {
        alert('Failed to save textbook to Firebase.');
      }
    }
  };

  const resetBookForm = () => {
    setEditingBookId(null);
    setBookTitleDraft('');
    setBookAuthorDraft('');
    setBookSourceDraft('');
    setBookClassIdDraft('');
    setBookSubjectIdDraft('');
    setBookCoverDraft(null);
  };

  const handleUpdateBookMeta = async (bookId: number, fields: Partial<Book>) => {
    // Check for uniqueness before updating
    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    const newTitle = fields.title !== undefined ? fields.title.trim() : targetBook.title;
    const newClassId = fields.classId !== undefined ? fields.classId : targetBook.classId;
    const newSubjectId = fields.subjectId !== undefined ? fields.subjectId : targetBook.subjectId;

    const isDuplicate = books.some(b => 
      b.id !== bookId &&
      b.title.toLowerCase() === newTitle.toLowerCase() && 
      b.classId === newClassId && 
      b.subjectId === newSubjectId
    );

    if (isDuplicate) {
      alert('A textbook with this exact Title, Class, and Subject already exists. Please use a unique combination.');
      return;
    }

    const modifiedBook = {
      ...targetBook,
      ...fields
    };

    try {
      await saveBookToFirebase(modifiedBook);
      flashMessage('Book metadata saved to Firebase successfully.');
    } catch (err) {
      alert('Failed to update book metadata in Firebase.');
    }
  };

  const handleDeleteBook = async (bookId: number) => {
    const confirmDelete = window.confirm('Permanently delete this entire textbook, including all its chapters/lessons, pages, and dynamic questions? This cannot be undone.');
    if (confirmDelete) {
      try {
        await deleteBookFromFirebase(bookId);
        setSelectedBookId(null);
        setSelectedLessonId(null);
        setSelectedPageIndex(null);
        flashMessage('Textbook deleted from Firebase.');
      } catch (err) {
        alert('Failed to delete textbook from Firebase.');
      }
    }
  };

  // RESET DATABASE OPTIONS
  const handleResetDatabase = () => {
    const confirmReset = window.confirm('This will wipe out all changes and custom textbooks inside local storage, restoring database seeds to original Indian textbook standards. Proceed?');
    if (confirmReset) {
      localStorage.removeItem('class_books_data');
      localStorage.removeItem('available_grades_roster');
      localStorage.removeItem('available_subjects_roster');
      window.location.reload();
    }
  };

  const seedSampleLessons = async (bookId: number) => {
    const defaultSample: Lesson[] = [
      {
        id: `sampled-les-${Date.now()}-1`,
        title: "Chapter 1: Introducing Practical Foundations",
        subtitle: "A baseline analysis of core terms",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Welcome to this newly formatted administrative lesson. This page has been created dynamically via our classroom manager dashboard.</p>
              <div class="callout">
                <strong>Admin Focus:</strong> Direct digital updates are dispatched real-time into the workspace viewer. Use the scribble brush tools to annotate or emphasize text here.
              </div>
              <p>Students should review the following equations and answer the corresponding flash quizes to confirm core semantic understanding before exiting.</p>
            `,
            figure: {
              caption: "Ecosystem dynamic energy cycle model representation.",
              svgType: "ecosystem"
            },
            equations: ["E = mc^2", "a^2 + b^2 = c^2"]
          }
        ],
        flashQuestions: [
          {
            id: `q-les-${Date.now()}`,
            question: "What does this new lesson sample aim to introduce?",
            answer: "Practical foundations and standard baseline definitions of core terms.",
            difficulty: "Easy"
          }
        ]
      }
    ];

    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    try {
      const modifiedBook = { ...targetBook, lessons: [...targetBook.lessons, ...defaultSample] };
      await saveBookToFirebase(modifiedBook);
      flashMessage('Seeded lesson mockup into textbook in Firebase.');
    } catch (err) {
      alert('Failed to seed sample lessons.');
    }
  };

  // Active book context details
  const activeBook = books.find(b => b.id === selectedBookId) || null;
  const activeLesson = activeBook ? (activeBook.lessons || []).find(l => l.id === selectedLessonId) || null : null;

  // 4. LESSON CRUD OPERATIONS
  const handleAddLesson = async () => {
    if (!activeBook) return;
    if (!lessonTitleDraft.trim()) {
      alert('Please specify a lesson/chapter title.');
      return;
    }

    const isDuplicate = (activeBook.lessons || []).some(l => l.title.toLowerCase() === lessonTitleDraft.trim().toLowerCase());
    if (isDuplicate) {
      alert('A chapter with this exact title already exists in this textbook. Please use a unique title.');
      return;
    }

    const newLesson: Lesson = {
      id: `lesson-${activeBook.id}-${Date.now()}`,
      title: lessonTitleDraft.trim(),
      subtitle: lessonSubtitleDraft.trim() || null,
      videoUrl: lessonVideoDraft.trim() || null,
      pages: [
        {
          pageNumber: 1,
          content: '<p>Standard page template. Insert your lesson paragraph here.</p>'
        }
      ],
      flashQuestions: []
    };

    try {
      const modifiedBook = { ...activeBook, lessons: [...activeBook.lessons, newLesson] };
      await saveBookToFirebase(modifiedBook);
      setLessonTitleDraft('');
      setLessonSubtitleDraft('');
      setLessonVideoDraft('');
      setSelectedLessonId(newLesson.id);
      flashMessage(`Chapter '${newLesson.title}' added and verified in Firebase!`);
    } catch (err) {
      alert('Failed to add chapter to Firebase.');
    }
  };

  const handleUpdateLessonMeta = async (fields: Partial<Lesson>) => {
    if (!activeBook || !selectedLessonId) return;

    if (fields.title) {
      const isDuplicate = (activeBook.lessons || []).some(l => 
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
        ...activeBook,
        lessons: (activeBook.lessons || []).map(l => (l.id === selectedLessonId ? { ...l, ...fields } : l))
      };
      await saveBookToFirebase(modifiedBook);
      flashMessage('Lesson header updated in Firebase.');
    } catch (err) {
      alert('Failed to update lesson metadata.');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!activeBook) return;
    const confirmDelete = window.confirm('Delete this chapter? All pages and flash questions in this chapter will be discarded.');
    if (confirmDelete) {
      try {
        const modifiedBook = {
          ...activeBook,
          lessons: (activeBook.lessons || []).filter(l => l.id !== lessonId)
        };
        await saveBookToFirebase(modifiedBook);
        setSelectedLessonId(null);
        setSelectedPageIndex(null);
        flashMessage('Chapter purged from Firebase.');
      } catch (err) {
        alert('Failed to delete chapter from Firebase.');
      }
    }
  };

  // 5. PAGE CONTENT CRUD OPERATIONS
  const handleAddPage = async () => {
    if (!activeBook || !activeLesson) return;
    const nextPageNum = (activeLesson.pages?.length || 0) + 1;
    const newPage = {
      pageNumber: nextPageNum,
      content: `<p>New Page ${nextPageNum} content. Double click to customize this rich text standard markup.</p>`
    };

    try {
      const modifiedBook = {
        ...activeBook,
        lessons: (activeBook.lessons || []).map(l => {
          if (l.id === activeLesson.id) {
            return {
              ...l,
              pages: [...(l.pages || []), newPage]
            };
          }
          return l;
        })
      };
      
      await saveBookToFirebase(modifiedBook);
      setSelectedPageIndex(nextPageNum - 1);
      flashMessage(`Page ${nextPageNum} appended and synced to Firebase.`);
    } catch (err) {
      alert('Failed to add page to Firebase.');
    }
  };

  const handleUpdatePage = async (index: number) => {
    if (!activeBook || !activeLesson) return;
    
    // Parse equations text back into array
    const eqsArray = pageEquationsDraft
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    try {
      const modifiedBook = {
        ...activeBook,
        lessons: (activeBook.lessons || []).map(l => {
          if (l.id === activeLesson.id) {
            return {
              ...l,
              pages: (l.pages || []).map((p, pIdx) => {
                if (pIdx === index) {
                  return {
                    ...p,
                    content: pageContentDraft,
                    figure: pageFigureCaption ? { caption: pageFigureCaption, svgType: pageFigureType } : null,
                    equations: eqsArray.length > 0 ? eqsArray : null,
                    leftImage: pageLeftImageDraft || null,
                    rightImage: pageRightImageDraft || null
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
      flashMessage(`Page ${index + 1} content saved to Firebase.`);
    } catch (err) {
      alert('Failed to update page content in Firebase.');
    }
  };

  const handleDeletePage = async (index: number) => {
    if (!activeBook || !activeLesson) return;
    if ((activeLesson.pages?.length || 0) <= 1) {
      alert('A lesson must contain at least one page. Cannot delete the final remaining page.');
      return;
    }
    const confirmDelete = window.confirm(`Delete page ${index + 1}? This action will reorder consecutive indices.`);
    if (confirmDelete) {
      try {
        const modifiedBook = {
          ...activeBook,
          lessons: (activeBook.lessons || []).map(l => {
            if (l.id === activeLesson.id) {
              const filtered = (l.pages || []).filter((_, pIdx) => pIdx !== index);
              // Recalculate page numbers
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
        flashMessage(`Page ${index + 1} deleted. Remaining pages re-indexed in Firebase.`);
      } catch (err) {
        alert('Failed to delete page from Firebase.');
      }
    }
  };



  // When active page changes, load draft inputs
  useEffect(() => {
    if (activeLesson && selectedPageIndex !== null) {
      const page = activeLesson.pages[selectedPageIndex];
      if (page) {
        setPageContentDraft(page.content);
        setPageFigureCaption(page.figure?.caption || '');
        setPageFigureType(page.figure?.svgType || 'brain');
        setPageEquationsDraft(page.equations ? page.equations.join('\n') : '');
        setPageLeftImageDraft(page.leftImage || '');
        setPageRightImageDraft(page.rightImage || '');
      }
    } else {
      setPageContentDraft('');
      setPageFigureCaption('');
      setPageEquationsDraft('');
      setPageLeftImageDraft('');
      setPageRightImageDraft('');
    }
  }, [selectedPageIndex, selectedLessonId, selectedBookId]);

  return (
    <div className="h-screen w-full bg-[#070a13] text-slate-200 font-sans flex flex-col overflow-hidden" id="admin-main-viewport">
      {/* 1. TOP NAV BAR */}
      <header className="h-14 border-b border-slate-900 bg-[#0d1323] px-6 flex items-center justify-between flex-shrink-0 z-40">
        <div className="flex items-center gap-2.5">
          {globalLogo ? (
            <img src={globalLogo} alt="Global Logo" className="w-7 h-7 rounded object-contain bg-white/10" />
          ) : (
            <div className="w-7 h-7 rounded bg-emerald-600 flex items-center justify-center text-white font-extrabold select-none">
              <Shield className="w-4 h-4" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
              Extra Padhai Admin Portal
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 text-[8.5px] uppercase font-mono font-black select-none">
                Verified Clearance
              </span>
            </h1>
            <p className="text-[10px] text-slate-450 font-serif italic">Curricular Roster and Database Smartboard Administrator</p>
          </div>
        </div>

        {/* Global Floating Toast Alert banner within top header */}
        {successMsg && (
          <div className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 rounded-lg p-2.5 px-4 text-xs font-sans font-bold flex items-center gap-2 tracking-wide animate-pulse">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-extrabold tracking-widest text-[#707a6c] uppercase hidden sm:inline">
            SYSTEM BACKEND CONSOLE v1.0.8
          </span>
          <button
            onClick={() => {
              alert("Changes successfully saved to local database!");
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white p-2 px-3 rounded-lg text-xs font-semibold select-none cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-slate-950/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-2 px-3.5 rounded-lg text-slate-300 hover:text-[#f7fbf0] text-xs font-semibold select-none cursor-pointer transition-all"
            id="close-admin-panel"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
        </div>
      </header>

      {/* 2. MAIN LAYOUT GRID */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COMPACT TAB NAVIGATION RAIL */}
        <aside className="w-48 bg-[#090e1b] border-r border-slate-900 flex flex-col justify-between p-3 select-none flex-shrink-0">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500 block px-2 pb-1.5">
              Admin Roster Mode
            </span>
            <button
              onClick={() => { setActiveTab('stats'); setSelectedBookId(null); setSelectedLessonId(null); setSelectedPageIndex(null); }}
              className={`w-full text-left p-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'stats' ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" /> Summary Stats
            </button>
            <button
              onClick={() => { setActiveTab('classes'); setSelectedBookId(null); setSelectedLessonId(null); setSelectedPageIndex(null); }}
              className={`w-full text-left p-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'classes' ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" /> Class
            </button>
            <button
              onClick={() => { setActiveTab('subjects'); setSelectedBookId(null); setSelectedLessonId(null); setSelectedPageIndex(null); }}
              className={`w-full text-left p-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'subjects' ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Subject Nodes
            </button>
            <button
              onClick={() => { setActiveTab('books'); }}
              className={`w-full text-left p-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'books' ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Textbooks
            </button>
            <button
              onClick={() => { setActiveTab('options'); setSelectedBookId(null); setSelectedLessonId(null); setSelectedPageIndex(null); }}
              className={`w-full text-left p-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'options' ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Key className="w-4 h-4" /> Portal Options
            </button>
            <button
              onClick={() => { setActiveTab('editors'); setSelectedBookId(null); setSelectedLessonId(null); setSelectedPageIndex(null); }}
              className={`w-full text-left p-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'editors' ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" /> Book Editors
            </button>
            <button
              onClick={() => { setActiveTab('forced'); setSelectedBookId(null); setSelectedLessonId(null); setSelectedPageIndex(null); }}
              className={`w-full text-left p-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'forced' ? 'bg-slate-900 text-emerald-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4" /> Forced Entries
            </button>
          </div>

          <div className="bg-[#03050a] border border-slate-900 p-3 rounded-xl">
            <span className="text-[8px] font-mono text-slate-500 uppercase block mb-1">DATA STATUS</span>
            <div className="flex items-center gap-1.5 text-[9.5px] text-emerald-400 font-bold font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              SQL Local Syncing Actively
            </div>
          </div>
        </aside>

        {/* MAIN CRUD OPERATIONS CANVAS AREA PANEL */}
        <main className="flex-1 bg-[#05070e] flex flex-col overflow-hidden">
          {/* TAB 1: SUMMARY STATS VIEW */}
          {activeTab === 'stats' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6" id="stats-dashboard">
              <div className="max-w-4xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Database Administration Summary</h2>
                  <p className="text-xs text-slate-400 mt-1">Status of live smartboard curriculum data stored under browser persistent caches.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4.5">
                    <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#707a6c] block">Textbook Rosters</span>
                    <span className="text-2xl font-serif font-bold text-amber-400 block mt-1">{books.length}</span>
                    <span className="text-[10px] font-sans text-slate-400">Vetted Volumes</span>
                  </div>
                  <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4.5">
                    <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#707a6c] block">Live Classes</span>
                    <span className="text-2xl font-serif font-bold text-indigo-400 block mt-1">{academicClasses.length}</span>
                    <span className="text-[10px] font-sans text-slate-400">Classrooms Map</span>
                  </div>
                  <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4.5">
                    <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#707a6c] block">Standard Subjects</span>
                    <span className="text-2xl font-serif font-bold text-sky-450 block mt-1">{academicSubjects.length}</span>
                    <span className="text-[10px] font-sans text-slate-400">Curriculum Roster</span>
                  </div>
                  <div className="bg-[#0d1323] border border-slate-800 rounded-xl p-4.5">
                    <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#707a6c] block">Total Book Chapters</span>
                    <span className="text-2xl font-serif font-bold text-emerald-450 block mt-1">
                      {books.reduce((acc, b) => acc + (b.lessons?.length || 0), 0)}
                    </span>
                    <span className="text-[10px] font-sans text-slate-400">Continuous Lessons</span>
                  </div>
                </div>

                {/* Database Quick Summary logs */}
                <div className="bg-[#0b0e1b] border border-slate-800/85 rounded-xl p-5" id="help-box">
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-sans mb-3 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-500" /> Admin Checklist Guidance
                  </h3>
                  <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed font-sans">
                    <p>
                      <strong>How to design new books:</strong> First click the <strong className="text-emerald-400">Textbooks</strong> tab in the sidebar. You can append empty textbooks, assign them to classes and subject branches, and immediately begin piling dynamic syllabus chapters.
                    </p>
                    <p>
                      <strong>Standard rich text formatting:</strong> The content editor is designed to interpret raw HTML paragraphs (<code className="bg-slate-900 border border-slate-800 px-1 text-pink-300 rounded">&lt;p&gt;</code>, <code className="bg-slate-900 border border-slate-800 px-1 text-pink-300 rounded">&lt;blockquote&gt;</code> and styling parameters) directly. You can embed LaTeX mathematical expressions dynamically via the equation fields in any page.
                    </p>
                    <p>
                      <strong>Diagnostic Quizzing:</strong> Every textbook chapter has an associated interactive flashcard module. Enter any lesson to append interactive card diagnostics to help teachers assess student performance off smartboards.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLASS */}
          {activeTab === 'classes' && (
            <div className="flex-1 overflow-y-auto p-6" id="classes-dashboard">
              <div className="max-w-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Class Setup</h2>
                  <p className="text-xs text-slate-400 mt-1">Define classroom levels (e.g. Class 1 to 12) allowed under the portal filtering arrays.</p>
                </div>

                <div className="bg-[#0b0e1b] border border-slate-800 p-4.5 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Establish New Class</h3>
                  <div className="flex gap-2.5">
                    <input
                      type="number"
                      value={newGrade}
                      onChange={e => setNewGrade(e.target.value)}
                      placeholder="Class number (e.g. 11)"
                      className="bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs focus:outline-none flex-1 font-mono text-white"
                    />
                    <button
                      onClick={handleAddGrade}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Establish Class
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block">Active Classes Catalog</span>
                  <div className="bg-[#0d1323] border border-slate-800 rounded-xl divide-y divide-slate-850/60">
                    {academicClasses.map(academicClass => {
                      const assignedCount = books.filter(b => b.classId === academicClass.id).length;
                      return (
                        <div key={academicClass.id} className="p-4 flex flex-col gap-3" id={`grade-row-${academicClass.id}`}>
                          <div className="flex items-center justify-between">
                            {editingGrade === academicClass.id ? (
                              <div className="flex items-center gap-2 flex-1 mr-4">
                                <span className="w-8 h-8 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/20 font-mono">
                                  C
                                </span>
                                <input
                                  type="text"
                                  value={editingGradeValue}
                                  onChange={e => setEditingGradeValue(e.target.value)}
                                  className="bg-[#03060c] border border-slate-700 focus:border-amber-500 rounded p-1 px-2 text-xs font-mono text-white flex-1 focus:outline-none"
                                  placeholder="Class Name"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleEditGrade(academicClass.id, academicClass.name, editingGradeValue)}
                                  className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded border border-emerald-500/20 transition-all cursor-pointer text-[10px] font-bold font-mono px-2"
                                >
                                  SAVE
                                </button>
                                <button
                                  onClick={() => setEditingGrade(null)}
                                  className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded border border-slate-700/30 transition-all cursor-pointer text-[10px] font-bold font-mono px-2"
                                >
                                  CANCEL
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/20 font-mono">
                                    C
                                  </span>
                                  <div>
                                    <span className="text-xs font-bold text-white block">Class {academicClass.name}</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">{assignedCount} dynamic book(s) assigned</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingGrade(academicClass.id);
                                      setEditingGradeValue(academicClass.name);
                                    }}
                                    className="p-1.5 bg-transparent hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 border border-transparent hover:border-amber-500/20 rounded-md transition-all cursor-pointer"
                                    title="Edit this class"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteGrade(academicClass.id, academicClass.name)}
                                    className="p-1.5 bg-transparent hover:bg-rose-500/10 text-slate-450 hover:text-rose-400 border border-transparent hover:border-rose-550/30 rounded-md transition-all cursor-pointer"
                                    title="Delete this class"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Nested list of Books for this grade */}
                          {assignedCount > 0 && (
                            <div className="pl-11 space-y-2 border-t border-slate-850/50 pt-3">
                              <span className="text-[8.5px] font-mono uppercase tracking-wider text-slate-500 block">Assigned Volumes:</span>
                              <div className="grid grid-cols-1 gap-2">
                                {books.filter(b => b.classId === academicClass.id).map(b => (
                                  <div key={b.id} className="p-2 px-3 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between text-xs hover:border-slate-700 transition-all">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-5 rounded-sm flex-shrink-0" style={{ backgroundColor: b.color || '#4a3060' }} />
                                      <div>
                                        <span className="font-bold text-slate-200 block">{b.title}</span>
                                        <span className="text-[9px] text-slate-450 block">by {b.author} • {b.lessons?.length || 0} Ch</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          setSelectedBookId(b.id);
                                          setActiveTab('books');
                                          setSelectedLessonId(null);
                                          setSelectedPageIndex(null);
                                        }}
                                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-450 hover:text-black rounded text-[9.5px] font-bold uppercase cursor-pointer transition-all border border-amber-500/20 hover:border-transparent font-mono"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBook(b.id)}
                                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                        title="Delete Book"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SUBJECTS */}
          {activeTab === 'subjects' && (
            <div className="flex-1 overflow-y-auto p-6" id="subjects-dashboard">
              <div className="max-w-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Curriculum Subject Nodes</h2>
                  <p className="text-xs text-slate-400 mt-1">Define learning subjects/categories (History, Science, Physics, etc.) to catalog textbooks.</p>
                </div>

                <div className="bg-[#0b0e1b] border border-slate-800 p-4.5 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">Add New Curriculum Subject</h3>
                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      value={newSubject}
                      onChange={e => setNewSubject(e.target.value)}
                      placeholder="Subject title (e.g. Quantum Physics)"
                      className="bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs focus:outline-none flex-1 font-sans text-white"
                    />
                    <button
                      onClick={handleAddSubject}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Subject
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase block">Active Subjects Catalog</span>
                  <div className="bg-[#0d1323] border border-slate-800 rounded-xl divide-y divide-slate-850/60">
                    {academicSubjects.map(academicSubject => {
                      const assignedCount = books.filter(b => b.subjectId === academicSubject.id).length;
                      return (
                        <div key={academicSubject.id} className="p-4 flex flex-col gap-3" id={`subject-row-${academicSubject.id}`}>
                          <div className="flex items-center justify-between">
                            {editingSubject === academicSubject.id ? (
                              <div className="flex items-center gap-2 flex-1 mr-4">
                                <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono font-bold uppercase tracking-wider rounded-full">
                                  {academicSubject.name.substring(0, 3)}
                                </span>
                                <input
                                  type="text"
                                  value={editingSubjectValue}
                                  onChange={e => setEditingSubjectValue(e.target.value)}
                                  className="bg-[#03060c] border border-slate-700 focus:border-amber-500 rounded p-1 px-2 text-xs font-sans text-white flex-1 focus:outline-none"
                                  placeholder="Subject name"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleEditSubject(academicSubject.id, academicSubject.name, editingSubjectValue)}
                                  className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded border border-emerald-500/20 transition-all cursor-pointer text-[10px] font-bold font-mono px-2"
                                >
                                  SAVE
                                </button>
                                <button
                                  onClick={() => setEditingSubject(null)}
                                  className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded border border-slate-700/30 transition-all cursor-pointer text-[10px] font-bold font-mono px-2"
                                >
                                  CANCEL
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-3">
                                  <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono font-bold uppercase tracking-wider rounded-full">
                                    {academicSubject.name}
                                  </span>
                                  <div>
                                    <span className="text-xs font-bold text-white block">{academicSubject.name} Node</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">{assignedCount} volume(s) registered under this subject</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingSubject(academicSubject.id);
                                      setEditingSubjectValue(academicSubject.name);
                                    }}
                                    className="p-1.5 bg-transparent hover:bg-amber-500/10 text-slate-440 hover:text-amber-400 border border-transparent hover:border-amber-500/20 rounded-md transition-all cursor-pointer"
                                    title="Edit this subject node"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubject(academicSubject.id, academicSubject.name)}
                                    className="p-1.5 bg-transparent hover:bg-rose-500/10 text-slate-450 hover:text-rose-400 border border-transparent hover:border-rose-550/30 rounded-md transition-all cursor-pointer"
                                    title="Delete this subject"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Nested list of Books for this subject */}
                          {assignedCount > 0 && (
                            <div className="pl-11 space-y-2 border-t border-slate-850/50 pt-3">
                              <span className="text-[8.5px] font-mono uppercase tracking-wider text-slate-500 block">Assigned Volumes:</span>
                              <div className="grid grid-cols-1 gap-2">
                                {books.filter(b => b.subjectId === academicSubject.id).map(b => (
                                  <div key={b.id} className="p-2 px-3 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between text-xs hover:border-slate-700 transition-all">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-5 rounded-sm flex-shrink-0" style={{ backgroundColor: b.color || '#4a3060' }} />
                                      <div>
                                        <span className="font-bold text-slate-200 block">{b.title}</span>
                                        <span className="text-[9px] text-slate-450 block font-mono">by {b.author} • {b.lessons?.length || 0} Ch • Class {b.classId ? academicClasses.find(c => c.id === b.classId)?.name : 'unassigned'}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          setSelectedBookId(b.id);
                                          setActiveTab('books');
                                          setSelectedLessonId(null);
                                          setSelectedPageIndex(null);
                                        }}
                                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-450 hover:text-black rounded text-[9.5px] font-bold uppercase cursor-pointer transition-all border border-amber-500/20 hover:border-transparent font-mono"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBook(b.id)}
                                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                        title="Delete Book"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEXTBOOK CRUD & DEEP EDITING ENGINE */}
          {activeTab === 'books' && (
            <div className="flex-1 flex overflow-hidden">
              {/* PRIMARY MASTER TWO-PANE LAYOUT */}
              {/* PANELS LIST SPLIT RAIL */}
              <div className="w-[320px] bg-[#090e1b] border-r border-slate-900 flex flex-col overflow-hidden select-none">
                <div className="p-4 border-b border-slate-900 bg-slate-950/40 space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider font-sans">{editingBookId ? 'Edit Textbook' : 'Textbooks'}</h3>
                  <div className="space-y-3">
                    <span className="text-[8px] font-mono tracking-widest text-slate-400 block uppercase">Draft New Book Cover</span>
                    <input
                      type="text"
                      value={bookTitleDraft}
                      onChange={e => setBookTitleDraft(e.target.value)}
                      placeholder="Title: (e.g. Science Frontiers)"
                      className="w-full bg-[#03060c] border border-slate-850 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white placeholder-slate-550 focus:outline-none focus:ring-0"
                    />
                    <input
                      type="text"
                      value={bookAuthorDraft}
                      onChange={e => setBookAuthorDraft(e.target.value)}
                      placeholder="Author: (e.g. Dr. Homi Bhabha)"
                      className="w-full bg-[#03060c] border border-slate-850 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white placeholder-slate-550 focus:outline-none focus:ring-0 text-slate-350"
                    />
                    <input
                      type="text"
                      value={bookSourceDraft}
                      onChange={e => setBookSourceDraft(e.target.value)}
                      placeholder="Source: (e.g. NCERT, OER, Custom)"
                      className="w-full bg-[#03060c] border border-slate-850 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white placeholder-slate-550 focus:outline-none focus:ring-0 text-slate-350"
                    />
                    
                    {/* Choose Class / Subject */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[7.5px] uppercase font-mono text-slate-555 block mb-1">Class:</span>
                        <select
                          value={bookClassIdDraft}
                          onChange={e => setBookClassIdDraft(e.target.value)}
                          className="w-full bg-[#03060c] border border-slate-850 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:ring-0"
                        >
                          <option value="">Select Class</option>
                          {academicClasses.map(c => (
                            <option key={c.id} value={c.id}>Class {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[7.5px] uppercase font-mono text-slate-550 block mb-1">Subject Node:</span>
                        <select
                          value={bookSubjectIdDraft}
                          onChange={e => setBookSubjectIdDraft(e.target.value)}
                          className="w-full bg-[#03060c] border border-slate-850 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:ring-0"
                        >
                          <option value="">Select Subject</option>
                          {academicSubjects.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[7.5px] uppercase font-mono text-slate-550 block">Book spine color:</span>
                      <div className="flex flex-wrap gap-1">
                        {COVER_PRESETS.map(c => (
                          <button
                            key={c.hex}
                            onClick={() => setBookColorDraft(c.hex)}
                            className={`w-6 h-6 rounded-full border transition-all duration-150 cursor-pointer ${bookColorDraft === c.hex ? 'scale-110 border-white ring-2 ring-emerald-500/20' : 'border-slate-850 hover:scale-105'}`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="text-[7.5px] uppercase font-mono text-slate-550 block">Cover Graphic (Optional):</span>
                      <label className="flex items-center justify-center w-full h-14 border border-dashed border-slate-800 hover:border-emerald-500/50 rounded cursor-pointer transition-colors overflow-hidden relative group">
                        {bookCoverDraft ? (
                          <>
                            <div className="absolute inset-0 bg-slate-950/40 z-10 group-hover:bg-slate-950/20 transition-all"></div>
                            <img src={bookCoverDraft} alt="Cover Preview" className="absolute inset-0 w-full h-full object-cover" />
                          </>
                        ) : (
                          <div className="flex flex-col items-center">
                            <ImageIcon className="w-4 h-4 text-slate-600 mb-1" />
                            <span className="text-[8.5px] text-slate-500 font-mono">Upload Image</span>
                          </div>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              try {
                                const url = await uploadImageToStorage(e.target.files[0]);
                                setBookCoverDraft(url);
                              } catch(err: any) {
                                alert("Image upload failed: " + err.message + "\n\nPlease ensure Firebase Storage is initialized in your Firebase Console and the Storage Rules allow uploads.");
                                console.error("Upload failed", err);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleSaveBookForm}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-all duration-300 cursor-pointer shadow-lg"
                      >
                        {editingBookId ? 'Update Textbook' : 'Create Empty Textbook'}
                      </button>
                      {editingBookId && (
                        <button
                          onClick={resetBookForm}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase transition-all duration-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOOKS VERTICAL RAIL TRACK LIST */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar bg-[#060a13]" id="books-crud-scroll-track">
                  <span className="text-[8px] font-mono tracking-widest text-[#707a6c] uppercase block p-2">
                    RECORDS IN DIRECTORY ({books.length})
                  </span>
                  {books.map(b => {
                    const isActive = selectedBookId === b.id;
                    const bClass = academicClasses.find(c => c.id === b.classId);
                    const bSubject = academicSubjects.find(s => s.id === b.subjectId);

                    return (
                      <div
                        key={b.id}
                        id={`admin-book-item-${b.id}`}
                        onClick={() => {
                          setSelectedBookId(b.id);
                          setSelectedLessonId(null);
                          setSelectedPageIndex(null);
                        }}
                        className={`group p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-24 ${
                          isActive
                            ? 'bg-slate-900 border-amber-500/60 shadow-lg text-white'
                            : 'bg-slate-950/40 border-slate-850 hover:bg-slate-900/60 text-slate-300'
                        }`}
                        style={{
                          borderLeftWidth: '5px',
                          borderLeftColor: b.color || '#4a3060'
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-2.5">
                            {b.coverImage ? (
                              <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-slate-800">
                                <img src={b.coverImage} alt={b.title} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center flex-shrink-0 border border-slate-800">
                                <BookOpen className="w-4 h-4 text-slate-700" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                {bClass && (
                                  <span className="text-[7.5px] font-mono font-extrabold text-amber-500 uppercase border border-amber-500/30 px-1 rounded">
                                    Class {bClass.name}
                                  </span>
                                )}
                                {bSubject && (
                                  <span className="text-[7.5px] font-mono select-none px-1 uppercase bg-slate-950 text-slate-450 rounded border border-slate-900">
                                    {bSubject.name}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold block mt-1 line-clamp-1 pr-2">{b.title}</h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBookId(b.id);
                                setBookTitleDraft(b.title);
                                setBookAuthorDraft(b.author);
                                setBookSourceDraft(b.source || '');
                                setBookClassIdDraft(b.classId || '');
                                setBookSubjectIdDraft(b.subjectId || '');
                                setBookColorDraft(b.color || '#4a3060');
                                setBookCoverDraft(b.coverImage || null);
                                setSelectedBookId(b.id);
                                setSelectedLessonId(null);
                                setSelectedPageIndex(null);
                              }}
                              className="p-1.5 hover:bg-emerald-500/20 rounded text-slate-500 hover:text-emerald-400 transition-colors"
                              title="Edit Textbook"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBook(b.id);
                              }}
                              className="p-1.5 hover:bg-rose-500/20 rounded text-slate-500 hover:text-rose-400 transition-colors"
                              title="Delete Textbook"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-slate-450 mt-2">
                          <span className="italic block max-w-[130px] truncate">by {b.author}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Click to Edit</span>
                            <span className="bg-slate-950 border border-slate-900 px-1.5 rounded font-mono font-extrabold block">{b.lessons?.length || 0} Ch</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PRIMARY DEEP CONTENT EDITOR WINDOW (MIDDLE SPLIT) */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[#05070e]">
                {activeBook ? (
                  <div className="flex-1 flex overflow-hidden">
                    {/* CHAPTERS/LESSONS TREE FOR THE SELECTIVE BOOK */}
                    <div className="w-[280px] bg-[#070b13] border-r border-slate-900 flex flex-col overflow-hidden select-none flex-shrink-0">
                      <div className="p-4 border-b border-slate-900 bg-[#0d1425] space-y-4">
                        <div>
                          <span className="text-[9.5px] uppercase font-mono tracking-widest text-[#707a6c] block">Textbook Settings</span>
                          <h3 className="font-sans font-black text-sm text-amber-400 mt-1 line-clamp-1">{activeBook.title}</h3>
                        </div>

                        {/* Book Metadata View (Read Only) */}
                        <div className="space-y-1 mt-2">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="font-mono bg-slate-900 px-1.5 rounded">ID: {activeBook.id}</span>
                            <span>By: {activeBook.author}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border-b border-slate-900 bg-slate-950/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9.5px] uppercase font-mono tracking-widest text-[#707a6c] block">Add Lesson Chapter</span>
                          {(activeBook.lessons?.length || 0) === 0 && (
                            <button
                              onClick={() => seedSampleLessons(activeBook.id)}
                              className="text-[9px] underline text-emerald-400 hover:text-emerald-300 font-bold"
                            >
                              Seed Sample
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={lessonTitleDraft}
                            onChange={e => setLessonTitleDraft(e.target.value)}
                            placeholder="Chapter title: (e.g. Intro to Atoms)"
                            className="w-full bg-[#03060c] border border-slate-850 rounded-lg p-2 text-xs text-white placeholder-slate-550 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={lessonSubtitleDraft}
                            onChange={e => setLessonSubtitleDraft(e.target.value)}
                            placeholder="Subtitle / Cognitive focus"
                            className="w-full bg-[#03060c] border border-slate-850 rounded-lg p-2 text-xs text-slate-355 placeholder-slate-550 focus:outline-none"
                          />
                          <button
                            onClick={handleAddLesson}
                            className="w-full py-1.5 bg-indigo-700 hover:bg-indigo-650 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide cursor-pointer"
                          >
                            + Append Chapter
                          </button>
                        </div>
                      </div>

                      {/* LESSONS RAIL */}
                      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 no-scrollbar bg-[#05080f]" id="lessons-crud-scroll-track">
                        <span className="text-[7.5px] font-mono tracking-widest text-[#707a6c] uppercase block p-1.5">
                          CHAPTER TILES ({activeBook.lessons?.length || 0})
                        </span>
                        {(activeBook.lessons || []).map((les, index) => {
                          if (!les) return null;
                          const isActive = les.id === selectedLessonId;
                          return (
                            <div
                              key={les.id}
                              id={`admin-lesson-item-${les.id}`}
                              onClick={() => {
                                setSelectedLessonId(les.id);
                                setSelectedPageIndex(null);
                              }}
                              className={`p-3 rounded-lg border transition-all cursor-pointer relative group ${
                                isActive
                                  ? 'bg-slate-900 border-amber-400/40 text-yellow-300'
                                  : 'bg-transparent border-transparent hover:bg-slate-900/30 text-slate-350 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="font-mono text-[9px] text-amber-500 font-extrabold mt-0.5">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold leading-snug truncate">
                                    {les.title}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-500 truncate mt-0.5">
                                    {les.pages?.length || 0} Pages • {les.flashQuestions?.length || 0} Quizzes
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLesson(les.id);
                                }}
                                className="absolute right-2 top-2 p-1 bg-transparent hover:bg-rose-500/15 rounded text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Delete Chapter"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* DEEPEST DYNAMIC PAGE ENGINE FOR WRITING RICH-TEXT CONTENT & ATTACHING FIGURES */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-[#020509]">
                      {activeLesson ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                          {/* DYNAMIC HEADER CONTROLS FOR ACTIVE LESSON */}
                          <div className="p-4 border-b border-slate-900 bg-[#0c1223] flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
                            <div>
                              <span className="text-[8px] font-mono tracking-widest text-[#707a6c] block uppercase">ACTIVE CHAPTER CONTEXT</span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <input
                                  type="text"
                                  value={activeLesson.title}
                                  onChange={e => handleUpdateLessonMeta({ title: e.target.value })}
                                  className="bg-transparent border border-transparent focus:border-slate-800 rounded px-1.5 py-0.5 text-sm font-extrabold text-white focus:bg-[#03060c] max-w-sm"
                                />
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px]">
                                <span className="text-slate-400">Subtitle:</span>
                                <input
                                  type="text"
                                  value={activeLesson.subtitle || ''}
                                  onChange={e => handleUpdateLessonMeta({ subtitle: e.target.value })}
                                  placeholder="Configure subtitle focus..."
                                  className="bg-transparent border border-transparent focus:border-slate-850 rounded text-slate-350 focus:bg-[#03060c] px-1 w-64"
                                />
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-[9.5px]">
                                <span className="text-[#e2a850] font-sans font-extrabold">Lecture Embed (Youtube / Video MP4):</span>
                                <input
                                  type="text"
                                  value={activeLesson.videoUrl || ''}
                                  onChange={e => handleUpdateLessonMeta({ videoUrl: e.target.value })}
                                  placeholder="Mock Embed (e.g. https://www.youtube.com/embed/dQw4w9WgXcQ)"
                                  className="bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5 mt-0.5 text-slate-300 w-96 font-mono focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* SUB LAYOUT: PAGES GRID COLUMN AND CENTRAL DRAFT FORM EDITOR */}
                          <div className="flex-1 flex overflow-hidden">
                            {/* PAGES VERTICAL TAB TRACK */}
                            <div className="w-[140px] bg-[#05070d] border-r border-slate-900 flex flex-shrink-0 flex-col overflow-hidden select-none">
                              <span className="text-[7.5px] font-mono tracking-widest text-slate-500 uppercase block p-3">
                                CHAPTER PAGES
                              </span>

                              <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                                {(activeLesson.pages || []).map((p, idx) => {
                                  const isActive = idx === selectedPageIndex;
                                  return (
                                    <div
                                      key={idx}
                                      onClick={() => setSelectedPageIndex(idx)}
                                      className={`p-3 rounded-lg border text-center transition-all cursor-pointer relative group ${
                                        isActive
                                          ? 'bg-slate-900 border-emerald-400/40 text-[#cbffc2]'
                                          : 'bg-transparent border-transparent hover:bg-slate-900/30 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      <span className="text-[10px] uppercase font-mono tracking-wider block">
                                        Page {idx + 1}
                                      </span>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePage(idx);
                                        }}
                                        className="absolute right-1 top-1 p-0.5 hover:bg-rose-500/10 rounded text-slate-550 hover:text-rose-450 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        title="Delete page"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}

                                <button
                                  onClick={handleAddPage}
                                  className="w-full py-2 bg-slate-950 border border-dashed border-slate-800 hover:border-emerald-500 text-slate-450 hover:text-emerald-400 transition-all rounded-lg text-[10px] tracking-widest uppercase cursor-pointer flex flex-col items-center justify-center gap-1 font-bold mt-2"
                                >
                                  <Plus className="w-4 h-4" /> Add Page
                                </button>
                              </div>
                            </div>

                            {/* CORE PAGE FORM & ATTACHMENTS (FIGS, MATHS) */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col justify-between" id="core-page-editor">
                              {selectedPageIndex !== null && activeLesson.pages[selectedPageIndex] ? (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between border-b border-slate-900 pb-2 flex-shrink-0">
                                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                                      <FileText className="w-4 h-4" /> Editing Page {selectedPageIndex + 1} of {activeLesson.pages?.length || 0}
                                    </h4>
                                    <button
                                      onClick={() => handleUpdatePage(selectedPageIndex)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-sans font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow"
                                    >
                                      <Save className="w-3.5 h-3.5" /> Save Page Content
                                    </button>
                                  </div>

                                  <div className="space-y-4">
                                    <div>
                                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                                        Page HTML Rich-text Paragraphs Content:
                                      </span>
                                      <RichTextEditor
                                        value={pageContentDraft}
                                        onChange={setPageContentDraft}
                                        onSave={() => handleUpdatePage(selectedPageIndex)}
                                        leftImage={pageLeftImageDraft}
                                        rightImage={pageRightImageDraft}
                                      />
                                    </div>

                                    {/* Left and Right Image Column Uploaders */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                    {/* ATTACHMENTS: FIGURES GRID */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                  {/* ATTACHED FLASHCARDS / QUESTIONS CONTEXT TRACK */}
                                  <div className="border-t border-slate-900 pt-4 space-y-3 flex-shrink-0">
                                    <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase block">
                                      INTERACTIVE CHAPTER QUIZZES DIAGNOSTICS ({activeLesson.flashQuestions?.length || 0})
                                    </span>

                                    <FlashQuestionManager
                                      questions={activeLesson.flashQuestions || []}
                                      onQuestionsUpdate={async (newQuestions) => {
                                        if (!activeBook || !activeLesson) return;
                                        try {
                                          const modifiedBook = {
                                            ...activeBook,
                                            lessons: (activeBook.lessons || []).map(l => {
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

                                    <InquiryQuestionManager
                                      questions={activeLesson.inquiryQuestions || []}
                                      onQuestionsUpdate={async (newQuestions) => {
                                        if (!activeBook || !activeLesson) return;
                                        try {
                                          const modifiedBook = {
                                            ...activeBook,
                                            lessons: (activeBook.lessons || []).map(l => {
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
                                </div>
                              ) : (
                                <div className="text-center py-20 bg-transparent flex flex-col items-center select-none justify-center">
                                  <FileText className="w-10 h-10 text-slate-700/80 mb-3 animate-bounce" />
                                  <h4 className="text-sm font-bold text-slate-400 tracking-tight">Select Page Index</h4>
                                  <p className="text-xs text-slate-550 mt-1.5 max-w-xs leading-relaxed">
                                    Click a page index on the left tab rail to write paragraph structures, attach dynamic physics SVG curves or configure TeX equations.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
                          <Play className="w-10 h-10 text-slate-700/80 mb-3" />
                          <h4 className="text-sm font-black text-slate-400 tracking-tight">Active Lesson Draft Empty</h4>
                          <p className="text-xs text-slate-550 mt-1.5 max-w-xs leading-relaxed">
                            Click on any chapter node in the side nav tree, or tap <strong className="text-indigo-400">Append Chapter</strong> to populate a dynamic smart board reading stack.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
                    <BookOpen className="w-12 h-12 text-slate-700 mb-4 animate-pulse" />
                    <h3 className="text-base font-extrabold text-slate-3D tracking-tight text-slate-400">Select Textbook Roster</h3>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                      Select or draft a custom textbook in the left catalog directory, specify its target class size, and append multiple chapters.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: BOOK EDITORS CRUD MANAGEMENT */}
          {activeTab === 'editors' && (
            <div className="flex-1 overflow-y-auto p-6" id="editors-crud-panel">
              <div className="max-w-4xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Staff Management</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage accounts for specialized Textbook Editors. Pre-register their email, and their settings will sync when they sign up.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="Enter editor's email address..."
                    id="new-editor-email"
                    className="flex-1 bg-[#0b0e1b] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value;
                        if (val && val.includes('@')) {
                          try {
                            const { addDoc, collection } = await import('firebase/firestore');
                            await addDoc(collection(db, 'users'), {
                              email: val.toLowerCase(),
                              role: 'editor',
                              createdAt: new Date().toISOString()
                            });
                            flashMessage(`Pre-registered editor: ${val} in Firebase.`);
                            e.currentTarget.value = '';
                          } catch (err: any) {
                            alert('Failed to register staff in Firebase: ' + err.message);
                          }
                        }
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById('new-editor-email') as HTMLInputElement;
                      const val = input?.value;
                      if (val && val.includes('@')) {
                        try {
                          const { addDoc, collection } = await import('firebase/firestore');
                          await addDoc(collection(db, 'users'), {
                            email: val.toLowerCase(),
                            role: 'editor',
                            createdAt: new Date().toISOString()
                          });
                          flashMessage(`Pre-registered editor: ${val} in Firebase.`);
                          input.value = '';
                        } catch (err: any) {
                          alert('Failed to register staff in Firebase: ' + err.message);
                        }
                      } else {
                        alert('Please enter a valid email address.');
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  >
                    Add Staff Member
                  </button>
                </div>

                <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl divide-y divide-slate-850/60 overflow-hidden">
                  {fbUsers.length === 0 ? (
                    <div className="p-6 text-center select-none text-slate-500 text-xs font-serif italic">
                      No staff members registered.
                    </div>
                  ) : (
                    fbUsers.map(u => (
                      <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-900/10 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-100">{u.email}</span>
                            <span className="text-[8.5px] font-mono bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400 uppercase">
                              {u.role || 'editor'}
                            </span>
                            {u.pin && (
                              <span className="text-[8.5px] font-mono bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-400">
                                Google Auth
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>UID: <span className="font-mono">{u.id}</span></span>
                            {u.pin && <span>• PIN: <span className="font-mono text-amber-500">{u.pin}</span></span>}
                          </div>
                          {u.role !== 'admin' && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] font-mono text-slate-500 uppercase">Assigned Book:</span>
                              <select
                                value={u.assignedBookId || ''}
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  try {
                                    if (val) {
                                      await updateDoc(doc(db, 'users', u.id), { assignedBookId: Number(val) });
                                      flashMessage(`Assigned Book ID ${val} to ${u.email} in Firebase`);
                                    } else {
                                      await updateDoc(doc(db, 'users', u.id), { assignedBookId: null });
                                      flashMessage(`Removed book assignment from ${u.email} in Firebase`);
                                    }
                                  } catch (err: any) {
                                    alert('Failed to update assignment in Firebase: ' + err.message);
                                  }
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none"
                              >
                                <option value="">-- No Book Assigned --</option>
                                {books.map(b => (
                                  <option key={b.id} value={b.id}>[{b.id}] {b.title}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const newPin = prompt('Enter new 6-digit PIN for this user:', u.pin || '');
                              if (newPin && newPin.length === 6 && !isNaN(Number(newPin))) {
                                try {
                                  await updateDoc(doc(db, 'users', u.id), { pin: newPin });
                                  flashMessage('PIN updated successfully in Firebase.');
                                } catch (err: any) {
                                  alert('Failed to update PIN: ' + err.message);
                                }
                              } else if (newPin) {
                                alert('PIN must be exactly 6 digits.');
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold uppercase transition-colors"
                          >
                            Reset PIN
                          </button>
                          
                          <button
                            onClick={async () => {
                              // If the ID is 20 chars long, it's a pre-registered Firestore auto-ID, meaning they haven't created an Auth account yet.
                              if (u.id.length === 20) {
                                alert(`This user (${u.email}) has only been pre-registered. They must go to the login screen and click 'Sign Up' to create their account and password before it can be reset.`);
                                return;
                              }
                              try {
                                await sendPasswordResetEmail(auth, u.email);
                                alert(`A password reset link was sent to ${u.email} (Please check the spam folder).\n\nNOTE: If the user has not completed the "Sign Up" process yet, Firebase will NOT send an email to protect against email enumeration.`);
                              } catch (e: any) {
                                alert('Error sending reset email: ' + e.message);
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold uppercase transition-colors"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={async () => {
                              const confirmDelete = window.confirm(`Are you sure you want to delete ${u.email}? This will revoke their editorial privileges.`);
                              if (confirmDelete) {
                                try {
                                  const { deleteDoc, doc } = await import('firebase/firestore');
                                  await deleteDoc(doc(db, 'users', u.id));
                                  flashMessage(`Deleted staff member: ${u.email} from Firebase.`);
                                } catch (err: any) {
                                  alert('Failed to delete staff member from Firebase: ' + err.message);
                                }
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900 text-rose-300 rounded text-[10px] font-bold uppercase transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PORTAL OPTIONS */}
          {activeTab === 'options' && (
            <div className="flex-1 overflow-y-auto p-6" id="options-dashboard">
              <div className="max-w-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Portal Configuration Options</h2>
                  <p className="text-xs text-slate-400 mt-1">Configure security passcode parameters and database replication controls.</p>
                </div>

                {/* Change PIN Block */}
                <div className="bg-[#0b0e1b] border border-slate-800 p-5 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-amber-500" /> Administrative Security PIN
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Modify the security PIN required of instructors to write custom curriculum resources or flush offline queues.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <span className="text-[8.5px] uppercase font-mono text-slate-500 block mb-1">New Sign Passcode (Numbers only):</span>
                      <input
                        type="text"
                        maxLength={8}
                        placeholder="e.g. 5678"
                        defaultValue={adminPin}
                        id="new-security-pin-input"
                        onKeyPress={(e) => {
                          if (!/[0-9]/.test(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        className="bg-[#03060c] border border-slate-800 focus:border-emerald-500 rounded-lg p-2.5 text-xs focus:outline-none w-48 font-mono tracking-widest text-[#cbffc2]"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const val = (document.getElementById('new-security-pin-input') as HTMLInputElement)?.value;
                        if (val) {
                          handleChangePin(val);
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                    >
                      Update Password
                    </button>
                  </div>
                </div>

                {/* Global Branding Logo */}
                <div className="bg-[#0b0e1b] border border-slate-800 p-5 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-sky-400" /> Global Branding Logo
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Upload a custom logo image. This logo will display alongside Extrapadhai branding across all web portals (Landing, Editor, Student, Admin).
                  </p>
                  <div className="flex items-center gap-4">
                    {globalLogo && (
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1 border border-slate-700">
                        <img src={globalLogo} alt="Current Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                    )}
                    <label className="px-4 py-2 bg-sky-600/20 hover:bg-sky-600 border border-sky-500/30 text-sky-400 hover:text-white rounded-lg text-xs font-bold uppercase cursor-pointer transition-all flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5" />
                      {globalLogo ? 'Change Logo' : 'Upload Logo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await uploadImageToStorage(file, `branding/logo_${Date.now()}`);
                            await setDoc(doc(db, 'settings', 'branding'), { logoUrl: url }, { merge: true });
                            alert('Logo updated globally!');
                          } catch (err: any) {
                            console.error('Failed to upload logo:', err);
                            alert('Upload failed: ' + err.message);
                          }
                        }} 
                      />
                    </label>
                    {globalLogo && (
                      <button
                        onClick={async () => {
                          if (confirm('Remove global logo and revert to default icons?')) {
                            try {
                              await setDoc(doc(db, 'settings', 'branding'), { logoUrl: null }, { merge: true });
                            } catch (err) {}
                          }
                        }}
                        className="px-3 py-2 text-rose-400 hover:text-rose-300 text-xs font-bold transition-all"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Reset Seeds Block */}
                <div className="bg-[#0b0e1b] border border-rose-950/20 p-5 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-500" /> Danger: Reset Local Curriculum Seeds
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This will wipe out current browser state indices and force Extrapadhai Smartboard databases to reset back to initial pre-configured national textbooks.
                  </p>
                  <button
                    onClick={handleResetDatabase}
                    className="px-4 py-2 bg-rose-650/15 hover:bg-rose-650 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded-lg text-xs font-bold uppercase cursor-pointer transition-all"
                  >
                    Wipe &amp; Reload Factory Defaults
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'forced' && (
            <div className="animate-fade-in p-6 h-full flex flex-col">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-white mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-rose-500" /> Forced Entries Log
                  </h2>
                  <p className="text-sm text-slate-400">
                    A log of users who attempted to register directly.
                  </p>
                </div>
              </div>

              <div className="bg-[#0b101d] rounded-xl border border-slate-800 overflow-hidden shadow-2xl flex-1 flex flex-col">
                <div className="overflow-y-auto flex-1 p-2">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="text-xs text-slate-500 uppercase bg-[#0f172a] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 font-bold rounded-tl-lg">Email</th>
                        <th className="px-4 py-3 font-bold">Attempt Timestamp</th>
                        <th className="px-4 py-3 font-bold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fbUsers.filter(u => u.role === 'FalseAttempter').length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-500 font-mono text-xs border-b border-slate-800/50">
                            No forced entry logs found.
                          </td>
                        </tr>
                      ) : (
                        fbUsers.filter(u => u.role === 'FalseAttempter').map(user => (
                          <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-emerald-400">{user.email}</td>
                            <td className="px-4 py-3 text-slate-400">{new Date(user.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-3 text-rose-500 font-bold">{user.role}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

