import React, { useState, useRef, useEffect } from 'react';
import { Database, Upload, Trash2, Plus, FileSpreadsheet } from 'lucide-react';
import { FlashQuestion } from '../types';
import { Editor } from '@tinymce/tinymce-react';
import * as XLSX from 'xlsx';
import { hasTextContent, confirmUploadTopics } from '../lib/contentUtils';
import { setupTinyMceMath, tinymceMathContentStyle } from '../lib/tinymceMathPlugin';
import { setupTinyMceAnnotation, tinymceAnnotationContentStyle } from '../lib/tinymceAnnotationPlugin';

export interface FlashQuestionManagerProps {
  questions: FlashQuestion[];
  onQuestionsUpdate: (newQuestions: FlashQuestion[]) => void;
  availableTopics?: string[];
  activeTopicTitle?: string;
}

export default function FlashQuestionManager({
  questions,
  onQuestionsUpdate,
  availableTopics = [],
  activeTopicTitle,
}: FlashQuestionManagerProps) {
  const [newQText, setNewQText] = useState('');
  const [newQAns, setNewQAns] = useState('');
  const [newQDiff, setNewQDiff] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [newQTopic, setNewQTopic] = useState(activeTopicTitle || '');
  const [newQSource, setNewQSource] = useState('');
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterTopic, setFilterTopic] = useState<'all' | 'active'>('all');

  // Distinct source names already used in this chapter (suggestions for the Source field)
  const sourceListId = React.useId();
  const existingSources = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of questions) {
      const s = typeof q === 'string' ? '' : (q?.source || '').trim();
      if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  const qTextEditorRef = useRef<any>(null);
  const qAnsEditorRef = useRef<any>(null);

  // Pre-fill topic field when activeTopicTitle changes and not editing
  useEffect(() => {
    if (activeTopicTitle && editingQId === null) {
      setNewQTopic(activeTopicTitle);
    }
  }, [activeTopicTitle, editingQId]);

  // Keep selected ids bounded if questions array changes
  useEffect(() => {
    const existingIds = new Set(questions.map(q => q.id));
    setSelectedIds(prev => prev.filter(id => existingIds.has(id)));
  }, [questions]);

  const activeTopicQuestionsCount = React.useMemo(() => {
    if (!activeTopicTitle) return 0;
    const activeLower = activeTopicTitle.trim().toLowerCase();
    return questions.filter(q => (q.topicTitle || '').trim().toLowerCase() === activeLower).length;
  }, [questions, activeTopicTitle]);

  // If user was filtering by active topic and that topic now has 0 questions, fallback to 'all' so questions never vanish
  useEffect(() => {
    if (filterTopic === 'active' && activeTopicQuestionsCount === 0 && questions.length > 0) {
      setFilterTopic('all');
    }
  }, [filterTopic, activeTopicQuestionsCount, questions.length]);

  const displayedQuestions = React.useMemo(() => {
    if (!activeTopicTitle || filterTopic === 'all') {
      return questions;
    }
    const activeLower = activeTopicTitle.trim().toLowerCase();
    return questions.filter(q => (q.topicTitle || '').trim().toLowerCase() === activeLower);
  }, [questions, activeTopicTitle, filterTopic]);

  const toggleSelectQuestion = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const displayedIds = displayedQuestions.map(q => q.id);
    const allDisplayedSelected = displayedIds.length > 0 && displayedIds.every(id => selectedIds.includes(id));
    if (allDisplayedSelected) {
      setSelectedIds(prev => prev.filter(id => !displayedIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...displayedIds])));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected diagnostic question${selectedIds.length > 1 ? 's' : ''}?`)) {
      return;
    }
    const toDelete = new Set(selectedIds);
    const updated = questions.filter(q => !toDelete.has(q.id));
    setSelectedIds([]);
    onQuestionsUpdate(updated);
  };

  const handleAddQuestion = () => {
    const currentQText = qTextEditorRef.current ? qTextEditorRef.current.getContent() : newQText;
    const currentQAns = qAnsEditorRef.current ? qAnsEditorRef.current.getContent() : newQAns;

    if (!hasTextContent(currentQText) || !hasTextContent(currentQAns)) {
      alert("Both Question Text and Answer are required");
      return;
    }
    
    if (editingQId) {
      const updated = questions.map(q => q.id === editingQId ? {
        ...q,
        question: currentQText.trim(),
        answer: currentQAns.trim(),
        difficulty: newQDiff,
        topicTitle: newQTopic.trim() || null,
        source: newQSource.trim() || null
      } : q);
      onQuestionsUpdate(updated);
      setEditingQId(null);
    } else {
      const newQuestion: FlashQuestion = {
        id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        question: currentQText.trim(),
        answer: currentQAns.trim(),
        difficulty: newQDiff,
        topicTitle: newQTopic.trim() || null,
        source: newQSource.trim() || null
      };
      onQuestionsUpdate([...questions, newQuestion]);
    }

    setNewQText('');
    setNewQAns('');
    setNewQDiff('Medium');
    setNewQTopic(activeTopicTitle || '');
    if (qTextEditorRef.current) qTextEditorRef.current.setContent('');
    if (qAnsEditorRef.current) qAnsEditorRef.current.setContent('');
  };

  const handleEditQuestion = (q: FlashQuestion) => {
    setEditingQId(q.id);
    setNewQText(q.question);
    setNewQAns(q.answer);
    setNewQDiff(q.difficulty);
    setNewQTopic(q.topicTitle || '');
    setNewQSource(q.source || '');
    if (qTextEditorRef.current) qTextEditorRef.current.setContent(q.question);
    if (qAnsEditorRef.current) qAnsEditorRef.current.setContent(q.answer);
  };

  const handleDeleteQuestion = (id: string) => {
    setSelectedIds(prev => prev.filter(i => i !== id));
    onQuestionsUpdate(questions.filter(q => q.id !== id));
  };

  const handleBulkUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            const formattedQuestions: FlashQuestion[] = parsed.map((q, idx) => ({
              id: `up-q-${Date.now()}-${idx}`,
              question: q.question || '',
              answer: q.answer || '',
              difficulty: q.difficulty || 'Medium',
              topicTitle: q.topicTitle || q.topic || null,
              source: q.source || q.Source || null
            })).filter(q => q.question && q.answer);
            if (!confirmUploadTopics(formattedQuestions.map(q => q.topicTitle), availableTopics)) {
              alert('Upload cancelled. Nothing was saved.');
              return;
            }
            onQuestionsUpdate([...questions, ...formattedQuestions]);
            alert(`Successfully bulk loaded ${formattedQuestions.length} questions!`);
          }
        } catch (err) { alert("Invalid JSON file"); }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];

          const formattedQuestions: FlashQuestion[] = rows.map((r, idx) => ({
            id: `up-q-${Date.now()}-${idx}`,
            question: String(r.Question || r.question || ''),
            answer: String(r.Answer || r.answer || ''),
            difficulty: (r.Difficulty || r.difficulty || 'Medium') as 'Easy' | 'Medium' | 'Hard',
            topicTitle: r.Topic || r.topic ? String(r.Topic || r.topic) : null,
            source: String(r.Source || r.source || '').trim() || null
          })).filter(q => q.question && q.answer);

          if (formattedQuestions.length > 0) {
            if (!confirmUploadTopics(formattedQuestions.map(q => q.topicTitle), availableTopics)) {
              alert('Upload cancelled. Nothing was saved.');
              return;
            }
            onQuestionsUpdate([...questions, ...formattedQuestions]);
            alert(`Successfully bulk loaded ${formattedQuestions.length} questions from Excel!`);
          } else {
            alert("No valid questions found in Excel file. Make sure columns are named 'Question', 'Answer', and optional 'Difficulty', 'Topic', 'Source'.");
          }
        } catch (err) {
          alert("Failed to parse XLSX file");
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet([
        { Question: "What is 2+2?", Answer: "4", Difficulty: "Easy", Topic: availableTopics[0] || "Sample Topic", Source: "NCERT" },
        { Question: "What is the capital of France?", Answer: "Paris", Difficulty: "Medium", Topic: availableTopics[1] || "Sample Topic", Source: "CBSE 2023" }
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DiagnosticQuiz");
      XLSX.writeFile(workbook, "diagnostic_quizzing_template.xlsx");
    } catch (e) {
      alert("Failed to generate Excel template");
    }
  };

  return (
    <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-5 space-y-5 w-full mt-4 relative">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-sans">
          <Database className="w-4 h-4 text-purple-400" /> Interactive Diagnostic Quizzing
        </h3>
      </div>

      {/* 1. New Question Draft Container (Full Width) */}
      <div className="w-full bg-slate-950/60 border border-slate-850 p-4.5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#a855f7] font-extrabold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block animate-pulse" />
            {editingQId ? 'Editing Review Question' : 'New Flashcard Draft'}
          </span>
          {editingQId && (
            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full font-bold">
              Edit Mode
            </span>
          )}
        </div>

        {/* Row 1: Question and Answer input rich editors side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Question Text Editor */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
              Question Text <span className="text-rose-400 font-sans">*</span>
            </label>
            <div className="rounded-lg overflow-hidden border border-slate-700/80">
              <Editor
                licenseKey="gpl"
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                onInit={(evt, editor) => qTextEditorRef.current = editor}
                initialValue={newQText}
                init={{
                  height: 200,
                  menubar: false,
                  skin: 'oxide-dark',
                  content_css: 'dark',
                  plugins: ['lists', 'link', 'image', 'charmap', 'table', 'code'],
                  setup: (editor) => {
                    setupTinyMceMath(editor);
                    setupTinyMceAnnotation(editor);
                  },
                  toolbar: 'undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link image latex annotation',
                  content_style: `body { font-family:Helvetica,Arial,sans-serif; font-size:13px; background-color: #03060c; color: #e2e8f0; } ${tinymceMathContentStyle} ${tinymceAnnotationContentStyle}`
                }}
              />
            </div>
          </div>

          {/* Answer Details Editor */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Answer Details <span className="text-rose-400 font-sans">*</span>
            </label>
            <div className="rounded-lg overflow-hidden border border-slate-700/80">
              <Editor
                licenseKey="gpl"
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                onInit={(evt, editor) => qAnsEditorRef.current = editor}
                initialValue={newQAns}
                init={{
                  height: 200,
                  menubar: false,
                  skin: 'oxide-dark',
                  content_css: 'dark',
                  plugins: ['lists', 'link', 'image', 'charmap', 'table', 'code'],
                  setup: (editor) => {
                    setupTinyMceMath(editor);
                    setupTinyMceAnnotation(editor);
                  },
                  toolbar: 'undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link image latex annotation',
                  content_style: `body { font-family:Helvetica,Arial,sans-serif; font-size:13px; background-color: #03060c; color: #e2e8f0; } ${tinymceMathContentStyle} ${tinymceAnnotationContentStyle}`
                }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Topic Selector Dropdown, Difficulty, Register Question Button, Bulk Upload Button, Template Download */}
        <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 pt-1">
          {/* Topic Dropdown */}
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
              Topic of Lesson <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <select
              value={newQTopic}
              onChange={e => setNewQTopic(e.target.value)}
              className="w-full bg-[#03060c] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors h-[38px] font-sans"
            >
              <option value="">-- No Topic / Chapter Level --</option>
              {availableTopics.map((top, idx) => (
                <option key={idx} value={top}>
                  {top}
                </option>
              ))}
              {newQTopic && !availableTopics.includes(newQTopic) && (
                <option value={newQTopic}>
                  {newQTopic} (Current)
                </option>
              )}
            </select>
          </div>

          {/* Source Field */}
          <div className="w-full md:w-48 space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
              Source <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              list={sourceListId}
              value={newQSource}
              onChange={e => setNewQSource(e.target.value)}
              placeholder="e.g. NCERT, CBSE 2023"
              className="w-full bg-[#03060c] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors h-[38px] font-sans"
            />
            <datalist id={sourceListId}>
              {existingSources.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Difficulty Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
              Difficulty Level
            </label>
            <div className="flex items-center gap-1.5 bg-[#03060c] p-1 rounded-lg border border-slate-700/80 h-[38px]">
              {(['Easy', 'Medium', 'Hard'] as const).map(diff => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setNewQDiff(diff)}
                  className={`px-3 py-1 rounded text-[9.5px] font-bold uppercase transition-all select-none border cursor-pointer ${
                    newQDiff === diff
                      ? 'bg-purple-600 border-purple-400 text-white shadow-sm shadow-purple-900/40'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAddQuestion}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-550 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer h-[38px] flex items-center gap-1.5 shadow-sm shadow-purple-900/30 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> {editingQId ? 'Update Review Question' : 'Register Review Question'}
            </button>

            {editingQId && (
              <button
                onClick={() => {
                  setEditingQId(null);
                  setNewQText('');
                  setNewQAns('');
                  setNewQDiff('Medium');
                  setNewQTopic(activeTopicTitle || '');
                  if (qTextEditorRef.current) qTextEditorRef.current.setContent('');
                  if (qAnsEditorRef.current) qAnsEditorRef.current.setContent('');
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer h-[38px] whitespace-nowrap"
              >
                Cancel
              </button>
            )}

            {/* Bulk Upload Button */}
            <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border border-slate-700 h-[38px] flex items-center gap-1.5 whitespace-nowrap shadow-sm">
              <Upload className="w-3.5 h-3.5 text-purple-400" /> Bulk Upload JSON/XLSX
              <input
                type="file"
                accept=".json,.xlsx,.xls"
                className="hidden"
                onChange={handleBulkUploadFile}
              />
            </label>

            {/* Download Template Button */}
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-purple-400 hover:text-purple-300 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer border border-slate-800 h-[38px] flex items-center gap-1.5 whitespace-nowrap"
              title="Download Excel Template"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Template
            </button>
          </div>
        </div>
      </div>

      {/* 2. Active Diagnostic Questions Container (Full Width, Beneath Draft) */}
      <div className="w-full space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-2.5 px-3.5 rounded-lg border border-slate-850">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
              Active Question List ({questions.length})
            </span>

            {/* Topic Filter Pills */}
            {activeTopicTitle && (
              <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTopic('all')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    filterTopic === 'all'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  All Chapter Quizzes ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTopic('active')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterTopic === 'active'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>This Topic: {activeTopicTitle}</span>
                  <span className="bg-indigo-950/60 px-1 py-0.2 rounded font-mono text-[9px] text-indigo-300">
                    {activeTopicQuestionsCount}
                  </span>
                </button>
              </div>
            )}

            {displayedQuestions.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={displayedQuestions.length > 0 && displayedQuestions.every(q => selectedIds.includes(q.id))}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500"
                />
                <span className="text-[10px] font-mono uppercase text-slate-500">
                  {displayedQuestions.length > 0 && displayedQuestions.every(q => selectedIds.includes(q.id)) ? 'Deselect All' : 'Select All'}
                </span>
              </label>
            )}
          </div>

          {/* Bulk Selection Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                {selectedIds.length} Selected
              </span>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm shadow-rose-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer bg-transparent border-none"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-950/20 rounded-xl border border-slate-850 divide-y divide-slate-850/50">
          {displayedQuestions.length === 0 ? (
            <div className="p-6 text-center select-none text-xs text-slate-500 font-serif italic">
              {questions.length === 0
                ? "No review flashcards compiled yet. Use the draft panel above to formulate diagnostic evaluations or use bulk upload."
                : `No review flashcards matching this topic ("${activeTopicTitle}").`}
            </div>
          ) : (
            displayedQuestions.map((q, qIdx) => {
              const isSelected = selectedIds.includes(q.id);

              return (
                <div
                  key={q.id}
                  className={`p-3 text-xs flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-rose-950/20 border-l-4 border-l-rose-500' : 'bg-slate-950/30 hover:bg-slate-900/40'
                  }`}
                >
                  {/* Select Checkbox */}
                  <div className="pt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectQuestion(q.id)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500"
                      title={`Select Question Q${qIdx + 1}`}
                    />
                  </div>

                  <div className="space-y-2 flex-1 min-w-0 pr-2">
                    <div className="font-bold text-indigo-400">
                      <span className="text-[10px] uppercase text-indigo-500/60 block mb-0.5 font-mono">
                        Q{qIdx + 1}.
                      </span>
                      <div className="prose prose-invert prose-sm max-w-none text-xs" dangerouslySetInnerHTML={{ __html: q.question }} />
                    </div>
                    <div className="text-slate-400 font-serif border-l-2 border-slate-700 pl-2.5">
                      <span className="text-[10px] uppercase text-slate-500 block mb-0.5 font-mono">Ans:</span>
                      <div className="prose prose-invert prose-sm max-w-none text-xs" dangerouslySetInnerHTML={{ __html: q.answer }} />
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {q.topicTitle && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono uppercase tracking-wide">
                          Topic: {q.topicTitle}
                        </span>
                      )}
                      {q.source && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono uppercase tracking-wide">
                          Source: {q.source}
                        </span>
                      )}
                      <span className={`text-[8px] font-mono font-bold uppercase rounded px-1.5 py-0.5 border ${
                        q.difficulty === 'Easy'
                          ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                          : q.difficulty === 'Hard'
                          ? 'bg-rose-950/40 border-rose-800 text-rose-400'
                          : 'bg-amber-950/40 border-amber-800 text-amber-400'
                      }`}>
                        {q.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditQuestion(q)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer bg-transparent border-none"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-[11px] text-rose-450 hover:text-rose-350 font-medium cursor-pointer bg-transparent border-none"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

