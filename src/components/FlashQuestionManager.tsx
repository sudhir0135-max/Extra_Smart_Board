import React, { useState } from 'react';
import { Database, Upload } from 'lucide-react';
import { FlashQuestion } from '../types';

export interface FlashQuestionManagerProps {
  questions: FlashQuestion[];
  onQuestionsUpdate: (newQuestions: FlashQuestion[]) => void;
}

export default function FlashQuestionManager({ questions, onQuestionsUpdate }: FlashQuestionManagerProps) {
  const [newQText, setNewQText] = useState('');
  const [newQAns, setNewQAns] = useState('');
  const [newQDiff, setNewQDiff] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [editingQId, setEditingQId] = useState<string | null>(null);

  const handleAddQuestion = () => {
    if (!newQText.trim() || !newQAns.trim()) {
      alert("Both Question Text and Answer are required");
      return;
    }
    
    if (editingQId) {
      const updated = questions.map(q => q.id === editingQId ? {
        ...q,
        question: newQText.trim(),
        answer: newQAns.trim(),
        difficulty: newQDiff
      } : q);
      onQuestionsUpdate(updated);
      setEditingQId(null);
    } else {
      const newQuestion: FlashQuestion = {
        id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        question: newQText.trim(),
        answer: newQAns.trim(),
        difficulty: newQDiff
      };
      onQuestionsUpdate([...questions, newQuestion]);
    }

    setNewQText('');
    setNewQAns('');
    setNewQDiff('Medium');
  };

  const handleEditQuestion = (q: FlashQuestion) => {
    setEditingQId(q.id);
    setNewQText(q.question);
    setNewQAns(q.answer);
    setNewQDiff(q.difficulty);
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
          
          <div className="space-y-2.5">
            <input
              type="text"
              value={newQText}
              onChange={e => setNewQText(e.target.value)}
              placeholder="Diagnostic review question text..."
              className="w-full bg-[#03060c] border border-slate-850 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
            <input
              type="text"
              value={newQAns}
              onChange={e => setNewQAns(e.target.value)}
              placeholder="Answer key description details..."
              className="w-full bg-[#03060c] border border-slate-850 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none"
            />
            <div className="flex items-center justify-between">
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
                }}
                className="w-full mt-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold uppercase transition-all duration-300 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}

            <div className="relative mt-2">
              <label className="w-full flex items-center justify-center gap-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-all duration-300 cursor-pointer border border-slate-700">
                <Upload className="w-3.5 h-3.5" /> Bulk Upload JSON/CSV
                <input
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      let newQuestions: any[] = [];
                      if (file.name.endsWith('.json')) {
                        try {
                          const parsed = JSON.parse(content);
                          if (Array.isArray(parsed)) newQuestions = parsed;
                        } catch (err) { alert("Invalid JSON file"); }
                      } else if (file.name.endsWith('.csv')) {
                        const lines = content.split('\n');
                        newQuestions = lines.slice(1).map((line) => {
                          const parts = line.split(',');
                          if (parts.length >= 2) {
                            return { question: parts[0].trim(), answer: parts[1].trim(), difficulty: (parts[2]?.trim() || 'Medium') };
                          }
                          return null;
                        }).filter(Boolean);
                      }
                      
                      if (newQuestions.length > 0) {
                        const formattedQuestions: FlashQuestion[] = newQuestions.map((q, idx) => ({
                          id: `up-q-${Date.now()}-${idx}`,
                          question: q.question,
                          answer: q.answer,
                          difficulty: q.difficulty || 'Medium'
                        }));
                        
                        onQuestionsUpdate([...questions, ...formattedQuestions]);
                        alert(`Successfully bulk loaded ${formattedQuestions.length} questions!`);
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex justify-end mt-1">
              <button
                onClick={() => {
                  const csvContent = "data:text/csv;charset=utf-8," + "Question,Answer,Difficulty\n\"What is 2+2?\",\"4\",\"Easy\"";
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "flashcards_template.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="text-[9px] text-purple-400 hover:text-purple-300 uppercase font-mono tracking-wider cursor-pointer transition-colors bg-transparent border-none"
              >
                Download Template CSV
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
                  <div className="space-y-1">
                    <span className="font-bold text-indigo-400 block">Q{qIdx + 1}. {q.question}</span>
                    <span className="text-slate-400 block font-serif">Ans: {q.answer}</span>
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
