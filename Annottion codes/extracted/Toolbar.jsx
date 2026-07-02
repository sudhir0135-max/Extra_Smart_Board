import React from "react";

// ── Toolbar button ─────────────────────────────────────────────────
function ToolbarButton({ icon, label, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--bg-accent)" : "transparent",
        color: active ? "var(--text-accent)" : "var(--text-primary)",
        border: "none",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
    </button>
  );
}

function ToolbarDivider() {
  return <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />;
}

// ── Full formatting + annotation toolbar ──────────────────────────
export function Toolbar({ editor, hasSelection, onTag }) {
  if (!editor) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "6px 8px",
        background: "var(--surface-1)",
        borderRadius: "var(--radius) var(--radius) 0 0",
        border: "0.5px solid var(--border)",
        borderBottom: "none",
        flexWrap: "wrap",
      }}
    >
      <ToolbarButton
        icon="ti-bold"
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon="ti-italic"
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon="ti-underline"
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon="ti-strikethrough"
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        icon="ti-h-1"
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon="ti-h-2"
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        icon="ti-list"
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon="ti-list-numbers"
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon="ti-blockquote"
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        icon="ti-arrow-back-up"
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon="ti-arrow-forward-up"
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />

      <ToolbarDivider />

      <button
        onClick={onTag}
        disabled={!hasSelection}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          padding: "0 10px",
          height: 30,
          opacity: hasSelection ? 1 : 0.5,
        }}
      >
        <i className="ti ti-tag" style={{ fontSize: 15 }} aria-hidden="true" />
        Tag selection
      </button>
    </div>
  );
}
