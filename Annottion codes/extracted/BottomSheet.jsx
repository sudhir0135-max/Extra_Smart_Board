import React, { useState, useRef, useCallback, useEffect } from "react";
import { ITEM_TYPE_META } from "./annotationData";

// ── KaTeX loader (CDN, loaded once) ───────────────────────────────
let katexPromise = null;
function loadKatex() {
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve) => {
    if (window.katex) return resolve(window.katex);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
    script.onload = () => resolve(window.katex);
    document.head.appendChild(script);
  });
  return katexPromise;
}

function KatexBlock({ tex }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    loadKatex().then((katex) => {
      if (cancelled || !ref.current) return;
      try {
        katex.render(tex, ref.current, { throwOnError: false, displayMode: true });
      } catch (e) {
        ref.current.textContent = tex;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tex]);
  return <div ref={ref} style={{ overflowX: "auto", padding: "4px 0" }} />;
}

function ImageBlock({ src, alt }) {
  const [status, setStatus] = useState("loading"); // loading | loaded | error
  return (
    <div style={{ position: "relative" }}>
      {status !== "loaded" && (
        <div
          style={{
            background: "var(--surface-1)",
            borderRadius: "var(--radius)",
            padding: "2rem 1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          <i
            className={`ti ${status === "error" ? "ti-photo-off" : "ti-photo"}`}
            style={{ fontSize: 24 }}
            aria-hidden="true"
          />
          {status === "error" ? "Couldn't load this image" : "Loading image\u2026"}
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        style={{
          width: "100%",
          borderRadius: "var(--radius)",
          display: status === "loaded" ? "block" : "none",
        }}
      />
    </div>
  );
}

// ── A single content item inside the sheet ────────────────────────
function ContentItem({ item }) {
  const meta = ITEM_TYPE_META[item.type] || ITEM_TYPE_META.text;

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          color: "var(--text-muted)",
          fontSize: 12,
        }}
      >
        <i className={`ti ${meta.icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
        {meta.label}
      </div>

      {item.type === "text" && item.body && (
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0 }}>
          {item.body}
        </p>
      )}

      {item.type === "formula" && item.latex && (
        <div
          style={{
            background: "var(--surface-1)",
            borderRadius: "var(--radius)",
            padding: "1rem",
            fontSize: 18,
          }}
        >
          <KatexBlock tex={item.latex} />
        </div>
      )}

      {item.type === "image" && item.imageUrl && (
        <ImageBlock src={item.imageUrl} alt={item.alt || ""} />
      )}

      {item.type === "video" && item.videoUrl && (
        <div
          style={{
            position: "relative",
            paddingTop: "56.25%",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          <iframe
            src={item.videoUrl}
            title="Linked video"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

// ── Bottom sheet (renders ALL items belonging to one annotation) ──
export function BottomSheet({ annotation, onClose }) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  if (!annotation) return null;
  const items = annotation.items || [];

  return (
    <div
      onClick={handleClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        opacity: closing ? 0 : 1,
        transition: "opacity 180ms ease",
        zIndex: 10,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--surface-2)",
          borderRadius: "16px 16px 0 0",
          border: "0.5px solid var(--border)",
          borderBottom: "none",
          padding: "0.75rem 1.25rem 1.5rem",
          maxHeight: "78%",
          overflowY: "auto",
          transform: closing ? "translateY(24px)" : "translateY(0)",
          transition: "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{annotation.title}</h3>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{ width: 32, height: 32, padding: 0, flexShrink: 0 }}
          >
            <i className="ti ti-x" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No content linked yet.</p>
        ) : (
          items.map((item, i) => <ContentItem key={i} item={item} />)
        )}
      </div>
    </div>
  );
}
