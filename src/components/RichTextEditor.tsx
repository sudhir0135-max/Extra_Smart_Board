import React, { useState, useRef, useEffect } from 'react';
import { Save, Eye, FileText } from 'lucide-react';
import { Editor } from '@tinymce/tinymce-react';
import { setupTinyMceMath, tinymceMathContentStyle } from '../lib/tinymceMathPlugin';
import { setupTinyMceAnnotation } from '../lib/tinymceAnnotationPlugin';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

export interface RichTextEditorProps {
  initialValue: string;
  onSave: (content: string) => void;
  isSaving?: boolean;
  leftImage?: string;
  centerImage?: string;
  rightImage?: string;
}

export default function RichTextEditor({ initialValue, onSave, isSaving = false, leftImage, centerImage, rightImage }: RichTextEditorProps) {
  const [activeSubTab, setActiveSubTab] = useState<'edit' | 'preview'>('edit');
  const editorRef = useRef<any>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewContent, setPreviewContent] = useState(initialValue);

  useEffect(() => {
    if (activeSubTab === 'preview' && previewContainerRef.current) {
      try {
        renderMathInElement(previewContainerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
        });
      } catch (err) {
        console.error("Failed to render math inside preview", err);
      }
    }
  }, [previewContent, activeSubTab]);

  const handleTabSwitch = (tab: 'edit' | 'preview') => {
    if (tab === 'preview' && editorRef.current) {
      setPreviewContent(editorRef.current.getContent());
    }
    setActiveSubTab(tab);
  };

  const handleSaveClick = () => {
    if (editorRef.current && activeSubTab === 'edit') {
      onSave(editorRef.current.getContent());
    } else {
      onSave(previewContent);
    }
  };

  return (
    <div className="border rounded-xl bg-[#080d19] overflow-hidden border-slate-800">
      {/* Tab Select & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 p-2 bg-[#0a1122]/90 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleTabSwitch('edit')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${activeSubTab === 'edit' ? 'bg-slate-900 border border-slate-800 text-amber-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-transparent'}`}
          >
            <FileText className="w-3.5 h-3.5" /> Editor View
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('preview')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${activeSubTab === 'preview' ? 'bg-slate-900 border border-slate-800 text-amber-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-transparent'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Live Render Preview
          </button>
        </div>

        {/* Action Button: Save page */}
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          className={`px-3 py-1.5 text-white rounded-md font-mono font-black text-[10.5px] flex items-center gap-1.5 shadow-sm transition-colors ${
            isSaving 
              ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed' 
              : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-emerald-950/40'
          }`}
        >
          <Save className="w-3.5 h-3.5 text-emerald-100" /> {isSaving ? 'Saving...' : 'Save Page Changes'}
        </button>
      </div>

      {activeSubTab === 'edit' ? (
        <div className="flex flex-col min-h-[300px] bg-[#1a1f2e]">
          <Editor
            onInit={(_evt, editor) => {
              editorRef.current = editor;
              setupTinyMceMath(editor);
              setupTinyMceAnnotation(editor);
            }}
            tinymceScriptSrc="/tinymce/tinymce.min.js"
            initialValue={initialValue}
            init={{
              license_key: 'gpl',
              height: 450,
              menubar: true,
              skin: 'oxide-dark',
              content_css: 'dark',
              plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table code help wordcount',
              toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | blockquote | latex annotation | table link image | removeformat | help',
              content_style: `body { font-family:Helvetica,Arial,sans-serif; font-size:14px; background-color: #03060c; color: #e2e8f0; } blockquote { border-left: 3px solid #f59e0b; padding-left: 14px; color: #94a3b8; font-style: italic; margin: 12px 0; } ${tinymceMathContentStyle}`
            }}
          />
        </div>
      ) : (
        <div className="p-4 bg-[#03050a] min-h-[220px] overflow-y-auto max-h-[380px]">
          <div className="flex flex-col lg:flex-row gap-4 items-start w-full px-[5%]">
            {leftImage && (
              <div className="w-full lg:w-[30%] flex-shrink-0">
                <img 
                  src={leftImage} 
                  alt="Left Column" 
                  className="w-full h-auto rounded-lg border border-slate-800 object-contain max-h-48 shadow-md" 
                  referrerPolicy="no-referrer"
                />
                <span className="text-[8px] font-mono text-slate-500 mt-1 block text-center uppercase">Left Component Image</span>
              </div>
            )}
            
            <div className="flex-1 lg:w-[70%] min-w-0">
              {centerImage && (
                <div className="w-full mb-4 flex-shrink-0">
                  <img 
                    src={centerImage} 
                    alt="Center Column" 
                    className="w-full h-auto rounded-lg border border-slate-800 shadow-md" 
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[8px] font-mono text-slate-500 mt-1 block text-center uppercase">Center Component Image</span>
                </div>
              )}
              {previewContent.trim() ? (
                <div 
                  ref={previewContainerRef}
                  className="reader-content prose prose-invert prose-sm font-sans text-slate-200 leading-relaxed space-y-3"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              ) : (
                <span className="text-slate-600 font-mono text-xs italic">Nothing written yet. Add some HTML/paragraphs or upload an image to visualize dynamic preview rendering.</span>
              )}
            </div>

            {rightImage && (
              <div className="w-full lg:w-[30%] flex-shrink-0">
                <img 
                  src={rightImage} 
                  alt="Right Column" 
                  className="w-full h-auto rounded-lg border border-slate-800 object-contain max-h-48 shadow-md" 
                  referrerPolicy="no-referrer"
                />
                <span className="text-[8px] font-mono text-slate-500 mt-1 block text-center uppercase">Right Component Image</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
