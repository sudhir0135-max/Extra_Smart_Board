import React, { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { AnnotationMark } from "./AnnotationMark";
import { ANNOTATION_DB } from "./annotationData";
import { Toolbar } from "./Toolbar";
import { TagPicker } from "./TagPicker";
import { BottomSheet } from "./BottomSheet";

// Demo starting content. In production this would be the document
// you load from your DB (TipTap stores it as JSON or HTML).
const DEMO_HTML = `
  <p>In physics, <span data-annotation-id="a1">force equals mass times acceleration</span>.
  For algebra, the <span data-annotation-id="a2">quadratic formula</span> solves any
  equation of that shape. Biology students often study the
  <span data-annotation-id="a3">structure of a eukaryotic cell</span> and how it relates
  to the broader process of <span data-annotation-id="a4">photosynthesis</span>.</p>
  <p>Select any plain text above (or type your own) and use "Tag selection" to
  link it to formulas, images, or video.</p>
`;

// ── Editor stylesheet (annotation span look + basic prose styling) ─
// Injected once; relies on CSS variables so it adapts to light/dark.
const EDITOR_STYLES = `
  .annotation-editor .ProseMirror {
    outline: none;
    min-height: 160px;
  }
  .annotation-editor .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    float: left;
    pointer-events: none;
    height: 0;
  }
  .annotation-editor .ProseMirror h1 { font-size: 22px; font-weight: 500; margin: 0.6em 0 0.3em; }
  .annotation-editor .ProseMirror h2 { font-size: 18px; font-weight: 500; margin: 0.6em 0 0.3em; }
  .annotation-editor .ProseMirror p { margin: 0.4em 0; line-height: 1.7; }
  .annotation-editor .ProseMirror ul, .annotation-editor .ProseMirror ol { padding-left: 1.4em; }
  .annotation-editor .ProseMirror blockquote {
    border-left: 3px solid var(--border-strong);
    margin: 0.6em 0;
    padding-left: 0.8em;
    color: var(--text-secondary);
  }
  .annotation-span {
    background: transparent;
    border-bottom: 2px dashed var(--border-accent);
    color: var(--text-accent);
    padding: 0 2px;
    border-radius: 3px;
    font-weight: 500;
    cursor: pointer;
    transition: background 120ms ease;
  }
  .annotation-span:hover {
    background: var(--bg-accent);
  }
`;

function useInjectedStyles(css, key) {
  useEffect(() => {
    if (document.getElementById(key)) return;
    const style = document.createElement("style");
    style.id = key;
    style.textContent = css;
    document.head.appendChild(style);
  }, [css, key]);
}

export default function AnnotationEditor() {
  useInjectedStyles(EDITOR_STYLES, "annotation-editor-styles");

  const [hasSelection, setHasSelection] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 8, left: 8 });
  const [activeAnnotationId, setActiveAnnotationId] = useState(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      AnnotationMark,
      Placeholder.configure({ placeholder: "Start writing, or select text to tag it…" }),
    ],
    content: DEMO_HTML,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      setHasSelection(to > from);
    },
    onUpdate: () => {
      // Re-bind click handlers any time content changes, since
      // annotation spans may be new DOM nodes.
    },
  });

  // ── Click delegation: any click on an annotation span opens the sheet ─
  const handleEditorClick = useCallback((e) => {
    const span = e.target.closest?.("[data-annotation-id]");
    if (span) {
      setActiveAnnotationId(span.getAttribute("data-annotation-id"));
    }
  }, []);

  const handleTagClick = useCallback(() => {
    if (!editor) return;
    // Position the picker near the current selection.
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    const editorRect = editor.view.dom.getBoundingClientRect();
    setPickerPos({
      top: coords.top - editorRect.top + 24,
      left: Math.max(0, coords.left - editorRect.left),
    });
    setPickerOpen(true);
  }, [editor]);

  const applyAnnotation = useCallback(
    (annotationId) => {
      if (!editor) return;
      editor.chain().focus().setAnnotation(annotationId).run();
      setPickerOpen(false);
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="annotation-editor" style={{ position: "relative" }}>
      <h2
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}
      >
        Rich text editor with tag-and-link annotations. Select text, tag it with
        linked content, then click the tagged text to open a bottom sheet showing
        notes, formulas, images, or video.
      </h2>

      <Toolbar editor={editor} hasSelection={hasSelection} onTag={handleTagClick} />

      <div
        onClick={handleEditorClick}
        style={{
          position: "relative",
          border: "0.5px solid var(--border)",
          borderRadius: "0 0 var(--radius) var(--radius)",
          padding: "0.75rem 1.25rem",
          background: "var(--surface-2)",
          fontSize: 15,
        }}
      >
        <EditorContent editor={editor} />

        {pickerOpen && (
          <div style={{ position: "absolute", top: pickerPos.top, left: pickerPos.left }}>
            <TagPicker onPick={applyAnnotation} onCancel={() => setPickerOpen(false)} />
          </div>
        )}
      </div>

      <div style={{ position: "relative", minHeight: activeAnnotationId ? 400 : 0 }}>
        <BottomSheet
          annotation={activeAnnotationId ? ANNOTATION_DB[activeAnnotationId] : null}
          onClose={() => setActiveAnnotationId(null)}
        />
      </div>
    </div>
  );
}
