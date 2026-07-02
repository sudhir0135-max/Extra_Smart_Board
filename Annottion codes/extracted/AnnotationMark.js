import { Mark, mergeAttributes } from "@tiptap/core";

// ── Custom TipTap mark for tagged/annotated text ──────────────────
// Stores one annotationId per mark. The annotation record itself
// (looked up from annotationId) can hold MULTIPLE linked items —
// e.g. a text note + an image + a video together.
export const AnnotationMark = Mark.create({
  name: "annotation",

  // Allow annotation to coexist with bold/italic/etc rather than
  // being mutually exclusive.
  excludes: "",

  addAttributes() {
    return {
      annotationId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-annotation-id"),
        renderHTML: (attrs) =>
          attrs.annotationId ? { "data-annotation-id": attrs.annotationId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-annotation-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "annotation-span" }),
      0,
    ];
  },

  addCommands() {
    return {
      setAnnotation:
        (annotationId) =>
        ({ commands }) =>
          commands.setMark(this.name, { annotationId }),
      unsetAnnotation:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
