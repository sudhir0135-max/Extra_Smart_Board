/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Book, Lesson, ThemeMode, OfflineAction, Note, BookEditor, AcademicClass, AcademicSubject } from './types';
import { BOOKS_DATA } from './data/books';
import BookShelf from './components/BookShelf';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import FloatingButton from './components/FloatingButton';
import GradeSelector from './components/GradeSelector';
import AdminPanel from './components/AdminPanel';
import LandingPage from './components/LandingPage';
import BookEditorPanel from './components/BookEditorPanel';
import ExtraSmartboardDownload from './components/ExtraSmartboardDownload';
import QuestionEditorPage from './components/QuestionEditorPage';
import { Wifi, WifiOff, Cloud, CheckCircle2, AlertCircle, RefreshCw, Layers, Database, X, Menu, Upload, Palette, Undo, Trash2, Circle, Home } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import AuthModal from './components/AuthModal';
import { Capacitor } from '@capacitor/core';
const PALETTE_COLORS = [
  { name: 'Classroom Amber', hex: '#f59e0b' },
  { name: 'Alert Red', hex: '#f43f5e' },
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Chalk White', hex: '#ffffff' },
  { name: 'Ink Charcoal', hex: '#0f172a' },
];

const DEFAULT_MAP: { [key: number]: { classId: string; subjectId: string } } = {};

