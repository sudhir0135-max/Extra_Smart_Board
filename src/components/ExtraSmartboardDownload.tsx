import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, DownloadCloud, AlertCircle, HardDrive, Wifi, Loader2 } from 'lucide-react';
import { AcademicClass, AcademicSubject, Book } from '../types';
import { downloadAndCachePdf, isPdfCached } from '../lib/pdfCache';

interface ExtraSmartboardDownloadProps {
  globalLogo?: string | null;
  academicClasses: AcademicClass[];
  academicSubjects: AcademicSubject[];
  books: Book[];
  onCancel: () => void;
  onDownload: (grade: number, subjects: string[]) => void;
}

interface PdfDownloadItem {
  url: string;
  label: string;    // "Book Title — Lesson Title"
  status: 'pending' | 'cached' | 'downloading' | 'done' | 'error';
  progress: number; // 0–100
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

  // Step 3 — PDF download state
  const [pdfItems, setPdfItems] = useState<PdfDownloadItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

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

  /** Collect all PDF URLs from books that match selected class + subjects */
  const collectPdfItems = (): PdfDownloadItem[] => {
    if (selectedGrade === null) return [];

    const classObj = academicClasses.find(
      c => Number(c.name) === selectedGrade || c.name === selectedGrade.toString()
    );
    const subjectIds = academicSubjects
      .filter(s => selectedSubjects.includes(s.name))
      .map(s => s.id);

    const filteredBooks = books.filter(b => {
      const matchClass = classObj ? b.classId === classObj.id : true;
      const matchSubject = subjectIds.length > 0
        ? (b.subjectId && subjectIds.includes(b.subjectId))
        : true;
      return matchClass && matchSubject;
    });

    const items: PdfDownloadItem[] = [];
    for (const book of filteredBooks) {
      for (const lesson of book.lessons) {
        if (lesson.pdfUrl) {
          items.push({
            url: lesson.pdfUrl,
            label: `${book.title} — ${lesson.title}`,
            status: 'pending',
            progress: 0,
          });
        }
      }
    }
    return items;
  };

