/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import {
  HelpCircle, Plus, Trash2, Save, ArrowUp, ArrowDown,
  Image as ImageIcon, X, Check, ChevronDown, ChevronUp, Maximize2
} from 'lucide-react';
import { InquiryQuestionObj } from '../types';
import { uploadImageToStorage } from '../lib/firebaseHelper';

/**
 * Standalone full-page rich text question editor.
 * Opened in a new browser tab. Syncs questions back to the
 * parent tab via BroadcastChannel on save.
 */
export default function QuestionEditorPage() {
  // Read the session key from the URL hash: #session=KEY&lesson=TITLE
  const params = new URLSearchParams(window.location.hash.replace('#', ''));
  const sessionKey = params.get('session') || 'default';
  const lessonTitle = params.get('lesson') || 'Lesson';

  // Load existing questions from localStorage
  const [questions, setQuestions] = useState<InquiryQuestionObj[]>(() => {
    try {
      const raw = localStorage.getItem(`qeditor_${sessionKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalise) : [];
      }
    } catch (_) {}
    return [blankQuestion()];
  });

  const [activeIdx, setActiveIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean[]>([]);
  const editorRef = useRef<any>(null);

  // Sync collapse state length
  useEffect(() => {
    setCollapsed((prev) => {
      const next = [...prev];
      while (next.length < questions.length) next.push(false);
      return next.slice(0, questions.length);
    });
  }, [questions.length]);

  function blankQuestion(): InquiryQuestionObj {
    return {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: '',
      image: null,
      imagePosition: 'right',
    };
  }

  function normalise(q: any): InquiryQuestionObj {
    if (typeof q === 'string') return { id: `q_${Date.now()}`, text: q, image: null, imagePosition: 'right' };
    return { id: q.id || `q_${Date.now()}`, text: q.text || '', image: q.image || null, imagePosition: q.imagePosition || 'right' };
  }

  // Flush current editor content into state
  const flushEditor = () => {
    if (editorRef.current) {
      const content = editorRef.current.getContent();
      setQuestions((prev) => {
        const next = [...prev];
        if (next[activeIdx]) next[activeIdx] = { ...next[activeIdx], text: content };
        return next;
      });
      return content;
    }
    return questions[activeIdx]?.text || '';
  };

  const switchTo = (idx: number) => {
    flushEditor();
    setActiveIdx(idx);
  };

  const addQuestion = () => {
    flushEditor();
    const newQ = blankQuestion();
    setQuestions((prev) => [...prev, newQ]);
    setActiveIdx(questions.length);
  };

  const deleteQuestion = (idx: number) => {
    if (questions.length === 1) { alert('At least one question is required.'); return; }
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setActiveIdx(Math.min(activeIdx, updated.length - 1));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    flushEditor();
    const next = [...questions];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setQuestions(next);
    setActiveIdx(idx - 1);
  };

  const moveDown = (idx: number) => {
    if (idx === questions.length - 1) return;
    flushEditor();
    const next = [...questions];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setQuestions(next);
    setActiveIdx(idx + 1);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImageToStorage(file, `inquiry-questions/images`);
      setQuestions((prev) => {
        const next = [...prev];
        next[activeIdx] = { ...next[activeIdx], image: url };
        return next;
      });
    } catch { alert('Image upload failed.'); }
    finally { setIsUploading(false); e.target.value = ''; }
  };

  const saveAll = () => {
    const finalContent = flushEditor();
    const finalQuestions = questions.map((q, i) =>
      i === activeIdx ? { ...q, text: finalContent } : q
    );
    setIsSaving(true);

    // Write to localStorage for parent tab to read
    localStorage.setItem(`qeditor_${sessionKey}`, JSON.stringify(finalQuestions));

    // Broadcast to parent tab
    try {
      const bc = new BroadcastChannel(`qeditor_${sessionKey}`);
      bc.postMessage({ type: 'SAVE', questions: finalQuestions });
      bc.close();
    } catch (_) {}

    setSavedAt(new Date().toLocaleTimeString());
    setIsSaving(false);
  };

  const activeQ = questions[activeIdx];

  return (
    <div className="min-h-screen bg-[#060a14] text-slate-100 flex flex-col font-sans" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0b0f1f] border-b border-slate-800 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <HelpCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight">Rich Text Question Editor</h1>
            <p className="text-[10px] text-slate-500 font-mono">{lessonTitle} · {questions.length} question{questions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved at {savedAt}
            </span>
          )}
          <button
            onClick={saveAll}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-emerald-900/30 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving…' : 'Save All Questions'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR: Question List ── */}
        <aside className="w-[260px] flex-shrink-0 bg-[#0b0f1f] border-r border-slate-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold">Questions</span>
            <button
              onClick={addQuestion}
              className="w-6 h-6 rounded-md bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors cursor-pointer"
              title="Add new question"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
            {questions.map((q, idx) => {
              const preview = q.text.replace(/<[^>]+>/g, '').trim().slice(0, 50) || 'New Question';
              const isActive = idx === activeIdx;
              return (
                <div
                  key={q.id}
                  onClick={() => switchTo(idx)}
                  className={`group relative rounded-lg p-3 cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-200'
                      : 'bg-transparent border-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-mono text-amber-500 font-bold block">Q{idx + 1}</span>
                      <p className="text-[11px] leading-snug truncate">{preview}</p>
                      {q.image && <span className="text-[8px] text-sky-400 font-mono mt-0.5 block">📷 Has image</span>}
                    </div>
                    {/* Action buttons (shown on hover) */}
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); moveUp(idx); }} disabled={idx === 0}
                        className="p-0.5 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"><ArrowUp className="w-2.5 h-2.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); moveDown(idx); }} disabled={idx === questions.length - 1}
                        className="p-0.5 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"><ArrowDown className="w-2.5 h-2.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteQuestion(idx); }}
                        className="p-0.5 hover:text-rose-400 transition-colors cursor-pointer"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-800">
            <button
              onClick={addQuestion}
              className="w-full py-2 rounded-lg border border-dashed border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-600/10 text-indigo-400 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Question
            </button>
          </div>
        </aside>

        {/* ── CENTER: Rich Text Editor ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeQ ? (
            <>
              {/* Editor header */}
              <div className="px-5 py-3 bg-[#0d1120] border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-400 font-bold">Editing Q{activeIdx + 1}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span className="text-[9px] font-mono text-slate-500">Rich text · images · tables · LaTeX supported</span>
                </div>
                <button
                  onClick={() => { flushEditor(); addQuestion(); }}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> New Question
                </button>
              </div>

              {/* TinyMCE */}
              <div className="flex-1 overflow-hidden bg-white">
                <Editor
                  key={activeQ.id}
                  tinymceScriptSrc="/tinymce/tinymce.min.js"
                  onInit={(_, editor) => { editorRef.current = editor; }}
                  initialValue={activeQ.text || '<p></p>'}
                  init={{
                    license_key: 'gpl',
                    height: '100%',
                    menubar: true,
                    resize: false,
                    plugins: [
                      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                      'preview', 'anchor', 'searchreplace', 'visualblocks', 'code',
                      'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount',
                      'emoticons', 'codesample'
                    ],
                    toolbar:
                      'undo redo | styles | bold italic underline strikethrough | ' +
                      'forecolor backcolor | alignleft aligncenter alignright alignjustify | ' +
                      'bullist numlist outdent indent | table | image media link | ' +
                      'codesample emoticons | removeformat | fullscreen | help',
                    table_toolbar:
                      'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | ' +
                      'tableinsertcolbefore tableinsertcolafter tabledeletecol',
                    content_style:
                      'body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; font-size: 16px; color: #1a1a1a; line-height: 1.7; padding: 1.5rem 2rem; max-width: 100%; }' +
                      'table { border-collapse: collapse; width: 100%; margin: 1rem 0; }' +
                      'table td, table th { border: 1px solid #ddd; padding: 8px 12px; }' +
                      'table th { background: #f5f5f5; font-weight: bold; }' +
                      'img { max-width: 100%; height: auto; border-radius: 6px; }',
                    skin: 'oxide',
                    content_css: 'default',
                    image_uploadtab: true,
                    automatic_uploads: false,
                    branding: false,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600">
              <div className="text-center space-y-3">
                <HelpCircle className="w-12 h-12 mx-auto text-slate-700" />
                <p className="font-mono text-sm">Select a question from the sidebar to start editing.</p>
              </div>
            </div>
          )}
        </main>

        {/* ── RIGHT SIDEBAR: Image & Settings ── */}
        {activeQ && (
          <aside className="w-[220px] flex-shrink-0 bg-[#0b0f1f] border-l border-slate-800 flex flex-col overflow-y-auto p-4 space-y-5">

            <div>
              <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold block mb-2">
                Accompanying Image
              </label>
              {activeQ.image ? (
                <div className="relative group">
                  <img src={activeQ.image} alt="Q img" className="w-full aspect-video object-cover rounded-lg border border-slate-700" />
                  <button
                    onClick={() => setQuestions((prev) => {
                      const next = [...prev];
                      next[activeIdx] = { ...next[activeIdx], image: null };
                      return next;
                    })}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/70 text-white rounded hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5 rounded-xl cursor-pointer transition-all">
                  {isUploading
                    ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    : <ImageIcon className="w-6 h-6 text-slate-600" />
                  }
                  <span className="text-[10px] text-slate-500">{isUploading ? 'Uploading…' : 'Upload Image'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                </label>
              )}
            </div>

            {/* Image position */}
            {activeQ.image && (
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold block mb-2">
                  Image Position
                </label>
                <div className="space-y-1.5">
                  {(['left', 'center', 'right'] as const).map((pos) => (
                    <label
                      key={pos}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-xs ${
                        activeQ.imagePosition === pos
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="imgPos"
                        value={pos}
                        checked={activeQ.imagePosition === pos}
                        onChange={() => setQuestions((prev) => {
                          const next = [...prev];
                          next[activeIdx] = { ...next[activeIdx], imagePosition: pos };
                          return next;
                        })}
                        className="w-3 h-3"
                      />
                      <span className="capitalize font-bold">{pos}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800">
              <label className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold block mb-3">
                Quick Actions
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => moveUp(activeIdx)}
                  disabled={activeIdx === 0}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ArrowUp className="w-3 h-3" /> Move Up
                </button>
                <button
                  onClick={() => moveDown(activeIdx)}
                  disabled={activeIdx === questions.length - 1}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ArrowDown className="w-3 h-3" /> Move Down
                </button>
                <button
                  onClick={() => deleteQuestion(activeIdx)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-700/40 text-rose-300 text-[11px] font-bold transition-colors cursor-pointer border border-rose-800/40"
                >
                  <Trash2 className="w-3 h-3" /> Delete Q{activeIdx + 1}
                </button>
              </div>
            </div>

            {/* Save reminder */}
            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={saveAll}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30"
              >
                <Save className="w-3.5 h-3.5" /> Save All
              </button>
              <p className="text-[9px] text-slate-600 font-mono text-center mt-2">
                Changes sync back to the editor panel automatically.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
