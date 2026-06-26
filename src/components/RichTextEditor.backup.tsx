import React, { useState } from 'react';
import {
  Save,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  Quote,
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  FileText
} from 'lucide-react';

export interface RichTextEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  onSave: () => void;
  leftImage?: string;
  rightImage?: string;
}

export default function RichTextEditor({ value, onChange, onSave, leftImage, rightImage }: RichTextEditorProps) {
  const [activeSubTab, setActiveSubTab] = useState<'edit' | 'preview'>('edit');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (tagOpen: string, tagClose: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    const selectedText = text.substring(start, end);

    let replacement = '';
    if (selectedText) {
      replacement = `${tagOpen}${selectedText}${tagClose}`;
    } else {
      const placeholder = tagOpen === '<p>' ? 'paragraph text' 
                        : tagOpen === '<b>' ? 'bold text' 
                        : tagOpen === '<i>' ? 'italic text' 
                        : tagOpen === '<u>' ? 'underlined text' 
                        : tagOpen === '<ul><li>' ? 'list item'
                        : tagOpen === '<li>' ? 'bullet item'
                        : tagOpen === '<sub>' ? 'subscript'
                        : tagOpen === '<sup>' ? 'superscript'
                        : tagOpen.startsWith('<a') ? 'link text'
                        : tagOpen === '<blockquote>' ? 'quote text'
                        : tagOpen === '<h3>' ? 'Heading'
                        : '';
      replacement = `${tagOpen}${placeholder}${tagClose}`;
    }

    const newValue = text.substring(0, start) + replacement + text.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + tagOpen.length + (selectedText ? selectedText.length : 0);
      textarea.setSelectionRange(newCursor, newCursor);
    }, 15);
  };

  const handleLinkInsertion = () => {
    const url = prompt('Enter the link URL (e.g. https://google.com):', 'https://');
    if (url) {
      insertAtCursor(`<a href="${url}" class="text-amber-400 underline hover:text-amber-300" target="_blank" rel="noopener noreferrer">`, '</a>');
    }
  };

  return (
    <div className="border rounded-xl bg-[#080d19] overflow-hidden border-slate-800">
      {/* Tab Select & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 p-2 bg-[#0a1122]/90 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('edit')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${activeSubTab === 'edit' ? 'bg-slate-900 border border-slate-800 text-amber-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-transparent'}`}
          >
            <FileText className="w-3.5 h-3.5" /> Editor View
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('preview')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${activeSubTab === 'preview' ? 'bg-slate-900 border border-slate-800 text-amber-400' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-transparent'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Live Render Preview
          </button>
        </div>

        {/* Action Button: Save page */}
        <button
          type="button"
          onClick={onSave}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-mono font-black text-[10.5px] flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-950/40 transition-colors"
        >
          <Save className="w-3.5 h-3.5 text-emerald-100" /> Save Page Changes
        </button>
      </div>

      {activeSubTab === 'edit' ? (
        <div className="flex flex-col">
          {/* Rich text helper buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#050a14] border-b border-slate-900">
            <button
              type="button"
              onClick={() => insertAtCursor('<b>', '</b>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 font-bold text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Bold Text (<b>)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('<i>', '</i>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 italic text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Italic Text (<i>)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('<u>', '</u>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 underline text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Underline Text (<u>)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('<h3>', '</h3>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 text-xs font-mono font-black transition-colors border border-slate-850 cursor-pointer"
              title="Heading 3 (<h3>)"
            >
              H3
            </button>
            
            <div className="h-4 w-[1px] bg-slate-800 mx-1" />

            <button
              type="button"
              onClick={() => insertAtCursor('<div style="text-align: left;">', '</div>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 font-bold text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('<div style="text-align: center;">', '</div>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 font-bold text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('<div style="text-align: right;">', '</div>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 font-bold text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor('<div style="text-align: justify;">', '</div>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 font-bold text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Align Justify"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-[1px] bg-slate-800 mx-1" />

            <select
              onChange={(e) => {
                if (e.target.value) {
                  insertAtCursor(`<span style="font-size: ${e.target.value};">`, '</span>');
                  e.target.value = '';
                }
              }}
              className="bg-slate-900/60 text-slate-300 text-[10.5px] font-mono border border-slate-850 rounded p-1 cursor-pointer focus:outline-none"
              title="Font Size"
            >
              <option value="">Size</option>
              <option value="12px">Small</option>
              <option value="16px">Normal</option>
              <option value="20px">Large</option>
              <option value="28px">Huge</option>
            </select>

            <div className="h-4 w-[1px] bg-slate-800 mx-1" />

            {/* Custom Bullets & List tags */}
            <button
              type="button"
              onClick={() => insertAtCursor('<li>', '</li>')}
              className="p-1 px-2 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Bullet Point (<li>)"
            >
              <List className="w-3.5 h-3.5" /> • Bullet
            </button>

            {/* Subscript Option */}
            <button
              type="button"
              onClick={() => insertAtCursor('<sub>', '</sub>')}
              className="p-1 px-2 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 text-xs font-mono font-bold transition-colors border border-slate-850 cursor-pointer flex items-center gap-0.5"
              title="Subscript (<sub>)"
            >
              X<sub>2</sub>
            </button>

            {/* Superscript Option */}
            <button
              type="button"
              onClick={() => insertAtCursor('<sup>', '</sup>')}
              className="p-1 px-2 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 text-xs font-mono font-bold transition-colors border border-slate-850 cursor-pointer flex items-center gap-0.5"
              title="Superscript (<sup>)"
            >
              X<sup>2</sup>
            </button>

            <div className="h-4 w-[1px] bg-slate-800 mx-1" />

            <button
              type="button"
              onClick={() => insertAtCursor('<blockquote>', '</blockquote>')}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Indented Blockquote (<blockquote>)"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleLinkInsertion}
              className="p-1 px-2.5 bg-slate-900/60 hover:bg-slate-850 hover:text-amber-400 rounded text-slate-300 text-xs font-mono transition-colors border border-slate-850 cursor-pointer flex items-center gap-1"
              title="Hyperlink (<a>)"
            >
              <Link className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            rows={10}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter standard markup or paragraph text. Upload the page-level figures/images using the Dedicated Left and Right Image Uploader blocks placed outside this textbox."
            className="w-full bg-[#03060c] p-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-0 line-leading-relax border-0 placeholder-slate-600 min-h-[180px]"
          />
          <div className="px-3 py-1 bg-[#050c18] border-t border-slate-900 flex items-center justify-between text-[9px] font-mono text-slate-500">
            <span>Dynamic layout flow preview enabled</span>
            <span>Markup Mode</span>
          </div>
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
              {value.trim() ? (
                <div 
                  className="prose prose-invert prose-sm font-sans text-slate-200 leading-relaxed space-y-3"
                  dangerouslySetInnerHTML={{ __html: value }}
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
