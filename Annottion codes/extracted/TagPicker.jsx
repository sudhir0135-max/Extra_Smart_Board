import React from "react";
import { ANNOTATION_DB, ITEM_TYPE_META } from "./annotationData";

// Shows the type icons for the first couple of items in an annotation,
// so users can see at a glance that "Cell structure" = note + image,
// without opening the sheet.
function ItemTypeBadges({ items }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {items.slice(0, 3).map((item, i) => {
        const meta = ITEM_TYPE_META[item.type] || ITEM_TYPE_META.text;
        return (
          <i
            key={i}
            className={`ti ${meta.icon}`}
            style={{ fontSize: 13, color: "var(--text-muted)" }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export function TagPicker({ onPick, onCancel }) {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 20,
        background: "var(--surface-2)",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-popover)",
        padding: 6,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 200,
      }}
    >
      {Object.entries(ANNOTATION_DB).map(([id, a]) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 13,
            padding: "6px 8px",
            border: "none",
            height: 32,
          }}
        >
          <span>{a.title}</span>
          <ItemTypeBadges items={a.items} />
        </button>
      ))}
      <button
        onClick={onCancel}
        style={{ fontSize: 12, color: "var(--text-muted)", height: 28, border: "none" }}
      >
        Cancel
      </button>
    </div>
  );
}
