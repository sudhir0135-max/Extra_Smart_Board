import React, { useState, useRef } from 'react';
import { Database, Upload } from 'lucide-react';
import { FlashQuestion } from '../types';
import { Editor } from '@tinymce/tinymce-react';
import * as XLSX from 'xlsx';
import { hasTextContent } from '../lib/contentUtils';
import { setupTinyMceMath, tinymceMathContentStyle } from '../lib/tinymceMathPlugin';
import { setupTinyMceAnnotation } from '../lib/tinymceAnnotationPlugin';

export interface FlashQuestionManagerProps {
  questions: FlashQuestion[];
  onQuestionsUpdate: (newQuestions: FlashQuestion[]) => void;
}

export default function FlashQuestionManager({ questions, onQuestionsUpdate }: FlashQuestionManagerProps) {
  const [newQText, setNewQText] = useState('');
  const [newQAns, setNewQAns] = useState('');
  const [newQDiff, setNewQDiff] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [editingQId, setEditingQId] = useState<string | null>(null);

  const qTextEditorRef = useRef<any>(null);
  const qAnsEditorRef = useRef<any>(null);

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
        difficulty: newQDiff
      } : q);
      onQuestionsUpdate(updated);
      setEditingQId(null);
    } else {
      const newQuestion: FlashQuestion = {
        id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        question: currentQText.trim(),
        answer: currentQAns.trim(),
        difficulty: newQDiff
      };
      onQuestionsUpdate([...questions, newQuestion]);
    }

    setNewQText('');
    setNewQAns('');
    setNewQDiff('Medium');
    if (qTextEditorRef.current) qTextEditorRef.current.setContent('');
    if (qAnsEditorRef.current) qAnsEditorRef.current.setContent('');
  };

  const handleEditQuestion = (q: FlashQuestion) => {
    setEditingQId(q.id);
    setNewQText(q.question);
    setNewQAns(q.answer);
    setNewQDiff(q.difficulty);
    if (qTextEditorRef.current) qTextEditorRef.current.setContent(q.question);
    if (qAnsEditorRef.current) qAnsEditorRef.current.setContent(q.answer);
  };

  const handleDeleteQuestion = (id: string) => {
    onQuestionsUpdate(questions.filter(q => q.id !== id));
  };

  return (
    <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-5 space-y-4 w-full">
      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-sans">
        <Database className="w-4 h-4 text-purple-400" /> Interactive Diagnostic Quizzing
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Add question form block */}
        <div className="md:col-span-5 bg-slate-950/50 border border-slate-850 p-4 rounded-xl space-y-3">
          <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#a855f7] block font-extrabold">New Flashcard Draft</span>
          
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-slate-400 mb-1 block">Question Text:</span>
              <Editor
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                onInit={(evt, editor) => qTextEditorRef.current = editor}
                initialValue={newQText}
                init={{
                  license_key: 'gpl',
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
                  content_style: `body { font-family:Helvetica,Arial,sans-serif; font-size:13px; background-color: #03060c; color: #e2e8f0; } ${tinymceMathContentStyle}`
                }}
              />
            </div>
            
            <div>
              <span className="text-[10px] text-slate-400 mb-1 block">Answer Details:</span>
              <Editor
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                onInit={(evt, editor) => qAnsEditorRef.current = editor}
                initialValue={newQAns}
                init={{
                  license_key: 'gpl',
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
                  content_style: `body { font-family:Helvetica,Arial,sans-serif; font-size:13px; background-color: #03060c; color: #e2e8f0; } ${tinymceMathContentStyle}`
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[8.5px] uppercase font-mono text-slate-400 block">Difficulty:</span>
              <div className="flex gap-1.5">
                {(['Easy', 'Medium', 'Hard'] as const).map(diff => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setNewQDiff(diff)}
                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all select-none border cursor-pointer ${
                      newQDiff === diff
                        ? 'bg-purple-500 border-purple-400 text-white'
                        : 'bg-transparent border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddQuestion}
              className="w-full py-1.5 bg-purple-600 hover:bg-purple-550 text-white rounded text-xs font-bold uppercase transition-all duration-300 cursor-pointer"
            >
              {editingQId ? 'Update Review Question' : 'Register Review Question'}
            </button>
            {editingQId && (
              <button
                onClick={() => {
                  setEditingQId(null);
                  setNewQText('');
                  setNewQAns('');
                  setNewQDiff('Medium');
                  if (qTextEditorRef.current) qTextEditorRef.current.setContent('');
                  if (qAnsEditorRef.current) qAnsEditorRef.current.setContent('');
                }}
                className="w-full mt-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold uppercase transition-all duration-300 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}

            <div className="relative mt-2">
              <label className="w-full flex items-center justify-center gap-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-all duration-300 cursor-pointer border border-slate-700">
                <Upload className="w-3.5 h-3.5" /> Bulk Upload JSON/XLSX
                <input
                  type="file"
                  accept=".json,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
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
                              difficulty: q.difficulty || 'Medium'
                            }));
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
                            difficulty: (r.Difficulty || r.difficulty || 'Medium') as 'Easy' | 'Medium' | 'Hard'
                          })).filter(q => q.question && q.answer);
                          
                          if (formattedQuestions.length > 0) {
                            onQuestionsUpdate([...questions, ...formattedQuestions]);
                            alert(`Successfully bulk loaded ${formattedQuestions.length} questions from Excel!`);
                          } else {
                            alert("No valid questions found in Excel file. Make sure columns are named 'Question', 'Answer', and optional 'Difficulty'.");
                          }
                        } catch (err) {
                          alert("Failed to parse XLSX file");
                        }
                      };
                      reader.readAsArrayBuffer(file);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex justify-end mt-1">
              <button
                onClick={() => {
                  try {
                    const worksheet = XLSX.utils.json_to_sheet([
                      { Question: "What is 2+2?", Answer: "4", Difficulty: "Easy" }
                    ]);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Flashcards");
                    XLSX.writeFile(workbook, "flashcards_template.xlsx");
                  } catch (e) {
                    alert("Failed to generate Excel template");
                  }
                }}
                className="text-[9px] text-purple-400 hover:text-purple-300 uppercase font-mono tracking-wider cursor-pointer transition-colors bg-transparent border-none"
              >
                Download Template XLSX
              </button>
            </div>
          </div>
        </div>

        {/* Active Question Catalog list */}
        <div className="md:col-span-7 space-y-2.5">
          <span className="text-[9.5px] font-mono tracking-wider text-slate-500 uppercase block">Active Question List ({questions.length})</span>
          <div className="bg-slate-950/20 rounded-xl border border-slate-850 divide-y divide-slate-850/50">
            {questions.length === 0 ? (
              <div className="p-4 text-center select-none text-[11px] text-slate-500 font-serif italic">
                No review flashcards compiled yet. Use the draft panel to formulate diagnostic evaluations.
              </div>
            ) : (
              questions.map((q, qIdx) => (
                <div key={q.id} className="p-3 text-xs flex justify-between gap-3 bg-slate-950/30">
                  <div className="space-y-2 flex-1 min-w-0 pr-4">
                    <div className="font-bold text-indigo-400">
                      <span className="text-[10px] uppercase text-indigo-500/50 block mb-0.5">Q{qIdx + 1}.</span>
                      <div className="prose prose-invert prose-sm max-w-none text-xs" dangerouslySetInnerHTML={{ __html: q.question }} />
                    </div>
                    <div className="text-slate-400 font-serif border-l-2 border-slate-700 pl-2">
                      <span className="text-[10px] uppercase text-slate-500 block mb-0.5 font-mono">Ans:</span>
                      <div className="prose prose-invert prose-sm max-w-none text-xs" dangerouslySetInnerHTML={{ __html: q.answer }} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[7.5px] font-mono font-black uppercase text-slate-400 bg-slate-900 border border-slate-800 rounded px-1">
                      {q.difficulty}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditQuestion(q)}
                        className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer bg-transparent border-none"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-[10px] text-rose-450 hover:text-rose-350 cursor-pointer bg-transparent border-none"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
