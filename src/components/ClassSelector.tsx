/**
 * ClassSelector.tsx
 *
 * A modern, premium Class Selection page designed for student management.
 * Supports configuring up to 2 classes in memory, selecting subjects,
 * switching active classes, and launching the library shelf.
 */

import React, { useState } from 'react';
import { Sparkles, BookOpen, Plus, Trash2, CheckCircle2, ArrowRight, ArrowLeft, BookOpenCheck, Settings } from 'lucide-react';
import { AcademicClass, AcademicSubject } from '../types';

export interface StudyClass {
  classId: string;
  className: string;
  subjects: string[];
}

interface ClassSelectorProps {
  globalLogo?: string | null;
  academicClasses: AcademicClass[];
  academicSubjects: AcademicSubject[];
  studyClasses: StudyClass[];
  activeClassIndex: number;
  onSelectClassIndex: (index: number) => void;
  onAddClass: (studyClass: StudyClass) => void;
  onRemoveClass: (index: number) => void;
  onProceed: () => void;
  onBack: () => void;
}

export default function ClassSelector({
  globalLogo,
  academicClasses,
  academicSubjects,
  studyClasses,
  activeClassIndex,
  onSelectClassIndex,
  onAddClass,
  onRemoveClass,
  onProceed,
  onBack,
}: ClassSelectorProps) {
  // Local state for configuration modal/wizard
  const [isConfiguring, setIsConfiguring] = useState(studyClasses.length === 0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [warning, setWarning] = useState('');

  const handleToggleSubject = (subjectName: string) => {
    if (selectedSubjects.includes(subjectName)) {
      setSelectedSubjects(prev => prev.filter(s => s !== subjectName));
      setWarning('');
    } else {
      if (selectedSubjects.length >= 8) {
        setWarning('You can select a maximum of 8 subjects.');
      } else {
        setSelectedSubjects(prev => [...prev, subjectName]);
        setWarning('');
      }
    }
  };

  const handleSaveClass = () => {
    if (!selectedClassId) {
      setWarning('Please select a class.');
      return;
    }
    if (selectedSubjects.length === 0) {
      setWarning('Please select at least one subject.');
      return;
    }

    const matchedClass = academicClasses.find(c => c.id === selectedClassId);
    if (!matchedClass) return;

    const newStudyClass: StudyClass = {
      classId: matchedClass.id,
      className: matchedClass.name,
      subjects: selectedSubjects,
    };

    onAddClass(newStudyClass);

    // Reset local wizard state
    setSelectedClassId(null);
    setSelectedSubjects([]);
    setWarning('');
    setIsConfiguring(false);
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col justify-between font-sans relative overflow-y-auto">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="px-6 py-5 max-w-6xl mx-auto w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2.5">
          {globalLogo ? (
            <img src={globalLogo} alt="Global Logo" className="w-8 h-8 rounded-lg object-contain bg-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold select-none shadow-md shadow-emerald-900/30">
              <BookOpen className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-base tracking-tight text-white font-sans">Extrapadhai.com</h1>
            <p className="text-[10px] text-emerald-400 font-mono tracking-wider">OFFLINE-FIRST TEXTBOOK SUITE</p>
          </div>
        </div>

      </header>

      {/* Main Core */}
      <main className="flex-1 max-w-4xl mx-auto w-full flex flex-col justify-center px-6 py-8 z-10 relative">
        {isConfiguring ? (
          /* CONFIGURATION WIZARD */
          <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl relative">
            <button
              onClick={() => {
                if (studyClasses.length > 0) {
                  setIsConfiguring(false);
                } else {
                  onBack();
                }
              }}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors mb-6 font-mono text-xs tracking-wider cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              CANCEL
            </button>

            <div className="mb-6 border-b border-slate-800/60 pb-4">
              <h2 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                {!selectedClassId ? 'Select Class to Study' : `Select Subjects for Class ${academicClasses.find(c => c.id === selectedClassId)?.name}`}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-serif italic">
                {!selectedClassId 
                  ? 'Choose which class syllabus you wish to configure.' 
                  : 'Select the subjects you want to load textbooks for.'}
              </p>
            </div>

            {/* Step 1: Select Class */}
            {!selectedClassId ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...academicClasses]
                  .sort((a, b) => Number(a.name) - Number(b.name))
                  .map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => {
                        setSelectedClassId(cls.id);
                        setWarning('');
                      }}
                      className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center gap-2 hover:bg-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
                    >
                      <span className="text-3xl font-black text-slate-100 group-hover:text-emerald-400 transition-colors">{cls.name}</span>
                      <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Class</span>
                    </button>
                  ))}
              </div>
            ) : (
              /* Step 2: Select Subjects */
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[...academicSubjects]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(sub => {
                      const isSelected = selectedSubjects.includes(sub.name);
                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleToggleSubject(sub.name)}
                          className={`p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-350 shadow-inner'
                              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <span className="font-bold text-xs truncate pr-2">{sub.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                </div>

                {warning && (
                  <div className="text-rose-450 bg-rose-950/20 border border-rose-900/30 p-3 rounded-lg text-xs font-bold tracking-wide flex items-center gap-2">
                    <span>⚠️</span> {warning}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-slate-800/40">
                  <button
                    onClick={() => {
                      setSelectedClassId(null);
                      setSelectedSubjects([]);
                    }}
                    className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Back to Classes
                  </button>

                  <button
                    onClick={handleSaveClass}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all cursor-pointer"
                  >
                    Save &amp; Add Class
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CLASSES IN MEMORY DISPLAY */
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Your Study Profiles</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                You can manage up to 2 classes in memory and switch between them dynamically.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {studyClasses.map((sc, idx) => {
                const isActive = idx === activeClassIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => onSelectClassIndex(idx)}
                    className={`p-6 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between h-56 cursor-pointer transform hover:-translate-y-1 ${
                      isActive
                        ? 'bg-slate-900/90 border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    {/* Spine Shadow Decor */}
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-emerald-500/10 to-transparent pointer-events-none rounded-l-2xl" />

                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono tracking-widest text-slate-500 block uppercase">
                            Class Profile 0{idx + 1}
                          </span>
                          <h3 className={`text-2xl font-black tracking-tight mt-1 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                            Class {sc.className}
                          </h3>
                        </div>
                        {isActive && (
                          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto no-scrollbar">
                        {sc.subjects.map((sub, sIdx) => (
                          <span
                            key={sIdx}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium tracking-wide ${
                              isActive ? 'bg-slate-800 text-emerald-300' : 'bg-slate-900/60 text-slate-500'
                            }`}
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-800/40 mt-auto">
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <BookOpenCheck className="w-3.5 h-3.5" />
                        {sc.subjects.length} Subjects
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveClass(idx);
                        }}
                        className="p-1.5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-slate-500 hover:text-rose-450 rounded-lg transition-colors cursor-pointer"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add Second Class placeholder */}
              {studyClasses.length < 2 && (
                <button
                  onClick={() => setIsConfiguring(true)}
                  className="p-6 rounded-2xl border-2 border-dashed border-slate-800 hover:border-slate-650 hover:bg-[#0c1220]/25 transition-all flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-slate-350 h-56 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold block">Add Class to Study</span>
                    <span className="text-[10px] font-mono tracking-wide text-slate-600 block mt-0.5">
                      Configure a secondary class profile
                    </span>
                  </div>
                </button>
              )}
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={onProceed}
                className="group px-8 py-4 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold tracking-widest transition-all duration-300 shadow-xl shadow-emerald-950/20 hover:scale-105 rounded-xl text-sm uppercase flex items-center gap-3 cursor-pointer"
              >
                Proceed to Library Shelf
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 bg-[#04060b] text-center z-10 text-[10px] text-slate-500 font-mono tracking-wider">
        Extrapadhai.com • Dual Syllabus Selection Active • Aligned with CBSE &amp; State Boards
      </footer>
    </div>
  );
}
