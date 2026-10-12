import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle, Upload, X, Save, ArrowLeft, ArrowRight,
  Image as ImageIcon, Plus, Trash2, ExternalLink,
  MessageSquare, HelpCircle as QuestionIcon, CheckCircle2,
  FileSpreadsheet, CheckSquare, Square
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InquiryQuestionObj } from '../types';
import { Editor } from '@tinymce/tinymce-react';
import { uploadImageToStorage } from '../lib/firebaseHelper';
import { setupTinyMceMath, tinymceMathContentStyle } from '../lib/tinymceMathPlugin';
import { setupTinyMceAnnotation, tinymceAnnotationContentStyle } from '../lib/tinymceAnnotationPlugin';

export interface InquiryQuestionManagerProps {
  questions: (string | InquiryQuestionObj)[];
  onQuestionsUpdate: (newQuestions: (string | InquiryQuestionObj)[]) => void;
  activeTopicTitle?: string;
  availableTopics?: string[];
}

type EditorTab = 'question' | 'answer';

export default function InquiryQuestionManager({
  questions,
  onQuestionsUpdate,
  activeTopicTitle,
  availableTopics = [],
}: InquiryQuestionManagerProps) {
  const [newQText, setNewQText] = useState('');
  const [newAText, setNewAText] = useState('');
  const [newMarks, setNewMarks] = useState<number | ''>('');
  const [newTopicTitle, setNewTopicTitle] = useState(activeTopicTitle || '');
  const [editingQIdx, setEditingQIdx] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [filterTopic, setFilterTopic] = useState<'all' | 'active'>('all');

  // Pre-fill topic field when activeTopicTitle changes and not editing
  useEffect(() => {
    if (activeTopicTitle && editingQIdx === null) {
      setNewTopicTitle(activeTopicTitle);
    }
  }, [activeTopicTitle, editingQIdx]);

  // Keep selected indices bounded if questions array changes
  useEffect(() => {
    setSelectedIndices(prev => prev.filter(i => i < questions.length));
  }, [questions.length]);

  const activeTopicQuestionsCount = React.useMemo(() => {
    if (!activeTopicTitle) return 0;
    const activeLower = activeTopicTitle.trim().toLowerCase();
    return questions.filter(q => {
      if (typeof q === 'string') return false;
      return (q.topicTitle || '').trim().toLowerCase() === activeLower;
    }).length;
  }, [questions, activeTopicTitle]);

  const displayedQuestions = React.useMemo(() => {
    if (!activeTopicTitle || filterTopic === 'all') {
      return questions.map((q, origIdx) => ({ q, origIdx }));
    }
    const activeLower = activeTopicTitle.trim().toLowerCase();
    return questions
      .map((q, origIdx) => ({ q, origIdx }))
      .filter(({ q }) => {
        if (typeof q === 'string') return false;
        return (q.topicTitle || '').trim().toLowerCase() === activeLower;
      });
  }, [questions, activeTopicTitle, filterTopic]);

  const toggleSelectQuestion = (idx: number) => {
    setSelectedIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSelectAll = () => {
    const displayedOrigIndices = displayedQuestions.map(d => d.origIdx);
    const allDisplayedSelected = displayedOrigIndices.length > 0 && displayedOrigIndices.every(i => selectedIndices.includes(i));
    if (allDisplayedSelected) {
      setSelectedIndices(prev => prev.filter(i => !displayedOrigIndices.includes(i)));
    } else {
      setSelectedIndices(prev => Array.from(new Set([...prev, ...displayedOrigIndices])));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIndices.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIndices.length} selected inquiry question${selectedIndices.length > 1 ? 's' : ''}?`)) {
      return;
    }
    const toDelete = new Set(selectedIndices);
    const updated = questions.filter((_, idx) => !toDelete.has(idx));
    setSelectedIndices([]);
    onQuestionsUpdate(updated);
  };

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

  // Topic & Marks drafts for Advanced Editor
  const [advMarksDraft, setAdvMarksDraft] = useState<number | ''>('');
  const [advTopicTitleDraft, setAdvTopicTitleDraft] = useState('');

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
      localStorage.setItem(`qeditor_topics_${sessionKey}`, JSON.stringify(availableTopics));
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
      setAdvMarksDraft('');
      setAdvTopicTitleDraft('');
    } else if (q) {
      setAdvTextDraft(q.text || '');
      setAdvImageDraft(q.image || null);
      setAdvImagePosition(q.imagePosition || 'right');
      setAdvAnswerTextDraft(q.answerText || '');
      setAdvAnswerImageDraft(q.answerImage || null);
      setAdvAnswerImagePosition(q.answerImagePosition || 'right');
      setAdvMarksDraft(q.marks !== undefined && q.marks !== null ? q.marks : '');
      setAdvTopicTitleDraft(q.topicTitle || '');
    } else {
      setAdvTextDraft('');
      setAdvImageDraft(null);
      setAdvImagePosition('right');
      setAdvAnswerTextDraft('');
      setAdvAnswerImageDraft(null);
      setAdvAnswerImagePosition('right');
      setAdvMarksDraft('');
      setAdvTopicTitleDraft('');
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

    const parsedMarks = advMarksDraft !== '' && !isNaN(Number(advMarksDraft)) ? Number(advMarksDraft) : null;
    const parsedTopic = advTopicTitleDraft.trim() || null;

    const updatedQ: InquiryQuestionObj = {
      id: existingId,
      text: questionText,
      image: advImageDraft,
      imagePosition: advImagePosition,
      answerText: answerText || null,
      answerImage: advAnswerImageDraft,
      answerImagePosition: advAnswerImagePosition,
      marks: parsedMarks,
      topicTitle: parsedTopic,
      ...(typeof currentQ !== 'string' ? { displayMode: currentQ.displayMode, tabs: currentQ.tabs } : {}),
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

    const parsedMarks = newMarks !== '' && !isNaN(Number(newMarks)) ? Number(newMarks) : null;
    const parsedTopic = newTopicTitle.trim() || null;

    if (editingQIdx !== null) {
      const updated = [...questions];
      const existing = updated[editingQIdx];
      if (typeof existing === 'string') {
        // Upgrade plain string to full object so answer is supported
        updated[editingQIdx] = {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          text: newQText.trim(),
          answerText: newAText.trim() || null,
          marks: parsedMarks,
          topicTitle: parsedTopic,
        };
      } else {
        updated[editingQIdx] = {
          ...existing,
          text: newQText.trim(),
          answerText: newAText.trim() || existing.answerText || null,
          marks: parsedMarks,
          topicTitle: parsedTopic,
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
        marks: parsedMarks,
        topicTitle: parsedTopic,
      };
      onQuestionsUpdate([...questions, newQ]);
    }

    setNewQText('');
    setNewAText('');
    setNewMarks('');
    setNewTopicTitle(activeTopicTitle || '');
  };

  const handleEditQuestion = (q: string | InquiryQuestionObj, idx: number) => {
    if (typeof q === 'string') {
      setEditingQIdx(idx);
      setNewQText(q);
      setNewAText('');
      setNewMarks('');
      setNewTopicTitle('');
    } else {
      // For simple (non-rich) InquiryQuestionObj, edit inline in the draft panel
      const hasRichText = q.text && (q.text.includes('<') || q.answerText?.includes('<'));
      if (!hasRichText) {
        setEditingQIdx(idx);
        setNewQText(q.text.replace(/<[^>]+>/g, ''));
        setNewAText((q.answerText || '').replace(/<[^>]+>/g, ''));
        setNewMarks(q.marks !== undefined && q.marks !== null ? q.marks : '');
        setNewTopicTitle(q.topicTitle || '');
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
    setSelectedIndices(prev => prev.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i)));
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
    return !!(q.answerText?.trim() || q.answerImage);
  };

  const handleToggleDisplayMode = (qIdx: number) => {
    const updated = [...questions];
    const item = updated[qIdx];
    if (typeof item === 'string') {
      updated[qIdx] = {
        id: `iq-${Date.now()}-${qIdx}`,
        text: item,
        displayMode: 'accountancy_tabs',
      };
    } else {
      updated[qIdx] = {
        ...item,
        displayMode: item.displayMode === 'accountancy_tabs' ? 'standard' : 'accountancy_tabs',
      };
    }
    onQuestionsUpdate(updated);
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

  const handleDownloadTemplate = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet([
        { Question: "How does this relate to chapter 1?", Answer: "Your answer here...", Topic: "Introduction", Marks: 5 },
        { Question: "What are the real-world applications?", Answer: "Model answer...", Topic: "Real-world Applications", Marks: 3 }
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inquiry Questions");
      XLSX.writeFile(workbook, "inquiry_template.xlsx");
    } catch (e) {
      alert("Failed to generate Excel template");
    }
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
            const topicTitleStr = String(r.Topic || r.topic || r['Topic Title'] || r.topicTitle || '').trim();
            const rawMarks = r.Marks !== undefined ? r.Marks : (r.marks !== undefined ? r.marks : (r.Mark !== undefined ? r.Mark : r.mark));
            const parsedMarks = rawMarks !== undefined && rawMarks !== null && rawMarks !== '' && !isNaN(Number(rawMarks)) ? Number(rawMarks) : null;

            if (!qText) return null;

            return {
              id: `up-iq-${Date.now()}-${idx}`,
              text: qText,
              answerText: aText || null,
              marks: parsedMarks,
              topicTitle: topicTitleStr || null,
              imagePosition: 'right',
              answerImagePosition: 'right'
            } as InquiryQuestionObj;
          }).filter((q): q is NonNullable<typeof q> => q !== null);

          if (newQuestions.length > 0) {
            onQuestionsUpdate([...questions, ...newQuestions]);
            alert(`Successfully bulk loaded ${newQuestions.length} questions from Excel!`);
          } else {
            alert("No valid questions found in Excel file. Make sure columns are named 'Question' and optional 'Answer', 'Topic', 'Marks'.");
          }
        } catch (err) {
          alert("Failed to parse XLSX file");
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  return (
    <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-5 space-y-5 w-full mt-4 relative">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {/* 1. New Question Draft Container (Full Width) */}
      <div className="w-full bg-slate-950/60 border border-slate-850 p-4.5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#10b981] font-extrabold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            {editingQIdx !== null ? `Editing Question #${editingQIdx + 1}` : 'New Question Draft'}
          </span>
          {editingQIdx !== null && (
            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full font-bold">
              Edit Mode
            </span>
          )}
        </div>

        {/* Row 1: Question and Answer input text areas in first row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Question Textarea */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
              Question Text <span className="text-rose-400 font-sans">*</span>
            </label>
            <textarea
              rows={3}
              value={newQText}
              onChange={e => setNewQText(e.target.value)}
              placeholder="Enter open-ended inquiry question text..."
              className="w-full bg-[#03060c] border border-slate-700/80 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none transition-colors leading-relaxed"
            />
          </div>

          {/* Answer Textarea */}
          <div className="space-y-1.5">
            <label className="text-[9.5px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Answer / Model Solution <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={newAText}
              onChange={e => setNewAText(e.target.value)}
              placeholder="Enter model answer or solution..."
              className="w-full bg-[#03060c] border border-slate-700/80 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none transition-colors leading-relaxed"
            />
          </div>
        </div>

        {/* Row 2: Topic, Marks, Register Question Button, Bulk Upload Button, Template Download */}
        <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 pt-1">
          {/* Topic Field */}
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
              Topic of Lesson <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <select
              value={newTopicTitle}
              onChange={e => setNewTopicTitle(e.target.value)}
              className="w-full bg-[#03060c] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors h-[38px] font-sans"
            >
              <option value="">-- No Topic / Chapter Level --</option>
              {availableTopics.map((top, idx) => (
                <option key={idx} value={top}>
                  {top}
                </option>
              ))}
              {newTopicTitle && !availableTopics.includes(newTopicTitle) && (
                <option value={newTopicTitle}>
                  {newTopicTitle} (Current)
                </option>
              )}
            </select>
          </div>

          {/* Marks Field */}
          <div className="w-full md:w-32 space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Marks <span className="text-slate-600 normal-case font-normal">(opt)</span>
            </label>
            <input
              type="number"
              value={newMarks}
              onChange={e => setNewMarks(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 5"
              className="w-full bg-[#03060c] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono h-[38px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAddQuestion}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-550 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer h-[38px] flex items-center gap-1.5 shadow-sm shadow-emerald-900/30 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> {editingQIdx !== null ? 'Update Question' : 'Register Question'}
            </button>

            {editingQIdx !== null && (
              <button
                onClick={() => {
                  setEditingQIdx(null);
                  setNewQText('');
                  setNewAText('');
                  setNewMarks('');
                  setNewTopicTitle(activeTopicTitle || '');
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer h-[38px] whitespace-nowrap"
              >
                Cancel
              </button>
            )}

            {/* Bulk Upload Button */}
            <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer border border-slate-700 h-[38px] flex items-center gap-1.5 whitespace-nowrap shadow-sm">
              <Upload className="w-3.5 h-3.5 text-indigo-400" /> Bulk Upload JSON/XLSX
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
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer border border-slate-800 h-[38px] flex items-center gap-1.5 whitespace-nowrap"
              title="Download Excel Template"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Template
            </button>
          </div>
        </div>
      </div>

      {/* 2. Active Inquiry Questions Container (Full Width, Beneath New Question Draft) */}
      <div className="w-full space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-2.5 px-3.5 rounded-lg border border-slate-850">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
              Active Inquiry Questions ({questions.length})
            </span>

            {/* Topic Filter Pills */}
            {activeTopicTitle && (
              <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterTopic('all')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    filterTopic === 'all'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  All Chapter Questions ({questions.length})
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
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-black/40 font-mono">
                    {activeTopicQuestionsCount}
                  </span>
                </button>
              </div>
            )}

            {displayedQuestions.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={displayedQuestions.length > 0 && displayedQuestions.every(d => selectedIndices.includes(d.origIdx))}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500"
                />
                <span className="text-[10px] font-mono uppercase text-slate-500">
                  {displayedQuestions.length > 0 && displayedQuestions.every(d => selectedIndices.includes(d.origIdx)) ? 'Deselect All' : 'Select All'}
                </span>
              </label>
            )}
          </div>

          {/* Bulk Selection Actions */}
          {selectedIndices.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                {selectedIndices.length} Selected
              </span>
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm shadow-rose-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIndices.length})
              </button>
              <button
                onClick={() => setSelectedIndices([])}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer bg-transparent border-none"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-950/20 rounded-xl border border-slate-850 divide-y divide-slate-850/50">
          {displayedQuestions.length === 0 ? (
            <div className="p-6 text-center select-none text-xs text-slate-500 font-serif italic space-y-2">
              {questions.length === 0 ? (
                <div>No open-ended questions compiled yet for this chapter. Use the draft panel above to formulate questions or use bulk upload.</div>
              ) : (
                <div className="space-y-2">
                  <p>No inquiry questions tagged with topic "{activeTopicTitle}" yet ({questions.length} total questions exist in this chapter).</p>
                  <button
                    type="button"
                    onClick={() => setFilterTopic('all')}
                    className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer font-sans not-italic"
                  >
                    View All Chapter Questions ({questions.length})
                  </button>
                </div>
              )}
            </div>
          ) : (
            displayedQuestions.map(({ q, origIdx }) => {
              const textPreview = typeof q === 'string' ? q : (q.text.replace(/<[^>]+>/g, '').substring(0, 140) + (q.text.length > 140 ? '...' : ''));
              const answered = hasAnswer(q);
              const answerPreview = getAnswerPreview(q);
              const isSelected = selectedIndices.includes(origIdx);

              return (
                <div
                  key={origIdx}
                  className={`p-3 text-xs flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-rose-950/20 border-l-4 border-l-rose-500' : 'bg-slate-950/30 hover:bg-slate-900/40'
                  }`}
                >
                  {/* Select Checkbox */}
                  <div className="pt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectQuestion(origIdx)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500"
                      title={`Select Question Q${origIdx + 1}`}
                    />
                  </div>

                  <div className="space-y-1.5 w-full min-w-0">
                    {/* Question Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {typeof q !== 'string' && q.topicTitle && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono uppercase">
                              Topic: {q.topicTitle}
                            </span>
                          )}
                          {typeof q !== 'string' && q.marks !== undefined && q.marks !== null && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                              {q.marks} Marks
                            </span>
                          )}
                          {typeof q !== 'string' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                              Rich Text
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-emerald-400 block pr-2 break-words text-xs leading-relaxed">
                          Q{origIdx + 1}. {textPreview}
                        </span>
                      </div>

                      {/* Question Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleToggleDisplayMode(origIdx)}
                          className={`px-2 py-0.5 rounded text-[9.5px] font-bold font-mono transition-all cursor-pointer border ${
                            typeof q !== 'string' && q.displayMode === 'accountancy_tabs'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                          title="Toggle Question Display Manner (Standard List vs Accountancy Multi-Tab)"
                        >
                          {typeof q !== 'string' && q.displayMode === 'accountancy_tabs' ? '📊 Accountancy Mode' : '📄 Standard Mode'}
                        </button>

                        <button
                          onClick={() => handleEditQuestion(q, origIdx)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 cursor-pointer bg-transparent border-none font-bold uppercase tracking-wider whitespace-nowrap"
                        >
                          Edit Q
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(origIdx)}
                          className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer bg-transparent border-none font-bold uppercase tracking-wider"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Answer Row */}
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
                          onClick={() => handleEditAnswer(origIdx)}
                          className={`text-[10px] cursor-pointer bg-transparent border-none font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 ${
                            answered ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'
                          }`}
                        >
                          {answered ? 'Edit A' : '+ Add A'}
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-700 italic whitespace-nowrap flex-shrink-0">Use Rich Editor</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
                  <div className="flex-1 border border-slate-800 rounded-lg overflow-hidden bg-[#181e2a]">
                    <Editor
                      key={`${activeTab}-${advancedEditorIndex}`}
                      licenseKey="gpl"
                      tinymceScriptSrc="/tinymce/tinymce.min.js"
                      onInit={(evt, editor) => editorRef.current = editor}
                      initialValue={currentEditorContent}
                      init={{
                        height: '100%',
                        menubar: true,
                        skin: 'oxide-dark',
                        content_css: 'dark',
                        plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table code help wordcount',
                        setup: (editor) => {
                          setupTinyMceMath(editor);
                          setupTinyMceAnnotation(editor);
                        },
                        toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | blockquote | latex annotation | table | removeformat | help',
                        content_style: `body { font-family: "Cormorant Garamond", Georgia, serif; font-size: 21px; color: #e8f0fe; background-color: #181e2a; line-height: 1.625; padding: 1.25rem; } blockquote { border-left: 3px solid #f59e0b; padding-left: 14px; color: #cbd5e1; font-style: italic; margin: 12px 0; } table { border-collapse: collapse; width: 100%; margin: 1rem 0; border: 1px solid #334155; } table td, table th { border: 1px solid #334155; padding: 8px 12px; } table th { background: rgba(30, 41, 59, 0.8); font-weight: bold; color: #f8fafc; } img { max-width: 100%; height: auto; border-radius: 8px; } ${tinymceMathContentStyle} ${tinymceAnnotationContentStyle}`
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

                  {/* Topic & Marks Metadata Fields */}
                  <div className="space-y-3 pt-4 border-t border-slate-800/80">
                    <label className="text-xs font-mono uppercase tracking-widest text-slate-400 block mb-1">Metadata (Topic & Marks)</label>
                    <div>
                      <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                        Topic of Lesson
                      </label>
                      <select
                        value={advTopicTitleDraft}
                        onChange={e => setAdvTopicTitleDraft(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-sans"
                      >
                        <option value="">-- No Topic / Chapter Level --</option>
                        {availableTopics.map((top, idx) => (
                          <option key={idx} value={top}>
                            {top}
                          </option>
                        ))}
                        {advTopicTitleDraft && !availableTopics.includes(advTopicTitleDraft) && (
                          <option value={advTopicTitleDraft}>
                            {advTopicTitleDraft} (Current)
                          </option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Marks (Numeric)</label>
                      <input
                        type="number"
                        value={advMarksDraft}
                        onChange={e => setAdvMarksDraft(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 1, 2, 5, 10"
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                      />
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
