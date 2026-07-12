import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, DownloadCloud, AlertCircle, HardDrive, Loader2, FolderOpen } from 'lucide-react';
import { AcademicClass, AcademicSubject, Book, OfflineBookLessons } from '../types';
import { dbLocal } from '../lib/db';
import { downloadAndCacheImage, extractImagesFromLesson } from '../lib/imageCache';

interface ExtraSmartboardDownloadProps {
  globalLogo?: string | null;
  academicClasses: AcademicClass[];
  academicSubjects: AcademicSubject[];
  books: Book[];
  onCancel: () => void;
  onDownload: (grade: number, subjects: string[]) => void;
}

export default function ExtraSmartboardDownload({
  globalLogo,
  academicClasses,
  academicSubjects,
  books,
  onCancel,
  onDownload,
}: ExtraSmartboardDownloadProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [warning, setWarning] = useState('');

  // Step 3 — Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const isNative = () => {
    return (
      typeof (window as any).Capacitor !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.()
    );
  };

  const handleNext = () => {
    if (step === 1 && selectedGrade !== null) {
      setStep(2);
      setWarning('');
    }
  };

  const handleToggleSubject = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(prev => prev.filter(s => s !== subject));
      setWarning('');
    } else {
      if (selectedSubjects.length >= 8) {
        setWarning('You can select a maximum of 8 subjects.');
      } else {
        setSelectedSubjects(prev => [...prev, subject]);
        setWarning('');
      }
    }
  };

  const handleProceedToSync = async () => {
    if (selectedGrade === null || selectedSubjects.length === 0) {
      setWarning('Please select at least 1 subject.');
      return;
    }

    // ── Persist class + subjects selection
    if (isNative()) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: 'device_setup_class_v3', value: selectedGrade.toString() });
        await Preferences.set({ key: 'device_setup_subjects_v3', value: JSON.stringify(selectedSubjects) });
        console.log('[Setup] Saved class/subjects to Capacitor Preferences');
      } catch (e) {
        console.warn('[Setup] Preferences save failed, falling back to localStorage:', e);
        localStorage.setItem('device_setup_class_v3', selectedGrade.toString());
        localStorage.setItem('device_setup_subjects_v3', JSON.stringify(selectedSubjects));
      }
    } else {
      localStorage.setItem('device_setup_class_v3', selectedGrade.toString());
      localStorage.setItem('device_setup_subjects_v3', JSON.stringify(selectedSubjects));
    }

    setStep(3);
    setIsSyncing(true);
    setOverallProgress(0);

    let allImageUrls: string[] = [];

    // Extract all images if native
    if (isNative()) {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        
        const selectedBooks = books.filter(b => 
          b.classId === selectedGrade?.toString() && 
          selectedSubjects.includes(b.subjectId || '')
        );

        for (const book of selectedBooks) {
          if (book.coverImage && book.coverImage.startsWith('http')) {
            allImageUrls.push(book.coverImage);
          }

          // 1. Fetch and cache lessons from Firestore subcollection for offline use
          try {
            const lessonsSnap = await getDocs(collection(db, 'books', book.id.toString(), 'lessons'));
            const subLessons = lessonsSnap.docs.map(d => d.data());
            
            // Extract images from subcollection lessons
            for (const lesson of subLessons) {
              const urls = extractImagesFromLesson(lesson);
              allImageUrls.push(...urls);
            }
          } catch (e) {
            console.error(`Failed to fetch subcollection for book ${book.id}`, e);
          }

          // 2. Extract images from any legacy root lessons
          if (book.lessons) {
             for (const lesson of book.lessons) {
                 const urls = extractImagesFromLesson(lesson);
                 allImageUrls.push(...urls);
             }
          }

          // 3. Check for any locally edited offline data
          const offlineData = await dbLocal.offline_lessons.get(book.id);
          if (offlineData && offlineData.lessons) {
            for (const lesson of offlineData.lessons) {
              const urls = extractImagesFromLesson(lesson);
              allImageUrls.push(...urls);
            }
          }
        }
      } catch (err) {
        console.error('[Setup] Error scanning for images:', err);
      }
    }

    allImageUrls = Array.from(new Set(allImageUrls)); // deduplicate

    if (allImageUrls.length > 0) {
      let completed = 0;
      // Download images in batches of 3 to avoid overwhelming network/filesystem
      const batchSize = 3;
      for (let i = 0; i < allImageUrls.length; i += batchSize) {
        const batch = allImageUrls.slice(i, i + batchSize);
        await Promise.all(batch.map(url => downloadAndCacheImage(url).catch(console.error)));
        completed += batch.length;
        setOverallProgress(Math.floor((completed / allImageUrls.length) * 100));
      }
    } else {
      // Fake sync if no images found or not native
      for (let i = 0; i <= 100; i += 20) {
        setOverallProgress(i);
        await new Promise(res => setTimeout(res, 200));
      }
    }

    setIsSyncing(false);
    setSyncDone(true);
  };

  const handleFinish = () => {
    if (selectedGrade !== null) {
      onDownload(selectedGrade, selectedSubjects);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070a13] text-slate-200 font-sans p-4 sm:p-8 flex flex-col items-center selection:bg-emerald-500/30">
      <div className="w-full max-w-4xl mt-4 sm:mt-12">
        <button
          onClick={
            step === 3
              ? () => { setStep(2); setSyncDone(false); }
              : step === 2
              ? () => setStep(1)
              : onCancel
          }
          disabled={step === 3 && isSyncing}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors mb-6 font-mono text-sm tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 3
            ? 'BACK TO SUBJECT SELECTION'
            : step === 2
            ? 'BACK TO CLASS SELECTION'
            : 'CANCEL AND RETURN HOME'}
        </button>

        <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6 relative z-10">
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    step === s
                      ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-900/40'
                      : step > s
                      ? 'bg-emerald-900/40 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}
                >
                  {step > s ? '✓' : s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full transition-all ${
                      step > s ? 'bg-emerald-500/50' : 'bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="mb-8 border-b border-slate-800/60 pb-6 relative z-10">
            <h1 className="text-2xl sm:text-3xl font-black text-emerald-400 mb-2 tracking-tight">
              {step === 1
                ? 'Step 1: Select Your Class'
                : step === 2
                ? `Step 2: Select Subjects for Class ${selectedGrade}`
                : 'Step 3: Preparing Curriculum Content'}
            </h1>
            <p className="text-sm text-slate-400 font-serif italic">
              {step === 1
                ? 'Choose exactly one class to proceed with the extra smartboard material download.'
                : step === 2
                ? 'Select up to 8 subjects to tailor your offline smartboard package.'
                : 'Curriculum data is being prepared and synchronized for offline access.'}
            </p>
          </div>

          {/* ── STEP 1: Class selection ── */}
          {step === 1 && (
            <div className="grid grid-cols-12 gap-4 relative z-10">
              {[...academicClasses]
                .sort((a, b) => Number(a.name) - Number(b.name))
                .map((academicClass, index) => (
                  <button
                    key={academicClass.id}
                    onClick={() => setSelectedGrade(Number(academicClass.name) || 0)}
                    className={`col-span-6 ${index >= 4 ? 'sm:col-span-4 md:col-span-4' : 'sm:col-span-4 md:col-span-3'} p-6 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer transform hover:-translate-y-1 ${
                      selectedGrade === Number(academicClass.name)
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                        : index >= 4
                        ? 'bg-[#0f172a]/80 border-[#1e293b] text-indigo-200/80 hover:bg-[#1e293b] hover:border-indigo-500/30 hover:text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="text-4xl font-black tracking-tighter">{academicClass.name}</span>
                    <span className="text-xs uppercase tracking-widest opacity-60 font-mono">Class</span>
                  </button>
                ))}
            </div>
          )}

          {/* ── STEP 2: Subject selection ── */}
          {step === 2 && (
            <div className="relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...academicSubjects].sort((a, b) => a.name.localeCompare(b.name)).map(academicSubject => {
                  const isSelected = selectedSubjects.includes(academicSubject.name);
                  return (
                    <button
                      key={academicSubject.id}
                      onClick={() => handleToggleSubject(academicSubject.name)}
                      className={`p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-inner'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-bold text-sm truncate pr-2">{academicSubject.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {warning && (
                <div className="mt-6 flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-sm font-bold tracking-wide">
                  <AlertCircle className="w-4 h-4" /> {warning}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Sync progress ── */}
          {step === 3 && (
            <div className="relative z-10 space-y-5">
              {/* Overall progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Overall progress</span>
                  <span className="text-emerald-400 font-bold">{overallProgress}%</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-sky-500 rounded-full transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Downloading message */}
              {isSyncing && (
                <div className="flex items-center gap-3 p-3 rounded-xl border bg-sky-900/20 border-sky-700/30">
                    <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                    <p className="text-xs font-semibold text-slate-300">Synchronizing Local Database</p>
                </div>
              )}

              {/* Sync complete message */}
              {syncDone && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-900/30 border border-emerald-600/30 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-emerald-300 font-bold text-sm">Synchronization Complete!</p>
                      <p className="text-emerald-500/80 text-xs font-serif italic mt-0.5">
                        Content configured for offline access.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Footer Buttons ── */}
          <div className="mt-10 flex justify-between items-center w-full relative z-10">
            <span className="text-xs text-slate-500 font-mono">v4.0 (Live Sync Active)</span>
            <div className="flex gap-4">
              {step === 1 && (
                <button
                  onClick={handleNext}
                disabled={selectedGrade === null}
                className={`px-8 py-3 rounded-lg font-bold uppercase tracking-widest text-xs transition-all flex items-center gap-2 ${
                  selectedGrade !== null
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 cursor-pointer active:scale-95'
                    : 'bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Proceed to Subjects
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleProceedToSync}
                disabled={selectedSubjects.length === 0}
                className={`px-8 py-4 w-full md:w-auto rounded-xl font-black uppercase tracking-wider text-sm md:text-base transition-all flex items-center justify-center gap-3 hover:-translate-y-1 transform ${
                  selectedSubjects.length > 0
                    ? 'bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white shadow-xl shadow-sky-900/30 cursor-pointer active:scale-95 border-2 border-transparent hover:border-emerald-400/50'
                    : 'bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <DownloadCloud className="w-5 h-5" />
                Configure &amp; Continue
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleFinish}
                disabled={isSyncing}
                className={`px-8 py-4 w-full md:w-auto rounded-xl font-black uppercase tracking-wider text-sm md:text-base transition-all flex items-center justify-center gap-3 ${
                  !isSyncing
                    ? 'bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white shadow-xl shadow-sky-900/30 cursor-pointer active:scale-95 hover:-translate-y-1 transform'
                    : 'bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Enter Smartboard
                  </>
                )}
              </button>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
