import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, DownloadCloud, AlertCircle } from 'lucide-react';

import { AcademicClass, AcademicSubject } from '../types';

interface ExtraSmartboardDownloadProps {
  academicClasses: AcademicClass[];
  academicSubjects: AcademicSubject[];
  onCancel: () => void;
  onDownload: (grade: number, subjects: string[]) => void;
}

export default function ExtraSmartboardDownload({
  academicClasses,
  academicSubjects,
  onCancel,
  onDownload
}: ExtraSmartboardDownloadProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [warning, setWarning] = useState('');

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

  const handleDownload = () => {
    if (selectedGrade !== null && selectedSubjects.length > 0) {
      onDownload(selectedGrade, selectedSubjects);
    } else if (selectedSubjects.length === 0) {
      setWarning('Please select at least 1 subject.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-200 font-sans p-4 sm:p-8 flex flex-col items-center selection:bg-emerald-500/30">
      <div className="w-full max-w-4xl mt-4 sm:mt-12">
        <button
          onClick={step === 2 ? () => setStep(1) : onCancel}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors mb-6 font-mono text-sm tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 2 ? 'BACK TO CLASS SELECTION' : 'CANCEL AND RETURN HOME'}
        </button>

        <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="mb-8 border-b border-slate-800/60 pb-6 relative z-10">
            <h1 className="text-2xl sm:text-3xl font-black text-emerald-400 mb-2 tracking-tight">
              {step === 1 ? 'Step 1: Select Your Class' : `Step 2: Select Subjects for Class ${selectedGrade}`}
            </h1>
            <p className="text-sm text-slate-400 font-serif italic">
              {step === 1 
                ? 'Choose exactly one class to proceed with the extra smartboard material download.' 
                : 'Select up to 8 subjects to tailor your offline smartboard package.'}
            </p>
          </div>

          {step === 1 ? (
            <div className="grid grid-cols-12 gap-4 relative z-10">
              {[...academicClasses]
                .sort((a, b) => Number(a.name) - Number(b.name))
                .map((academicClass, index) => (
                <button
                  key={academicClass.id}
                  onClick={() => setSelectedGrade(Number(academicClass.name) || 0)} // Keep number for now to avoid breaking onDownload prop until changed
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
          ) : (
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

          <div className="mt-10 flex justify-end relative z-10">
            {step === 1 ? (
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
            ) : (
              <button
                onClick={handleDownload}
                disabled={selectedSubjects.length === 0}
                className={`px-8 py-4 w-full md:w-auto rounded-xl font-black uppercase tracking-wider text-sm md:text-base transition-all flex items-center justify-center gap-3 hover:-translate-y-1 transform ${
                  selectedSubjects.length > 0
                    ? 'bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white shadow-xl shadow-sky-900/30 cursor-pointer active:scale-95 border-2 border-transparent hover:border-emerald-400/50'
                    : 'bg-slate-800/50 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <DownloadCloud className="w-5 h-5" />
                Continue with selected class and subjects
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
