import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle, Upload, X, Save, ArrowLeft, ArrowRight,
  Image as ImageIcon, Plus, Trash2, ExternalLink,
  MessageSquare, HelpCircle as QuestionIcon, CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InquiryQuestionObj } from '../types';
import { Editor } from '@tinymce/tinymce-react';
import { uploadImageToStorage } from '../lib/firebaseHelper';
import { setupTinyMceMath, tinymceMathContentStyle } from '../lib/tinymceMathPlugin';
import { setupTinyMceAnnotation } from '../lib/tinymceAnnotationPlugin';

export interface InquiryQuestionManagerProps {
  questions: (string | InquiryQuestionObj)[];
  onQuestionsUpdate: (newQuestions: (string | InquiryQuestionObj)[]) => void;
}

type EditorTab = 'question' | 'answer';

export default function InquiryQuestionManager({ questions, onQuestionsUpdate }: InquiryQuestionManagerProps) {
  const [newQText, setNewQText] = useState('');
  const [newAText, setNewAText] = useState('');
  const [editingQIdx, setEditingQIdx] = useState<number | null>(null);

  // Advanced Editor Modal State
  const [isAdvancedEditorOpen, setIsAdvancedEditorOpen] = useState(false);
  const [advancedEditorIndex, setAdvancedEditorIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<EditorTab>('question');
  const editorRef = useRef<any>(null);

  // Question tab drafts
  const [advTextDraft, setAdvTextDraft] = useState('');
  const [advImageDraft, setAdvImageDraft] = useState<string | null>(null);
  const [advImagePosition, setAdvImagePosition] = useState<'left' | 'center' | 'right'>('right');

  // Answer tab drafts
  const [advAnswerTextDraft, setAdvAnswerTextDraft] = useState('');
  const [advAnswerImageDraft, setAdvAnswerImageDraft] = useState<string | null>(null);
  const [advAnswerImagePosition, setAdvAnswerImagePosition] = useState<'left' | 'center' | 'right'>('right');

  const [isUploading, setIsUploading] = useState(false);

  // ── New-window editor: unique session key per lesson instance ──
  const sessionKey = useRef(`qs_${Date.now()}`).current;

  // Listen for saved questions broadcast from the new-window editor
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`qeditor_${sessionKey}`);
      bc.onmessage = (evt) => {
        if (evt.data?.type === 'SAVE' && Array.isArray(evt.data.questions)) {
          onQuestionsUpdate(evt.data.questions);
        }
      };
    } catch (_) {}
    return () => { bc?.close(); };
  }, [sessionKey, onQuestionsUpdate]);

  const openInNewWindow = (lessonTitle?: string) => {
    try {
      localStorage.setItem(`qeditor_${sessionKey}`, JSON.stringify(questions));
    } catch (_) {}
    const hash = `#qeditor&session=${sessionKey}&lesson=${encodeURIComponent(lessonTitle || 'Lesson')}`;
    window.open(`${window.location.origin}${window.location.pathname}${hash}`, '_blank', 'noopener');
  };

  /** Flush current TinyMCE content into the correct draft state based on active tab */
  const flushEditorToDraft = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getContent();
    if (activeTab === 'question') {
      setAdvTextDraft(content);
    } else {
      setAdvAnswerTextDraft(content);
    }
    return content;
  };

  const loadIntoAdvancedEditor = (idx: number, tab: EditorTab = 'question') => {
    const q = questions[idx];
    setAdvancedEditorIndex(idx);
    setActiveTab(tab);

    if (typeof q === 'string') {
      setAdvTextDraft(`<p>${q}</p>`);
      setAdvImageDraft(null);
      setAdvImagePosition('right');
      setAdvAnswerTextDraft('');
      setAdvAnswerImageDraft(null);
      setAdvAnswerImagePosition('right');
    } else if (q) {
      setAdvTextDraft(q.text || '');
      setAdvImageDraft(q.image || null);
      setAdvImagePosition(q.imagePosition || 'right');
      setAdvAnswerTextDraft(q.answerText || '');
      setAdvAnswerImageDraft(q.answerImage || null);
      setAdvAnswerImagePosition(q.answerImagePosition || 'right');
    } else {
      setAdvTextDraft('');
      setAdvImageDraft(null);
      setAdvImagePosition('right');
      setAdvAnswerTextDraft('');
      setAdvAnswerImageDraft(null);
      setAdvAnswerImagePosition('right');
    }
  };

  /** Switch tabs — flush current editor content first */
  const handleTabSwitch = (tab: EditorTab) => {
    if (tab === activeTab) return;
    // Flush current editor content to its draft state
    const content = editorRef.current ? editorRef.current.getContent() : '';
    if (activeTab === 'question') {
      setAdvTextDraft(content);
    } else {
      setAdvAnswerTextDraft(content);
    }
    setActiveTab(tab);
  };

  const handleSaveAdvanced = () => {
    // Always flush editor content before saving
    const content = editorRef.current ? editorRef.current.getContent() : (activeTab === 'question' ? advTextDraft : advAnswerTextDraft);

    const currentQ = questions[advancedEditorIndex];
    const existingId = typeof currentQ !== 'string' && currentQ?.id
      ? currentQ.id
      : `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build the latest question & answer drafts
    const questionText = activeTab === 'question' ? content : advTextDraft;
    const answerText = activeTab === 'answer' ? content : advAnswerTextDraft;

    const updatedQ: InquiryQuestionObj = {
      id: existingId,
      text: questionText,
      image: advImageDraft,
      imagePosition: advImagePosition,
      answerText: answerText || null,
      answerImage: advAnswerImageDraft,
      answerImagePosition: advAnswerImagePosition,
    };
    const updated = [...questions];
    updated[advancedEditorIndex] = updatedQ;
    onQuestionsUpdate(updated);

    // Update local drafts so they stay in sync
    if (activeTab === 'question') setAdvTextDraft(content);
    else setAdvAnswerTextDraft(content);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImageToStorage(file, `inquiry-questions/images`);
      if (activeTab === 'question') {
        setAdvImageDraft(url);
      } else {
        setAdvAnswerImageDraft(url);
      }
    } catch (err) {
      alert("Failed to upload image.");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddQuestion = () => {
    if (!newQText.trim()) {
      alert("Question Text is required");
      return;
    }

    if (editingQIdx !== null) {
      const updated = [...questions];
      const existing = updated[editingQIdx];
      if (typeof existing === 'string') {
        // Upgrade plain string to full object so answer is supported
        updated[editingQIdx] = {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          text: newQText.trim(),
          answerText: newAText.trim() || null,
        };
      } else {
        updated[editingQIdx] = {
          ...existing,
          text: newQText.trim(),
          answerText: newAText.trim() || existing.answerText || null,
        };
      }
      onQuestionsUpdate(updated);
      setEditingQIdx(null);
    } else {
      // Always store as InquiryQuestionObj so answer editing is always available
      const newQ: InquiryQuestionObj = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        text: newQText.trim(),
        answerText: newAText.trim() || null,
      };
      onQuestionsUpdate([...questions, newQ]);
    }

    setNewQText('');
    setNewAText('');
  };

  const handleEditQuestion = (q: string | InquiryQuestionObj, idx: number) => {
    if (typeof q === 'string') {
      setEditingQIdx(idx);
      setNewQText(q);
      setNewAText('');
    } else {
      // For simple (non-rich) InquiryQuestionObj, edit inline in the draft panel
      const hasRichText = q.text && (q.text.includes('<') || q.answerText?.includes('<'));
      if (!hasRichText) {
        setEditingQIdx(idx);
        setNewQText(q.text.replace(/<[^>]+>/g, ''));
        setNewAText((q.answerText || '').replace(/<[^>]+>/g, ''));
      } else {
        loadIntoAdvancedEditor(idx, 'question');
        setIsAdvancedEditorOpen(true);
      }
    }
  };

  const handleEditAnswer = (idx: number) => {
    loadIntoAdvancedEditor(idx, 'answer');
    setIsAdvancedEditorOpen(true);
  };

  const handleDeleteQuestion = (idx: number) => {
    const updated = [...questions];
    updated.splice(idx, 1);
    onQuestionsUpdate(updated);
  };

  // Helpers
  const getAnswerPreview = (q: string | InquiryQuestionObj): string | null => {
    if (typeof q === 'string') return null;
    if (!q.answerText) return null;
    return q.answerText.replace(/<[^>]+>/g, '').substring(0, 80) || null;
  };

  const hasAnswer = (q: string | InquiryQuestionObj) => {
    if (typeof q === 'string') return false;
    return !!(q.answerText && q.answerText.replace(/<[^>]+>/g, '').trim());
  };

  // The editor content to initialize when tab or question changes
  const currentEditorContent = activeTab === 'question' ? advTextDraft : advAnswerTextDraft;
  const currentImageDraft = activeTab === 'question' ? advImageDraft : advAnswerImageDraft;
  const currentImagePosition = activeTab === 'question' ? advImagePosition : advAnswerImagePosition;

  const setCurrentImageDraft = (url: string | null) => {
    if (activeTab === 'question') setAdvImageDraft(url);
    else setAdvAnswerImageDraft(url);
  };
  const setCurrentImagePosition = (pos: 'left' | 'center' | 'right') => {
    if (activeTab === 'question') setAdvImagePosition(pos);
    else setAdvAnswerImagePosition(pos);
  };

  return (
    <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-5 space-y-4 w-full mt-4 relative">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-sans">
          <HelpCircle className="w-4 h-4 text-emerald-400" /> Inquiry Questions Manager
        </h3>
        <div className="flex items-center gap-2">
          {/* Open full-page rich editor in new tab */}
          <button
            onClick={() => openInNewWindow()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-black tracking-wide uppercase transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-lg shadow-violet-900/30"
            title="Open full-page rich text question editor in a new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open Rich Editor
          </button>
          <button
            onClick={() => {
              const newIdx = questions.length;
              loadIntoAdvancedEditor(newIdx, 'question');
              setIsAdvancedEditorOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black tracking-wide uppercase transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-900/20"
          >
            <Plus className="w-4 h-4"/> Quick Editor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Add question form block */}
        <div className="md:col-span-5 bg-slate-950/50 border border-slate-850 p-4 rounded-xl space-y-3">
          <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#10b981] block font-extrabold">New Question Draft</span>

          <div className="space-y-2.5">
            {/* Question field */}
            <div>
              <label className="text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-1 block flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                Question
              </label>
              <textarea
                rows={3}
                value={newQText}
                onChange={e => setNewQText(e.target.value)}
                placeholder="Open-ended inquiry question text..."
                className="w-full bg-[#03060c] border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none transition-colors"
              />
            </div>

            {/* Answer field */}
            <div>
              <label className="text-[8px] font-mono uppercase tracking-widest text-slate-500 mb-1 block flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Answer <span className="text-slate-700 normal-case">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={newAText}
                onChange={e => setNewAText(e.target.value)}
                placeholder="Model answer for this question..."
                className="w-full bg-[#03060c] border border-slate-700 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors"
              />
            </div>

            <button
              onClick={handleAddQuestion}
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-550 text-white rounded text-xs font-bold uppercase transition-all duration-300 cursor-pointer"
            >
              {editingQIdx !== null ? 'Update Question' : 'Register Question'}
            </button>
            {editingQIdx !== null && (
              <button
                onClick={() => {
                  setEditingQIdx(null);
                  setNewQText('');
                  setNewAText('');
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
                            onQuestionsUpdate([...questions, ...parsed]);
                            alert(`Successfully bulk loaded ${parsed.length} questions!`);
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

                          const newQuestions: (string | InquiryQuestionObj)[] = rows.map((r, idx) => {
                            const qText = String(r.Question || r.question || '').trim();
                            const aText = String(r.Answer || r.answer || '').trim();
                            if (!qText) return null;

                            if (aText) {
                              return {
                                id: `up-iq-${Date.now()}-${idx}`,
                                text: qText,
                                answerText: aText,
                                imagePosition: 'right',
                                answerImagePosition: 'right'
                              } as InquiryQuestionObj;
                            }
                            return qText;
                          }).filter((q): q is NonNullable<typeof q> => q !== null);

                          if (newQuestions.length > 0) {
                            onQuestionsUpdate([...questions, ...newQuestions]);
                            alert(`Successfully bulk loaded ${newQuestions.length} questions from Excel!`);
                          } else {
                            alert("No valid questions found in Excel file. Make sure columns are named 'Question' and optional 'Answer'.");
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
                      { Question: "How does this relate to chapter 1?", Answer: "Your answer here..." },
                      { Question: "What are the real-world applications?", Answer: "" }
                    ]);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Inquiry Questions");
                    XLSX.writeFile(workbook, "inquiry_template.xlsx");
                  } catch (e) {
                    alert("Failed to generate Excel template");
                  }
                }}
                className="text-[9px] text-emerald-400 hover:text-emerald-300 uppercase font-mono tracking-wider cursor-pointer transition-colors bg-transparent border-none"
              >
                Download Template XLSX
              </button>
            </div>
          </div>
        </div>

        {/* Active Question Catalog list */}
        <div className="md:col-span-7 space-y-2.5">
          <span className="text-[9.5px] font-mono tracking-wider text-slate-500 uppercase block">Active Inquiry Questions ({questions.length})</span>
          <div className="bg-slate-950/20 rounded-xl border border-slate-850 divide-y divide-slate-850/50">
            {questions.length === 0 ? (
              <div className="p-4 text-center select-none text-[11px] text-slate-500 font-serif italic">
                No open-ended questions compiled yet. Use the draft panel to formulate questions.
              </div>
            ) : (
              questions.map((q, qIdx) => {
                const textPreview = typeof q === 'string' ? q : (q.text.replace(/<[^>]+>/g, '').substring(0, 100) + (q.text.length > 100 ? '...' : ''));
                const answered = hasAnswer(q);
                const answerPreview = getAnswerPreview(q);
                return (
                <div key={qIdx} className="p-3 text-xs flex gap-3 bg-slate-950/30">
                  <div className="space-y-1.5 w-full min-w-0">
                    {/* Question row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-emerald-400 block pr-2 break-words">
                          Q{qIdx + 1}. {textPreview}
                          {typeof q !== 'string' && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">Rich Text</span>}
                        </span>
                      </div>
                      {/* Question actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleEditQuestion(q, qIdx)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer bg-transparent border-none font-bold uppercase tracking-wider whitespace-nowrap"
                        >
                          Edit Q
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(qIdx)}
                          className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer bg-transparent border-none font-bold uppercase tracking-wider"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Answer row */}
                    <div className="flex items-center justify-between gap-2 pl-3 border-l-2 border-slate-800">
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        {answered ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            <span className="text-[10px] text-amber-300/80 truncate">
                              A: {answerPreview}
                            </span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3 h-3 text-slate-600 flex-shrink-0" />
                            <span className="text-[10px] text-slate-600 italic">No answer yet</span>
                          </>
                        )}
                      </div>
                      {/* Answer action — only for rich-text questions (InquiryQuestionObj) */}
                      {typeof q !== 'string' ? (
                        <button
                          onClick={() => handleEditAnswer(qIdx)}
                          className={`text-[10px] cursor-pointer bg-transparent border-none font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 ${answered ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}
                        >
                          {answered ? 'Edit A' : '+ Add A'}
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-700 italic whitespace-nowrap flex-shrink-0">Use Rich Editor</span>
                      )}
                    </div>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>
      </div>

      {/* ── ADVANCED EDITOR MODAL ── */}
      {isAdvancedEditorOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm">
          <div className="bg-[#0b0e1b] border border-slate-700 shadow-2xl rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden relative animate-in fade-in zoom-in duration-200">

            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-[#0a0d18]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                Advanced Editor — Q{advancedEditorIndex + 1}
              </h2>
              <button onClick={() => setIsAdvancedEditorOpen(false)} className="p-1 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Q / A Tab Bar */}
            <div className="flex border-b border-slate-800 bg-[#090c17]">
              <button
                onClick={() => handleTabSwitch('question')}
                className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  activeTab === 'question'
                    ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <QuestionIcon className="w-3.5 h-3.5" />
                Question
              </button>
              <button
                onClick={() => handleTabSwitch('answer')}
                className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  activeTab === 'answer'
                    ? 'border-amber-500 text-amber-300 bg-amber-600/10'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Answer
                {advAnswerTextDraft && advAnswerTextDraft.replace(/<[^>]+>/g, '').trim() && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                )}
              </button>
              <div className="flex-1" />
              <div className="flex items-center pr-4">
                <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                  {activeTab === 'question' ? 'Editing the open-ended question' : 'Editing the model answer'}
                </span>
              </div>
            </div>

            {/* Main Editor Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-[400px]">

                {/* TinyMCE Editor area — keyed on tab+index so it reinitialises on tab switch */}
                <div className="lg:col-span-3 flex flex-col h-full min-h-[400px]">
                  <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2 block">
                    {activeTab === 'question' ? 'Rich Text Question Content' : 'Rich Text Answer Content'}
                  </label>
                  <div className="flex-1 border border-slate-800 rounded-lg overflow-hidden bg-white">
                    <Editor
                      key={`${activeTab}-${advancedEditorIndex}`}
                      tinymceScriptSrc="/tinymce/tinymce.min.js"
                      onInit={(evt, editor) => editorRef.current = editor}
                      initialValue={currentEditorContent}
                      init={{
                        license_key: 'gpl',
                        height: '100%',
                        menubar: true,
                        plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table code help wordcount',
                        setup: (editor) => {
                          setupTinyMceMath(editor);
                          setupTinyMceAnnotation(editor);
                        },
                        toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | latex annotation | table | removeformat | help',
                        content_style: `body { font-family:Helvetica,Arial,sans-serif; font-size:16px; color: #333; line-height: 1.6; padding: 1rem; } ${tinymceMathContentStyle}`,
                        skin: 'oxide',
                        content_css: 'default'
                      }}
                    />
                  </div>
                </div>

                {/* Sidebar Controls */}
                <div className="lg:col-span-1 space-y-6 bg-slate-900/50 p-5 rounded-xl border border-slate-800">

                  {/* Image Uploader */}
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2 block">
                      {activeTab === 'question' ? 'Question Image' : 'Answer Image'}
                    </label>
                    {currentImageDraft ? (
                      <div className="relative group">
                        <img src={currentImageDraft} alt="Preview" className="w-full aspect-video object-cover rounded-lg border border-slate-700" />
                        <button
                          onClick={() => setCurrentImageDraft(null)}
                          className="absolute top-2 right-2 p-1.5 bg-black/80 text-white rounded-md hover:bg-rose-600 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10 rounded-xl cursor-pointer transition-all">
                        {isUploading
                          ? <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
                          : <ImageIcon className="w-8 h-8 text-slate-500" />
                        }
                        <span className="text-xs text-slate-400 font-medium">{isUploading ? 'Uploading...' : 'Upload Media'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                      </label>
                    )}
                  </div>

                  {/* Image Position Radio Buttons */}
                  <div className="space-y-3 pt-4 border-t border-slate-800/80">
                    <label className="text-xs font-mono uppercase tracking-widest text-slate-400 block mb-3">Image Display Position</label>
                    <div className="space-y-2">
                      {(['left', 'center', 'right'] as const).map((pos) => (
                        <label key={pos} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${currentImagePosition === pos ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'}`}>
                          <input
                            type="radio"
                            name={`imagePosition-${activeTab}`}
                            value={pos}
                            checked={currentImagePosition === pos}
                            onChange={() => setCurrentImagePosition(pos)}
                            className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900"
                          />
                          <span className="capitalize text-sm font-bold tracking-wide">{pos} Side</span>
                          <span className="text-[9px] uppercase tracking-wider opacity-70 ml-auto font-mono bg-black/40 px-2 py-0.5 rounded">
                            {pos === 'center' ? '80% Width' : '30% Width'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Footer Navigation & Actions */}
            <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-[#0a0d18]">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleSaveAdvanced();
                    if (advancedEditorIndex > 0) {
                      loadIntoAdvancedEditor(advancedEditorIndex - 1, activeTab);
                    }
                  }}
                  disabled={advancedEditorIndex === 0}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Prev Question
                </button>
                <button
                  onClick={() => {
                    handleSaveAdvanced();
                    if (advancedEditorIndex < questions.length - 1) {
                      loadIntoAdvancedEditor(advancedEditorIndex + 1, activeTab);
                    } else {
                      loadIntoAdvancedEditor(questions.length, activeTab);
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  Next Question <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsAdvancedEditorOpen(false)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-lg transition-colors cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={() => { handleSaveAdvanced(); setIsAdvancedEditorOpen(false); }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save & Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
