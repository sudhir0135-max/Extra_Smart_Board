# Interactive learning annotation system — TipTap edition

A full rich-text editor (TipTap) with a custom `annotation` mark that
links any selected text to one or more pieces of content — text,
LaTeX formulas, images, or video — surfaced in an adaptive bottom
sheet.

## Files

| File | Purpose |
|---|---|
| `AnnotationMark.js` | Custom TipTap Mark extension. Stores `annotationId` on a span of text. Composable with bold/italic/etc. |
| `annotationData.js` | Demo data store. Each annotation now holds an `items` array — this is what lets one tag open text + image + video together. Swap for a real API call in production. |
| `Toolbar.jsx` | Full formatting toolbar (bold, italic, underline, strike, headings, lists, quote, undo/redo) plus the "Tag selection" action. |
| `TagPicker.jsx` | Popover for choosing which annotation record to attach to the current selection. Shows small icons previewing what content types are inside each option. |
| `BottomSheet.jsx` | Renders every item inside an annotation, stacked, each in its own block. Auto-sizes to content — a text-only annotation is short, a video-containing one is tall. |
| `AnnotationEditor.jsx` | Wires it all together: `useEditor()`, click delegation on annotation spans, picker positioning, and sheet state. |

## Install

```bash
npm install @tiptap/react @tiptap/core @tiptap/starter-kit @tiptap/extension-placeholder
```

> Note: StarterKit (v3) already bundles Underline, Bold, Italic, Strike,
> headings, lists, and history — you don't need to install those
> separately unless you want to configure one individually.

## Usage

```jsx
import AnnotationEditor from "./AnnotationEditor";

export default function MyPage() {
  return <AnnotationEditor />;
}
```

## How the annotation mark works

`AnnotationMark` is a real TipTap `Mark`, not a string find-and-replace
like the earlier prototype. That means:

- It survives edits — if you type inside or around tagged text, the
  mark moves correctly with the content.
- It serializes to clean HTML: `<span data-annotation-id="a3">text</span>`,
  so saving/loading from your backend is just storing TipTap's HTML or
  JSON output.
- It composes with other marks — annotated text can also be bold,
  italic, etc., since `excludes: ""` is set.

Apply it programmatically:

```js
editor.chain().focus().setAnnotation("a3").run();
```

Remove it:

```js
editor.chain().focus().unsetAnnotation().run();
```

## Wiring to your backend

1. **Saving content** — call `editor.getHTML()` or `editor.getJSON()`
   on save and persist it (e.g. as your `QuestionTranslation.question_text`
   or `LessonTranslation.summary` field from the LMS schema).
2. **Annotation records** — replace `ANNOTATION_DB` with a fetch by ID.
   Recommended shape, matching the multi-item design:

   ```json
   {
     "annotation_id": "a3",
     "title": "Cell structure",
     "items": [
       { "type": "text", "body": "..." },
       { "type": "image", "imageUrl": "https://your-cdn/..." }
     ]
   }
   ```

3. **Click handling** — the editor delegates clicks via a single
   listener on the editor container (`handleEditorClick`), checking
   `e.target.closest('[data-annotation-id]')`. This avoids attaching
   a listener per span, which would otherwise need re-binding on every
   edit.
4. **Hover/long-press** — the current build opens on click for both
   mouse and touch (simplest, most reliable across devices). If you
   want hover-to-preview on desktop, add a `mouseenter` listener in
   the same delegation pattern with a short delay, mirroring the
   `AnnotatedSpan` touch-hold logic from the earlier prototype.

## Notes on the multi-item bottom sheet

This pass focused on the TipTap integration, but the data model and
`BottomSheet` are already multi-item: any annotation can carry several
items, rendered in order, each sized to its own content (text is
compact, video gets a 16:9 frame, images load with a placeholder/error
state). This was the natural overlap between your two requests — no
separate "v2" rebuild needed later for that part.

## What's intentionally simplified for the demo

- `ANNOTATION_DB` is hardcoded — swap for `fetch()`/your API.
- The tag picker lets you pick from existing annotations only; it
  doesn't yet have an "edit items in this annotation" UI. That would
  be the natural next step — a small form to add/remove items per
  annotation, reusing the same item-type icons from `TagPicker`.
