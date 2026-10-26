import React, { useState, useRef, useEffect } from 'react';
import { Save, Eye, FileText } from 'lucide-react';
import { Editor } from '@tinymce/tinymce-react';
import { setupTinyMceMath, tinymceMathContentStyle } from '../lib/tinymceMathPlugin';
import { setupTinyMceAnnotation, tinymceAnnotationContentStyle } from '../lib/tinymceAnnotationPlugin';
import { renderMathInRawHtml } from '../lib/mathPreprocessor';
import ImageFrame from './ImageFrame';
import 'katex/dist/katex.min.css';

export interface RichTextEditorProps {
  initialValue?: string;
  value?: string;
  onSave: (content: string) => void;
  onChange?: (content: string) => void;
  isSaving?: boolean;
  leftImage?: string;
  centerImage?: string;
  rightImage?: string;
  interactiveMaps?: {id: string, title: string, rootImage?: string, hotspots?: any[]}[];
}

export default function RichTextEditor({ initialValue = '', value = '', onSave, onChange, isSaving = false, leftImage, centerImage, rightImage, interactiveMaps = [] }: RichTextEditorProps) {
  const [activeSubTab, setActiveSubTab] = useState<'edit' | 'preview'>('edit');
  const editorRef = useRef<any>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  // Captured ONCE when the editor mounts. TinyMCE resets its content (and moves the caret to the start)
  // whenever its `initialValue` prop changes, so this must not follow the parent's live draft that
  // `onChange` updates on every keystroke, or typed text comes out reversed (right-to-left).
  // The parent remounts this component (via `key`) when a different page is selected.
  const [startingContent, setStartingContent] = useState(() => initialValue || value || '');
  const [previewContent, setPreviewContent] = useState(startingContent);

  // Modal states for live preview tag clicking
  const [imageFrameSrc, setImageFrameSrc] = useState<string | null>(null);
  const [imageFrameDef, setImageFrameDef] = useState<any>(undefined);
  const [activeAnnotation, setActiveAnnotation] = useState<{
    text: string;
    mediaType: string;
    mediaUrl: string;
    rect: DOMRect;
    fontSize: string;
  } | null>(null);
  const annotationBubbleRef = useRef<HTMLDivElement>(null);

  // Use a ref to always provide the latest interactiveMaps to TinyMCE's dialog without needing to re-init
  const interactiveMapsRef = useRef(interactiveMaps);
  useEffect(() => {
    interactiveMapsRef.current = interactiveMaps;
  }, [interactiveMaps]);

  const handleTabSwitch = (tab: 'edit' | 'preview') => {
    if (tab === 'preview' && editorRef.current) {
      setPreviewContent(editorRef.current.getContent());
    }
    if (tab === 'edit' && activeSubTab !== 'edit') {
      // The editor remounts when returning from Preview: start it from the latest text
      setStartingContent(previewContent);
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

  const handlePreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const annotationSpan = target.closest('.lesson-annotation');
    if (annotationSpan) {
      const text = decodeURIComponent(annotationSpan.getAttribute('data-annotation-text') || '');
      const mediaType = annotationSpan.getAttribute('data-annotation-media-type') || 'none';
      let mediaUrl = annotationSpan.getAttribute('data-annotation-media-url') || '';

      if (mediaType === 'interactive-image' && mediaUrl) {
        const mapDef = interactiveMaps.find(m => m.id === mediaUrl);
        if (mapDef) {
          setImageFrameSrc(mapDef.rootImage || mediaUrl);
          setImageFrameDef(mapDef);
          setActiveAnnotation(null);
          return;
        }
      }

      if (mediaUrl || mediaType === 'image-frame' || mediaType === 'image') {
        setImageFrameSrc(mediaUrl);
        setImageFrameDef(undefined);
        setActiveAnnotation(null);
      } else {
        const rect = annotationSpan.getBoundingClientRect();
        const fontSize = window.getComputedStyle(annotationSpan).fontSize || '16px';
        setActiveAnnotation({ text, mediaType, mediaUrl, rect, fontSize });
      }
    } else {
      setActiveAnnotation(null);
    }
  };

  return (
    <div className="border rounded-xl bg-[#080d19] overflow-hidden border-slate-800 relative">
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
            licenseKey="gpl"
            onInit={(_evt, editor) => {
              editorRef.current = editor;
              setupTinyMceMath(editor);
              setupTinyMceAnnotation(editor, () => interactiveMapsRef.current);
            }}
            tinymceScriptSrc="/tinymce/tinymce.min.js"
            initialValue={startingContent}
            onEditorChange={(newContent) => {
              setPreviewContent(newContent);
              onChange?.(newContent);
            }}
            init={{
              height: 450,
              menubar: true,
              directionality: 'ltr',
              skin: 'oxide-dark',
              content_css: 'dark',
              plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table code help wordcount',
              toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | blockquote | latex annotation | media table link image | removeformat | help',
              extended_valid_elements: 'iframe[src|width|height|name|align|allow|allowfullscreen|frameborder|style]',
              content_style: `body { font-family:Helvetica,Arial,sans-serif; font-size:14px; background-color: #03060c; color: #e2e8f0; } blockquote { border-left: 3px solid #f59e0b; padding-left: 14px; color: #94a3b8; font-style: italic; margin: 12px 0; } iframe { border: 1px solid #334155; border-radius: 8px; max-width: 100%; } ${tinymceMathContentStyle} ${tinymceAnnotationContentStyle}`
            }}
          />
        </div>
      ) : (
        <div className="p-4 bg-[#03050a] min-h-[220px] overflow-y-auto max-h-[480px]">
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
                  onClick={handlePreviewClick}
                  className="reader-content prose prose-invert prose-sm font-sans text-slate-200 leading-relaxed space-y-3 cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(previewContent) }}
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

      {/* Popover / Speech Bubble for text annotations in preview */}
      {activeAnnotation && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs cursor-pointer" onClick={() => setActiveAnnotation(null)} />
          <div 
            ref={annotationBubbleRef}
            className="fixed z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-5 transition-opacity duration-200 max-w-[500px]"
            style={{
              top: Math.max(10, activeAnnotation.rect.bottom + 10),
              left: Math.max(10, Math.min(window.innerWidth - 420, activeAnnotation.rect.left))
            }}
          >
            {activeAnnotation.mediaUrl && (
              <div 
                className="mb-3 max-h-48 rounded-lg overflow-hidden border border-slate-700 bg-black/60 flex items-center justify-center cursor-pointer group"
                onClick={() => {
                  setImageFrameSrc(activeAnnotation.mediaUrl);
                  setActiveAnnotation(null);
                }}
                title="Click to view full size"
              >
                <img src={activeAnnotation.mediaUrl} alt="Annotation media" className="max-h-48 w-auto object-contain group-hover:scale-105 transition-transform" />
              </div>
            )}
            <div 
              className="text-slate-200 font-serif leading-loose"
              style={{ fontSize: activeAnnotation.fontSize }}
              dangerouslySetInnerHTML={{ __html: renderMathInRawHtml(activeAnnotation.text) }}
            />
          </div>
        </>
      )}

      {/* Fullscreen Image Frame Modal for Attached Images */}
      <ImageFrame 
        isOpen={!!imageFrameSrc}
        onClose={() => {
          setImageFrameSrc(null);
          setImageFrameDef(undefined);
        }}
        src={imageFrameSrc || ''}
        alt="Annotation Media"
        interactiveDef={imageFrameDef}
      />
    </div>
  );
}