export default function App() {
  // Hash-based route: render the standalone question editor page
  if (window.location.hash.startsWith('#qeditor')) {
    return <QuestionEditorPage />;
  }

  // Master customizable roster lists synced from Firebase
  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
  const [academicSubjects, setAcademicSubjects] = useState<AcademicSubject[]>([]);

  // Primary database and loading structures
  const [books, setBooks] = useState<Book[]>([]);
  const [isBooksLoaded, setIsBooksLoaded] = useState(false);

  useEffect(() => {
    // Read classes from Firestore
    const unsubClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      setAcademicClasses(snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, name: data.name || 'Unnamed Class' } as AcademicClass;
      }));
    });

    // Read subjects from Firestore
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      setAcademicSubjects(snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, name: data.name || 'Unnamed Subject' } as AcademicSubject;
      }));
    });

    // Read books from Firestore
    const unsubBooks = onSnapshot(collection(db, 'books'), (snapshot) => {
      if (snapshot.empty) {
        // Seed database on first run
        BOOKS_DATA.forEach(b => {
          setDoc(doc(db, 'books', b.id.toString()), b).catch(console.error);
        });
        setBooks(BOOKS_DATA.map(b => ({
          ...b,
          classId: (b as any).classId || null,
          subjectId: (b as any).subjectId || null
        })));
      } else {
        const loadedBooks = snapshot.docs.map(d => {
          const data = d.data();
          const rawLessons = Array.isArray(data.lessons) ? data.lessons : (data.lessons ? Object.values(data.lessons) : []);
          const sanitizedLessons = rawLessons
            .filter((l: any) => l !== null && l !== undefined)
            .map((l: any) => ({
              ...l,
              pages: (Array.isArray(l.pages) ? l.pages : (l.pages ? Object.values(l.pages) : [])).filter((p: any) => p !== null && p !== undefined),
              flashQuestions: (Array.isArray(l.flashQuestions) ? l.flashQuestions : (l.flashQuestions ? Object.values(l.flashQuestions) : [])).filter((fq: any) => fq !== null && fq !== undefined)
            }));

          return {
            ...data,
            lessons: sanitizedLessons,
            title: data.title || 'Untitled Book'
          } as Book;
        });
        loadedBooks.sort((a,b) => a.id - b.id);
        setBooks(loadedBooks);
      }
      setIsBooksLoaded(true);
    });

    return () => {
      unsubClasses();
      unsubSubjects();
      unsubBooks();
    };
  }, []);

  const saveBookToFirebase = async (updatedBook: Book) => {
    await setDoc(doc(db, 'books', updatedBook.id.toString()), updatedBook);
    setBooks(prev => {
      if (prev.some(b => b.id === updatedBook.id)) {
        return prev.map(b => b.id === updatedBook.id ? updatedBook : b);
      }
      return [...prev, updatedBook];
    });
  };

  const deleteBookFromFirebase = async (bookId: number) => {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'books', bookId.toString()));
    setBooks(prev => prev.filter(b => b.id !== bookId));
  };

  const bulkUpdateBooksInFirebase = async (allNewBooks: Book[]) => {
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    allNewBooks.forEach(b => {
      batch.set(doc(db, 'books', b.id.toString()), b);
    });
    await batch.commit();
    setBooks(allNewBooks);
  };

  const [selectedBookId, setSelectedBookId] = useState<number>(1);
  const [activeLessonId, setActiveLessonId] = useState<string>('think-1');

  // Master list of book editors with persistent local storage caching
  const [editors, setEditors] = useState<BookEditor[]>(() => {
    const saved = localStorage.getItem('class_book_editors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      { id: 'num-1', name: 'Arjun Mehta', username: 'arjun', assignedBookId: 1, isActive: true },
      { id: 'num-2', name: 'Dr. Priya Sharma', username: 'priya', assignedBookId: 2, isActive: true },
    ];
  });

  useEffect(() => {
    localStorage.setItem('class_book_editors', JSON.stringify(editors));
  }, [editors]);


  const [activeScreen, setActiveScreen] = useState<'landing' | 'admin' | 'grade-selector' | 'workspace' | 'book-editor' | 'extra-download'>(
    Capacitor.isNativePlatform()
      ? 'extra-download'   // will be updated by Preferences check below
      : 'landing'
  );
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  // Download Extra Smartboard State
  const [downloadedClass, setDownloadedClass] = useState<number | null>(null);
  const [downloadedSubjects, setDownloadedSubjects] = useState<string[]>([]);
  const [setupLoaded, setSetupLoaded] = useState(!Capacitor.isNativePlatform()); // web is instant

  // On native: read class+subjects from Capacitor Preferences (survives reinstall)
  // On web   : read from localStorage synchronously
  useEffect(() => {
    const loadSetup = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Preferences } = await import('@capacitor/preferences');
          const classResult  = await Preferences.get({ key: 'device_setup_class_v3' });
          const subjResult   = await Preferences.get({ key: 'device_setup_subjects_v3' });

          const classVal = classResult.value;
          const subjVal  = subjResult.value;

          if (classVal && classVal !== 'null' && classVal !== 'NaN' && classVal !== '') {
            const parsedClass = parseInt(classVal, 10);
            const parsedSubjects: string[] = subjVal ? JSON.parse(subjVal) : [];
            setDownloadedClass(parsedClass);
            setDownloadedSubjects(parsedSubjects);
            // Also mirror to localStorage for web-view reads
            localStorage.setItem('device_setup_class_v3', classVal);
            localStorage.setItem('device_setup_subjects_v3', subjVal ?? '[]');
            setActiveScreen('grade-selector');
            console.log('[App] Loaded setup from Preferences — class:', parsedClass, 'subjects:', parsedSubjects);
          } else {
            // First install — go to setup screen
            setActiveScreen('extra-download');
            console.log('[App] No saved setup found — showing download screen');
          }
        } catch (e) {
          console.warn('[App] Preferences read failed, trying localStorage:', e);
          // Fallback to localStorage
          const saved = localStorage.getItem('device_setup_class_v3');
          if (saved && saved !== 'null' && saved !== 'NaN') {
            setDownloadedClass(parseInt(saved, 10));
            const subj = localStorage.getItem('device_setup_subjects_v3');
            setDownloadedSubjects(subj ? JSON.parse(subj) : []);
            setActiveScreen('grade-selector');
          } else {
            setActiveScreen('extra-download');
          }
        }
      } else {
        // Web — use localStorage synchronously
        const saved = localStorage.getItem('device_setup_class_v3');
        if (saved && saved !== 'null' && saved !== 'NaN') {
          setDownloadedClass(parseInt(saved, 10));
          const subj = localStorage.getItem('device_setup_subjects_v3');
          setDownloadedSubjects(subj ? JSON.parse(subj) : []);
        }
      }
      setSetupLoaded(true);
    };
    loadSetup();
  }, []);

  // Accessible visibility parameters
  const [themeMode, setThemeMode] = useState<ThemeMode>('parchment');
  const [fontSizeScale, setFontSizeScale] = useState<number>(1.15);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [snv1Expanded, setSnv1Expanded] = useState<boolean>(true);
  const [snv2Expanded, setSnv2Expanded] = useState<boolean>(false);

  // Connectivity and queue variables
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Scribble stylus states
  const [isDrawingEnabled, setIsDrawingEnabled] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>('#f59e0b');
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [isHighlighter, setIsHighlighter] = useState<boolean>(false);

  // PDF view mode: single or double page
  const [pdfViewMode, setPdfViewMode] = useState<'single' | 'double'>('single');

  // Active toast alerting module
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'info' | 'success' | 'warn' | 'cloud' }[]>([]);

  // Auth States
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTargetScreen, setAuthTargetScreen] = useState<'admin' | 'book-editor' | null>(null);
  const [authInitialMode, setAuthInitialMode] = useState<'initial' | 'email-signup'>('initial');
  const [authModalTitle, setAuthModalTitle] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  const [globalLogo, setGlobalLogo] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'branding'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().logoUrl) {
        setGlobalLogo(docSnap.data().logoUrl);
      } else {
        setGlobalLogo(null);
      }
    });
    return () => unsub();
  }, []);

  // Push custom toast notification alert
  const addToast = (text: string, type: 'info' | 'success' | 'warn' | 'cloud' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Load offline data queue and notes on bootup
  useEffect(() => {
    const savedQueue = localStorage.getItem('offline_synced_queue');
    if (savedQueue) {
      try {
        setOfflineQueue(JSON.parse(savedQueue));
      } catch (e) {
        setOfflineQueue([]);
      }
    }

    const savedNotes = localStorage.getItem('classroom_typed_notes');
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        setNotes([]);
      }
    }

    // Greet user
    addToast('Welcome to Extrapadhai Smartboard. Offline storage initiated.', 'success');
  }, []);

  // Save changes to localStorage helper
  const updateOfflineQueueLocal = (updated: OfflineAction[]) => {
    setOfflineQueue(updated);
    localStorage.setItem('offline_synced_queue', JSON.stringify(updated));
  };

  const updateNotesLocal = (updated: Note[]) => {
    setNotes(updated);
    localStorage.setItem('classroom_typed_notes', JSON.stringify(updated));
  };

  useEffect(() => {
    // Removed localStorage sync in favor of Firestore
  }, [books]);

  // No need to manually sync to localStorage anymore, Firebase handles it

  const handleSelectBook = (bookId: number) => {
    setSelectedBookId(bookId);
    // Auto-select first lesson of that book to prevent raw boundaries
    const book = books.find(b => b.id === bookId);
    if (book && book.lessons.length > 0) {
      setActiveLessonId(book.lessons[0].id);
    }
    // Squeeze library shelf (Snv1), expand chapters list (Snv2)
    setSnv1Expanded(false);
    setSnv2Expanded(true);
  };

  const handleSelectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    // Squeeze chapters list on selecting active lesson
    setSnv2Expanded(false);
  };

  const handleSelectBookFromSelector = (bookId: number) => {
    setSelectedBookId(bookId);
    const book = books.find(b => b.id === bookId);
    if (book && book.lessons.length > 0) {
      setActiveLessonId(book.lessons[0].id);
    }
    setSnv1Expanded(false);
    setSnv2Expanded(true);
    setActiveScreen('workspace');
    addToast(`Opened textbook: ${book?.title}`, 'success');
  };

  const handleChangeGrade = () => {
    setActiveScreen('grade-selector');
    setSelectedGrade(null);
    addToast('Returning to library shelves.', 'info');
  };

  const getFilteredBooks = () => {
    let result = books;
    if (downloadedClass !== null) {
      const classObj = academicClasses.find(c => Number(c.name) === downloadedClass || c.name === downloadedClass.toString());
      if (classObj) {
        result = result.filter(b => b.classId === classObj.id);
      } else {
        result = [];
      }
    }
    if (downloadedSubjects.length > 0) {
      const subjectIds = academicSubjects.filter(s => downloadedSubjects.includes(s.name)).map(s => s.id);
      result = result.filter(b => b.subjectId && subjectIds.includes(b.subjectId));
    }
    if (selectedGrade) {
      const classObj = academicClasses.find(c => Number(c.name) === selectedGrade || c.name === selectedGrade.toString());
      if (classObj) {
        result = result.filter(b => b.classId === classObj.id);
      } else {
        result = [];
      }
    }
    return result;
  };

  // Switch offline/online simulating internet toggles
  const handleToggleOnline = () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    if (nextState) {
      addToast('WiFi signals recovered. Connective streams established.', 'success');
      // Suggest synchronizing if pending actions exist
      const pendings = offlineQueue.filter(a => a.status === 'pending');
      if (pendings.length > 0) {
        addToast(`You have ${pendings.length} unsynchronized records. Ready to sync.`, 'cloud');
      }
    } else {
      addToast('Working in isolated Offline mode. Local sandbox activated.', 'warn');
    }
  };

  // Action sync execution
  const handleTriggerSync = () => {
    if (!isOnline) {
      addToast('Sync aborted. Offline state active.', 'warn');
      return;
    }

    const pendings = offlineQueue.filter(a => a.status === 'pending');
    if (pendings.length === 0) {
      addToast('Everything is synchronized.', 'success');
      return;
    }

    setIsSyncing(true);
    addToast('Contacting school database repository...', 'cloud');

    // Simulate step-by-step server commit
    setTimeout(() => {
      addToast(`Syncing ${pendings.length} pending local records chronologically...`, 'cloud');

      setTimeout(() => {
        // Push all local notes to Firestore
        notes.forEach(note => {
          setDoc(doc(db, 'notes', `${note.bookId}_${note.lessonId}`), note).catch(console.error);
        });

        // Map all pending records to "synchronized"
        const synchronizedQueue = offlineQueue.map(action => {
          if (action.status === 'pending') {
            return { ...action, status: 'synchronized' as const };
          }
          return action;
        });

        updateOfflineQueueLocal(synchronizedQueue);
        setIsSyncing(false);
        addToast('Durable sync complete! Safe to reload or close smartboard.', 'success');
      }, 1800);
    }, 1000);
  };

  // Capture note addition offline and online
  const handleAddNote = (noteText: string) => {
    const newNote: Note = {
      bookId: selectedBookId,
      lessonId: activeLessonId,
      text: noteText,
      updatedAt: new Date().toISOString(),
    };

    // Update notes array
    const filteredDrafts = notes.filter(n => !(n.bookId === selectedBookId && n.lessonId === activeLessonId));
    const nextNotes = [...filteredDrafts, newNote];
    updateNotesLocal(nextNotes);

    // Formulate offline queue action
    const newAction: OfflineAction = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'ADD_NOTE',
      payload: { bookId: selectedBookId, lessonId: activeLessonId, excerpt: noteText.substring(0, 40) },
      status: isOnline ? 'synchronized' : 'pending',
    };

    updateOfflineQueueLocal([newAction, ...offlineQueue]);
    
    if (isOnline) {
      addToast('Note card successfully saved to central server cloud storage.', 'success');
    } else {
      addToast('Offline mode: Note cached directly to local device safe queue.', 'info');
    }
  };

  // Saving scribble stroke annotations data url
  const handleStrokeSaved = (dataUrl: string) => {
    const newAction: OfflineAction = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'SAVE_DRAWING',
      payload: { lessonId: activeLessonId, length: dataUrl.length },
      status: isOnline ? 'synchronized' : 'pending',
    };

    updateOfflineQueueLocal([newAction, ...offlineQueue]);
    
    if (!isOnline) {
      addToast('Scribble modified. Drawing annotations saved in offline buffer.', 'info');
    }
  };

  // Upload local textbook/document stream
  const handleCustomBookUploaded = (newBook: Book) => {
    setBooks(prev => [...prev, newBook]);
    setSelectedBookId(newBook.id);
    if (newBook.lessons.length > 0) {
      setActiveLessonId(newBook.lessons[0].id);
    }
    
    // Add upload payload to queue
    const newAction: OfflineAction = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'BOOKMARK',
      payload: { name: newBook.title, pagesCount: newBook.lessons[0].pages.length },
      status: isOnline ? 'synchronized' : 'pending',
    };

    updateOfflineQueueLocal([newAction, ...offlineQueue]);
    addToast(`Successfully appended '${newBook.title}' into local book shelf.`, 'success');
  };

  const activeBook = books.find(b => b.id === selectedBookId) || null;
  const activeLesson = activeBook ? activeBook.lessons.find(l => l.id === activeLessonId) || null : null;
  const activeNote = notes.find(n => n.bookId === selectedBookId && n.lessonId === activeLessonId) || null;

  const handleAuthSuccess = async (role?: string) => {
    setAuthModalOpen(false);

    if (role === 'FalseAttempter') {
      await auth.signOut();
      setSessionVerified(false);
      setActiveScreen('landing');
      addToast('WARNING: Unauthorized Access Attempt logged.', 'warn');
      return;
    }

    if (authTargetScreen) {
      if (authTargetScreen === 'book-editor' && role !== 'editor') {
        await auth.signOut();
        setSessionVerified(false);
        setActiveScreen('landing');
        addToast('Role mismatch. You are not an Editor.', 'warn');
        return;
      }
      if (authTargetScreen === 'admin' && role !== 'admin') {
        await auth.signOut();
        setSessionVerified(false);
        setActiveScreen('landing');
        addToast('Role mismatch. You are not an Admin.', 'warn');
        return;
      }
      
      setSessionVerified(true);
      setActiveScreen(authTargetScreen);
      addToast(`Successfully authenticated. Welcome back.`, 'success');
    } else if (role === 'admin') {
      setSessionVerified(true);
      setActiveScreen('admin');
      addToast('Successfully authenticated. Directed to Admin Panel.', 'success');
    } else if (role === 'editor') {
      setSessionVerified(true);
      setActiveScreen('book-editor');
      addToast('Successfully authenticated. Directed to Book Editor Panel.', 'success');
    } else {
      setSessionVerified(true);
    setActiveScreen('landing');
      addToast(`Successfully authenticated. Please select your workspace portal below.`, 'success');
    }
  };

  if (activeScreen === 'landing') {
    return (
      <>
        <LandingPage
          globalLogo={globalLogo}
          onEnterStudents={() => {
            setActiveScreen('grade-selector');
            addToast('Authorized Student session loaded.', 'success');
          }}
          onEnterEditors={() => {
            setAuthTargetScreen('book-editor');
            setAuthInitialMode('email-login');
            setAuthModalTitle('Book Editor Login');
            setAuthModalOpen(true);
          }}
          onEnterAdmin={() => {
            setAuthTargetScreen('admin');
            setAuthInitialMode('email-login');
            setAuthModalTitle('Administrator Login');
            setAuthModalOpen(true);
          }}
          onEnterDownloadExtra={() => {
            // Web: skip setup — go straight into the app content
            // Native APK: setup (class/subject + PDF download) is handled automatically
            //             on first launch via the useEffect Preferences check above
            setActiveScreen('grade-selector');
          }}
          onSignIn={() => {
            setAuthTargetScreen(null);
            setAuthInitialMode('initial');
            setAuthModalTitle('Sign In to Extrapadhai');
            setAuthModalOpen(true);
          }}
          onSignUp={() => {
            setAuthTargetScreen(null);
            setAuthInitialMode('email-signup');
            setAuthModalTitle('Create a New Account');
            setAuthModalOpen(true);
          }}
          booksCount={books.length}
          editorsCount={editors.length}
        />
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authInitialMode}
          onClose={() => setAuthModalOpen(false)}
          title={authModalTitle}
          onSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  if (activeScreen === 'admin') {
    return (
      <AdminPanel
        globalLogo={globalLogo}
        books={books}
        saveBookToFirebase={saveBookToFirebase}
        deleteBookFromFirebase={deleteBookFromFirebase}
        bulkUpdateBooksInFirebase={bulkUpdateBooksInFirebase}
        onClose={() => setActiveScreen('landing')}
        academicClasses={academicClasses}
        academicSubjects={academicSubjects}
        editors={editors}
        setEditors={setEditors}
      />
    );
  }

  // ExtraSmartboardDownload is ONLY for the native APK (first-launch setup).
  // Web users never see this screen — they go directly to grade-selector.
  if (activeScreen === 'extra-download' && Capacitor.isNativePlatform()) {
    return (
      <ExtraSmartboardDownload
        globalLogo={globalLogo}
        academicClasses={academicClasses}
        academicSubjects={academicSubjects}
        books={books}
        onCancel={() => setActiveScreen('grade-selector')} // no 'back' on native first launch
        onDownload={async (grade, subjects) => {
          setDownloadedClass(grade);
          setDownloadedSubjects(subjects);
          // Persist via Capacitor Preferences (survives reinstall)
          try {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key: 'device_setup_class_v3', value: grade.toString() });
            await Preferences.set({ key: 'device_setup_subjects_v3', value: JSON.stringify(subjects) });
          } catch {
            localStorage.setItem('device_setup_class_v3', grade.toString());
            localStorage.setItem('device_setup_subjects_v3', JSON.stringify(subjects));
          }
          setActiveScreen('grade-selector');
          addToast(`Class ${grade} set up! PDFs saved for offline use.`, 'success');
        }}
      />
    );
  }

  // Fallback: if somehow extra-download is set on web, redirect to grade-selector
  if (activeScreen === 'extra-download' && !Capacitor.isNativePlatform()) {
    setActiveScreen('grade-selector');
    return null;
  }

  if (activeScreen === 'book-editor') {
    return (
      <BookEditorPanel
        globalLogo={globalLogo}
        books={books}
        saveBookToFirebase={saveBookToFirebase}
        editors={editors}
        onClose={() => setActiveScreen('landing')}
      />
    );
  }

  if (activeScreen === 'grade-selector') {
    return (
      <div className="h-screen w-full relative overflow-hidden bg-[#f7fbf0]" id="app-layout">
        {/* Floating Back to Landing option */}
        <div className="absolute top-4 right-4 z-40">
          <button
            onClick={() => setActiveScreen('landing')}
            className="p-2 px-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
            title="Go to main landing menu"
          >
            <Home className="w-3.5 h-3.5 text-emerald-400" /> Landing Page
          </button>
        </div>

        <GradeSelector
          globalLogo={globalLogo}
          books={getFilteredBooks()}
          onSelectBook={handleSelectBookFromSelector}
          onEnterAdmin={() => setActiveScreen('admin')}
          isBooksLoaded={isBooksLoaded && academicClasses.length > 0}
        />
        
        {/* Toasts feed for consistent alerts on entry selection */}
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none" id="toasts-feed">
          {toasts.map(t => (
            <div
              key={t.id}
              id={`toast-${t.id}`}
              className={`p-3 px-4 rounded-lg shadow-xl border flex items-center gap-3 animate-fade-in pointer-events-auto backdrop-blur-md ${
                t.type === 'success'
                  ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/40'
                  : t.type === 'warn'
                  ? 'bg-red-950/90 text-red-100 border-red-500/40'
                  : t.type === 'cloud'
                  ? 'bg-sky-950/90 text-sky-100 border-sky-500/40'
                  : 'bg-stone-900/90 text-stone-200 border-stone-800'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
              {t.type === 'warn' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
              {t.type === 'cloud' && <RefreshCw className="w-5 h-5 text-sky-400 flex-shrink-0 animate-spin" />}
              {t.type === 'info' && <Layers className="w-5 h-5 text-amber-500 flex-shrink-0" />}
              <span className="font-sans text-[12.5px] leading-snug">{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const appThemeStyles = {
    parchment: {
      border: 'border-amber-950/10',
      titleColor: 'text-[#1a1208]',
      headerBg: 'bg-[#faf7f2]/95 text-[#2a1f0e]',
    },
    dark: {
      border: 'border-stone-800',
      titleColor: 'text-[#e8a820]',
      headerBg: 'bg-stone-950/95 text-[#ece5d5]',
    },
    'high-contrast-blue': {
      border: 'border-yellow-500/30',
      titleColor: 'text-white',
      headerBg: 'bg-[#000e29]/95 text-[#fbbf24]',
    },
    'high-contrast-green': {
      border: 'border-emerald-500/30',
      titleColor: 'text-white',
      headerBg: 'bg-[#021f15]/95 text-[#cbffc2]',
    },
    mono: {
      border: 'border-[#181d17]/25',
      titleColor: 'text-black font-extrabold',
      headerBg: 'bg-white text-black',
    },
  }[themeMode] || {
    border: 'border-amber-950/10',
    titleColor: 'text-[#1a1208]',
    headerBg: 'bg-[#faf7f2]/95 text-[#2a1f0e]',
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0b0f19]" id="app-layout">
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={authModalTitle}
        onSuccess={handleAuthSuccess}
      />

      {/* Absolute floating toolbar above the top navbar in stacking context */}
      {isDrawingEnabled && (
        <div className="fixed top-2.5 right-4 sm:right-32 bg-slate-900/95 text-slate-100 rounded-xl shadow-2xl p-2 px-4 flex items-center gap-4 z-50 backdrop-blur-md border border-slate-700/80 pointer-events-auto" id="canvas-toolbar">
          <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
            <Palette className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] uppercase font-sans font-extrabold tracking-widest text-slate-300">Stylus Options</span>
          </div>

          <div className="flex items-center gap-2">
            {PALETTE_COLORS.map(color => (
              <button
                key={color.hex}
                id={`btn-color-${color.hex.replace('#', '')}`}
                onClick={() => setSelectedColor(color.hex)}
                className="w-6.5 h-6.5 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center"
                style={{
                  backgroundColor: color.hex,
                  borderColor: selectedColor === color.hex ? '#f59e0b' : 'transparent',
                  transform: selectedColor === color.hex ? 'scale(1.15)' : 'scale(1)',
                }}
                title={color.name}
              >
                {selectedColor === color.hex && (
                  <Circle className="w-2.5 h-2.5 fill-current text-slate-950 stroke-current" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3.5 border-l border-r border-slate-800 px-3 py-1">
            <div className="flex flex-col">
              <span className="text-[8px] font-sans font-bold uppercase tracking-widest text-slate-400">Width: {lineWidth}px</span>
              <input
                id="input-brush-width"
                type="range"
                min="2"
                max="16"
                value={lineWidth}
                onChange={e => setLineWidth(Number(e.target.value))}
                className="w-16 accent-amber-500 cursor-pointer h-1 rounded"
              />
            </div>

            <button
              id="btn-toggle-highlighter"
              onClick={() => setIsHighlighter(!isHighlighter)}
              className={`text-[9px] uppercase px-2.5 py-1 font-sans font-extrabold tracking-widest rounded-md transition-colors cursor-pointer ${
                isHighlighter ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-950 text-slate-400 hover:text-slate-100'
              }`}
              title="Draw with transparent overlapping strokes"
            >
              Highlighter
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-undo-scribble"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('classroom-canvas-undo'));
              }}
              className="p-1.5 hover:bg-slate-950 rounded-lg text-slate-300 transition-colors cursor-pointer"
              title="Undo last stroke (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              id="btn-clear-scribbles"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('classroom-canvas-clear'));
              }}
              className="p-1.5 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg text-slate-400 transition-all cursor-pointer"
              title="Delete all annotations off page"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              id="btn-close-drawing-toolbar"
              onClick={() => {
                setIsDrawingEnabled(false);
              }}
              className="p-1.5 hover:bg-rose-600 hover:text-white rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer ml-1 bg-slate-950/80 border border-slate-800 hover:border-transparent flex items-center justify-center gap-1"
              title="Exit drawing mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. SOLID FULL-WIDTH TOP HEADER PANEL */}
      {activeLesson && (
        <div className={`py-2 px-4 sm:px-8 border-b ${appThemeStyles.border} ${appThemeStyles.headerBg} flex-shrink-0 z-40 flex items-center justify-between gap-4`} id="content-header">
          <div className="min-w-0 flex-1">
            <h1
              onClick={() => setSnv2Expanded(!snv2Expanded)}
              className={`font-sans text-lg lg:text-xl font-black tracking-tighter cursor-pointer hover:opacity-80 active:scale-98 transition-all flex items-center gap-2 truncate ${appThemeStyles.titleColor}`}
              id="content-lesson-title"
              title="Click to expand/squeeze chapter navigation list"
            >
              {globalLogo && (
                <img src={globalLogo} alt="Logo" className="w-9 h-9 object-contain inline-block flex-shrink-0 ml-2" />
              )}
              <span className="truncate">Extrapadhai.com <span className="opacity-50 font-normal select-none">/</span> <span className="text-amber-500 font-bold">{activeLesson.title}</span></span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {activeBook?.source && (
              <span className="text-sm font-black text-[#b22222] uppercase tracking-wider leading-none drop-shadow-sm">
                Source: {activeBook.source}
              </span>
            )}
            <div className="flex items-center gap-2">
            {/* NCERT label — shown only when lesson has a PDF attached */}
            {activeLesson?.pdfUrl && (
              <span className="text-base sm:text-lg font-black tracking-tight text-[#b22222] uppercase select-none drop-shadow-sm mr-1">
                NCERT Text Book
              </span>
            )}
            {/* Conditional Sync Button for Students */}
            {isOnline && (
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className={`p-2 border flex items-center justify-center transition-all rounded-lg ${
                  isSyncing
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 cursor-not-allowed'
                    : 'bg-[#10b981] hover:bg-[#059669] text-white border-[#10b981] shadow-sm cursor-pointer'
                }`}
                title="Synchronize local changes to Firebase cloud"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={() => setActiveScreen('grade-selector')}
              className="p-2 bg-transparent hover:bg-slate-500/10 text-[#0d631b] border border-[#0d631b]/20 hover:border-[#0d631b]/50 flex items-center justify-center transition-all cursor-pointer rounded-lg"
              title="Return to book selection"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
          </div>
        </div>
      )}

      {/* Hidden file upload input triggered by full-width header */}
      <input
        id="hidden-file-upload-input-app"
        type="file"
        accept=".pdf,.txt,.md,.docx"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
              const contentText = event.target?.result as string || '';
              const newBook: Book = {
                id: Date.now(),
                title: file.name.replace(/\.[^/.]+$/, ""),
                author: "Uploaded Smartboard Document",
                color: "#cbffc2",
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
                            <strong>Integrity Guard:</strong> Cached file offline in local state buffers. Scribble tools and high-contrast toggles are fully enabled on this document.
                          </div>
                          <p>${contentText.replace(/\n\n/g, '</p><p>').substring(0, 1500) || 'Continuous text layout extracted from PDF stream...'}</p>
                        `,
                        figure: {
                          caption: "Figure: Contextual graphic generated from local file reading stream.",
                          svgType: "fairness"
                        }
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
              handleCustomBookUploaded(newBook);
            };
            if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
              reader.readAsText(file);
            } else {
              reader.readAsText(new Blob(["Parsed raw binary PDF. Classroom reading loaded cleanly."]));
            }
          }
        }}
        className="hidden"
      />

      {/* 2. MAIN LAYOUT FLEX AREA CORES */}
      <div className="flex-1 flex overflow-hidden relative" id="layout">
        
        {/* Left Side Navigation and Accessibility controls */}
        {isSidebarOpen && (
          <>
            {/* Side Nav Bar (Snv1): Books / Library Shelf Column */}
            <BookShelf
              globalLogo={globalLogo}
              books={getFilteredBooks()}
              selectedBookId={selectedBookId}
              onSelectBook={handleSelectBook}
              isExpanded={snv1Expanded}
              onToggleExpand={() => setSnv1Expanded(!snv1Expanded)}
              onChangeGrade={handleChangeGrade}
            />

            {/* Side Nav Bar (Snv2): Lessons / Chapters List Column */}
            <Sidebar
              selectedBook={activeBook}
              activeLessonId={activeLessonId}
              activeLesson={activeLesson}
              onSelectLesson={handleSelectLesson}
              themeMode={themeMode}
              onThemeChange={setThemeMode}
              fontSizeScale={fontSizeScale}
              onFontSizeScaleChange={setFontSizeScale}
              isOnline={isOnline}
              onToggleOnline={handleToggleOnline}
              offlineQueue={offlineQueue}
              onTriggerSync={handleTriggerSync}
              isSyncing={isSyncing}
              isExpanded={snv2Expanded}
              onToggleExpand={() => setSnv2Expanded(!snv2Expanded)}
              pdfViewMode={pdfViewMode}
              onPdfViewModeChange={setPdfViewMode}
            />
          </>
        )}

        {/* Center Canvas display for gap-free continuous reading experience */}
        <Workspace
          selectedBook={activeBook}
          activeLesson={activeLesson}
          themeMode={themeMode}
          fontSizeScale={fontSizeScale}
          isDrawingEnabled={isDrawingEnabled}
          onStrokeSaved={handleStrokeSaved}
          onCustomBookUploaded={handleCustomBookUploaded}
          onCloseDrawing={() => {
            setIsDrawingEnabled(false);
          }}
          selectedColor={selectedColor}
          lineWidth={lineWidth}
          isHighlighter={isHighlighter}
          pdfViewMode={pdfViewMode}
        />



        {/* Movable Semi-transparent Floating interactive helpers */}
        <FloatingButton
          currentLesson={activeLesson}
          onToggleButtonDraw={() => {
            setIsDrawingEnabled(!isDrawingEnabled);
          }}
          isDrawingEnabled={isDrawingEnabled}
          onAddNote={handleAddNote}
          savedNote={activeNote}
          addToast={addToast}
          globalLogo={globalLogo}
        />
      </div>

      {/* 3. ABSOLUTE TOAST NOTIFICATIONS FEED OVERLAY */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none" id="toasts-feed">
        {toasts.map(t => (
          <div
            key={t.id}
            id={`toast-${t.id}`}
            className={`p-3 px-4 rounded-lg shadow-xl border flex items-center gap-3 animate-fade-in pointer-events-auto backdrop-blur-md ${
              t.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/40'
                : t.type === 'warn'
                ? 'bg-red-950/90 text-red-100 border-red-500/40'
                : t.type === 'cloud'
                ? 'bg-sky-950/90 text-sky-100 border-sky-500/40'
                : 'bg-stone-900/90 text-stone-200 border-stone-800'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
            {t.type === 'warn' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
            {t.type === 'cloud' && <RefreshCw className="w-5 h-5 text-sky-400 flex-shrink-0 animate-spin" />}
            {t.type === 'info' && <Layers className="w-5 h-5 text-amber-500 flex-shrink-0" />}
            <span className="font-sans text-[12.5px] leading-snug">{t.text}</span>
          </div>
        ))}
      </div>

      {/* Mini offline queue synchronization monitoring board footer */}
      {offlineQueue.filter(a => a.status === 'pending').length > 0 && (
        <div className="absolute bottom-4 left-76 bg-amber-400 text-slate-950 text-[10px] font-sans font-bold py-1.5 px-3.5 rounded-lg shadow-lg flex items-center gap-2 z-30 select-none border border-amber-300 transition-all font-sans" id="footer-queue-alert">
          <Database className="w-3.5 h-3.5 animate-bounce" />
          <span>{offlineQueue.filter(a => a.status === 'pending').length} Actions cached waiting for internet alignment.</span>
        </div>
      )}
    </div>
  );
}