  const handleProceedToDownload = async () => {
    if (selectedGrade === null || selectedSubjects.length === 0) {
      setWarning('Please select at least 1 subject.');
      return;
    }

    const items = collectPdfItems();

    // Check which are already cached
    const itemsWithCacheStatus: PdfDownloadItem[] = await Promise.all(
      items.map(async item => {
        const cached = await isPdfCached(item.url);
        return { ...item, status: cached ? 'cached' : 'pending' } as PdfDownloadItem;
      })
    );

    setPdfItems(itemsWithCacheStatus);
    setStep(3);

    // Start downloading
    if (itemsWithCacheStatus.length === 0) {
      // No PDFs to download — proceed immediately
      setDownloadDone(true);
      setOverallProgress(100);
      return;
    }

    setIsDownloading(true);
    let completed = itemsWithCacheStatus.filter(i => i.status === 'cached').length;
    const total = itemsWithCacheStatus.length;

    setOverallProgress(Math.round((completed / total) * 100));

    for (let idx = 0; idx < itemsWithCacheStatus.length; idx++) {
      const item = itemsWithCacheStatus[idx];
      if (item.status === 'cached') {
        // Already cached — skip
        continue;
      }

      // Mark as downloading
      setPdfItems(prev =>
        prev.map((p, i) => (i === idx ? { ...p, status: 'downloading', progress: 0 } : p))
      );

      const blob = await downloadAndCachePdf(
        item.url,
        (loaded, total_) => {
          const pct = Math.round((loaded / total_) * 100);
          setPdfItems(prev =>
            prev.map((p, i) => (i === idx ? { ...p, progress: pct } : p))
          );
        }
      );

      completed += 1;
      setPdfItems(prev =>
        prev.map((p, i) =>
          i === idx
            ? { ...p, status: blob ? 'done' : 'error', progress: 100 }
            : p
        )
      );
      setOverallProgress(Math.round((completed / total) * 100));
    }

    setIsDownloading(false);
    setDownloadDone(true);
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
              ? () => { setStep(2); setDownloadDone(false); setPdfItems([]); }
              : step === 2
              ? () => setStep(1)
              : onCancel
          }
          disabled={step === 3 && isDownloading}
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
                : 'Step 3: Downloading PDFs for Offline Use'}
            </h1>
            <p className="text-sm text-slate-400 font-serif italic">
              {step === 1
                ? 'Choose exactly one class to proceed with the extra smartboard material download.'
                : step === 2
                ? 'Select up to 8 subjects to tailor your offline smartboard package.'
                : 'All selected book PDFs are being saved to your device for offline access.'}
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

          {/* ── STEP 3: PDF Download progress ── */}
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

              {/* No PDFs message */}
              {pdfItems.length === 0 && (
                <div className="py-10 text-center space-y-3">
                  <div className="text-4xl">📚</div>
                  <p className="text-slate-400 text-sm font-serif italic">
                    No PDF lessons found for the selected books. You can proceed directly.
                  </p>
                </div>
              )}

              {/* PDF item list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scroll">
                {pdfItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      item.status === 'done' || item.status === 'cached'
                        ? 'bg-emerald-900/20 border-emerald-700/30'
                        : item.status === 'error'
                        ? 'bg-rose-900/20 border-rose-700/30'
                        : item.status === 'downloading'
                        ? 'bg-sky-900/20 border-sky-700/30'
                        : 'bg-slate-900/40 border-slate-800'
                    }`}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
                      {item.status === 'cached' && (
                        <HardDrive className="w-4 h-4 text-emerald-400" />
                      )}
                      {item.status === 'done' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      {item.status === 'downloading' && (
                        <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                      )}
                      {item.status === 'pending' && (
                        <div className="w-3 h-3 rounded-full border-2 border-slate-600" />
                      )}
                    </div>

                    {/* Label + progress */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate text-slate-300">{item.label}</p>
                      {item.status === 'downloading' && (
                        <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                      {(item.status === 'done' || item.status === 'cached') && (
                        <p className="text-[10px] text-emerald-500 font-mono mt-0.5">
                          {item.status === 'cached' ? 'Already cached · skipped' : 'Saved to device storage'}
                        </p>
                      )}
                      {item.status === 'error' && (
                        <p className="text-[10px] text-rose-400 font-mono mt-0.5">
                          Failed · will retry on first open
                        </p>
                      )}
                    </div>

                    {/* Percentage badge */}
                    {item.status === 'downloading' && (
                      <span className="text-[10px] font-mono text-sky-400 flex-shrink-0">
                        {item.progress}%
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Download complete message */}
              {downloadDone && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-900/30 border border-emerald-600/30 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-emerald-300 font-bold text-sm">Download Complete!</p>
                    <p className="text-emerald-500/80 text-xs font-serif italic mt-0.5">
                      Your PDFs are saved locally. They will load instantly even without internet.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Footer Buttons ── */}
          <div className="mt-10 flex justify-end relative z-10">
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
                onClick={handleProceedToDownload}
                disabled={selectedSubjects.length === 0}
                className={`px-8 py-4 w-full md:w-auto rounded-xl font-black uppercase tracking-wider text-sm md:text-base transition-all flex items-center justify-center gap-3 hover:-translate-y-1 transform ${
                  selectedSubjects.length > 0
                    ? 'bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white shadow-xl shadow-sky-900/30 cursor-pointer active:scale-95 border-2 border-transparent hover:border-emerald-400/50'
                    : 'bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <DownloadCloud className="w-5 h-5" />
                Download &amp; Continue
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleFinish}
                disabled={isDownloading}
                className={`px-8 py-4 w-full md:w-auto rounded-xl font-black uppercase tracking-wider text-sm md:text-base transition-all flex items-center justify-center gap-3 ${
                  !isDownloading
                    ? 'bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white shadow-xl shadow-sky-900/30 cursor-pointer active:scale-95 hover:-translate-y-1 transform'
                    : 'bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Downloading…
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
  );
}
