/**
 * BlackboardPanel.tsx
 *
 * Dual-mode left-edge panel:
 *
 *  mode = 'draw'  → classic dark-green chalkboard with annotation toolbar.
 *  mode = 'media' → annotation image or video displayed full-panel,
 *                   canvas is hidden (strokes preserved), toolbar replaced
 *                   by a simple close button.
 *
 * Fully controlled by parent:
 *  - isOpen / mode / mediaUrl / mediaType come from props.
 *  - Strip click  → calls onStripClick()
 *  - Close button → calls onClose()
 *
 * FloatingButton visibility is managed by the parent via the same callbacks.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Trash2, Undo2, Eraser, Pencil } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isEraser: boolean;
}

export interface BlackboardPanelProps {
  isOpen: boolean;
  mode: 'draw' | 'media';
  /** URL for the annotation image or video iframe src */
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  /** Annotation text shown below the media */
  mediaText?: string;
  /** Called when the 3% collapsed strip is clicked */
  onStripClick: () => void;
  /** Called when the × close button is pressed (always closes entirely) */
  onClose: () => void;
  lessonId: string;
  isOnline?: boolean;
}

// ─── Chalk colour palette ────────────────────────────────────────────────────

const CHALK_COLORS = [
  { label: 'White',  hex: '#f0ece0' },
  { label: 'Yellow', hex: '#f5d76e' },
  { label: 'Cyan',   hex: '#7ee8e8' },
  { label: 'Pink',   hex: '#f4a0b5' },
  { label: 'Orange', hex: '#f4a44a' },
  { label: 'Green',  hex: '#a8e6a3' },
];

const CHALK_WIDTHS = [3, 6, 10, 16];

// ─── Component ───────────────────────────────────────────────────────────────

export default function BlackboardPanel({
  isOpen,
  mode,
  mediaUrl,
  mediaType,
  mediaText,
  onStripClick,
  onClose,
  lessonId,
  isOnline = true,
}: BlackboardPanelProps) {
  const [color, setColor]         = useState(CHALK_COLORS[0].hex);
  const [width, setWidth]         = useState(CHALK_WIDTHS[1]);
  const [isEraser, setIsEraser]   = useState(false);
  const [strokes, setStrokes]     = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);

  // Clear strokes when lesson changes
  useEffect(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, [lessonId]);

  // ── Canvas rendering ────────────────────────────────────────────────────
  const redraw = useCallback((all: Stroke[], live: Stroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const paint = (s: Stroke) => {
      if (s.points.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = s.isEraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.isEraser ? 'rgba(0,0,0,1)' : s.color;
      ctx.globalAlpha = s.isEraser ? 1 : 0.88;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        const mid = {
          x: (s.points[i - 1].x + s.points[i].x) / 2,
          y: (s.points[i - 1].y + s.points[i].y) / 2,
        };
        ctx.quadraticCurveTo(s.points[i - 1].x, s.points[i - 1].y, mid.x, mid.y);
      }
      ctx.stroke();
      ctx.restore();
    };

    all.forEach(paint);
    if (live) paint(live);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const panel  = panelRef.current;
    if (!canvas || !panel) return;
    canvas.width  = panel.clientWidth;
    canvas.height = panel.clientHeight;
    redraw(strokes, currentStroke);
  }, [strokes, currentStroke, redraw]);

  useEffect(() => {
    if (!isOpen || mode !== 'draw') return;
    const t = setTimeout(resizeCanvas, 320);
    return () => clearTimeout(t);
  }, [isOpen, mode, resizeCanvas]);

  // ── Pointer events ──────────────────────────────────────────────────────
  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isOpen || mode !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    setIsDrawing(true);
    const pos = getPos(e);
    const stroke: Stroke = { points: [pos], color, width, isEraser };
    setCurrentStroke(stroke);
    redraw(strokes, stroke);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current || mode !== 'draw') return;
    const pos = getPos(e);
    setCurrentStroke(prev => {
      if (!prev) return null;
      const updated = { ...prev, points: [...prev.points, pos] };
      redraw(strokes, updated);
      return updated;
    });
  };

  const onPointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setIsDrawing(false);
    if (currentStroke && currentStroke.points.length > 1) {
      const final = [...strokes, currentStroke];
      setStrokes(final);
      redraw(final, null);
    }
    setCurrentStroke(null);
  };

  // ── Toolbar actions ─────────────────────────────────────────────────────
  const handleUndo = () => {
    const updated = strokes.slice(0, -1);
    setStrokes(updated);
    redraw(updated, null);
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke(null);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // ── Shared styles ───────────────────────────────────────────────────────
  const boardBg = 'linear-gradient(160deg, #1a3d2b 0%, #14532d 30%, #0f3d24 70%, #0a2e1b 100%)';
  const grainBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='3'%3E%3Ccircle cx='1.5' cy='1.5' r='0.7' fill='rgba(255,255,255,0.025)'/%3E%3C/svg%3E")`;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: isOpen ? '40%' : 'max(3%, 28px)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'row',
        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Expanded panel body (left side of the right panel) ─────── */}
      <div
        ref={panelRef}
        style={{
          flex: 1,
          background: boardBg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          position: 'relative',
        }}
      >
        {/* Chalk grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: grainBg, backgroundRepeat: 'repeat',
        }} />

        {/* ── Header (shared by both modes) ──────────────────────────── */}
        <div style={{
          zIndex: 2, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{mode === 'media' ? '🖼' : '🖊'}</span>
            <span style={{
              color: '#d4f0c4', fontSize: 11, fontWeight: 700,
              fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {mode === 'media' ? 'Annotation Detail' : 'Explanation / Rough Work'}
            </span>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '3px 6px',
              cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            DRAW MODE
        ══════════════════════════════════════════════════════════════ */}
        {mode === 'draw' && (
          <>
            {/* Toolbar */}
            <div style={{
              zIndex: 2, flexShrink: 0,
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
              padding: '7px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(0,0,0,0.18)',
            }}>
              {/* Colours */}
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {CHALK_COLORS.map(c => (
                  <button key={c.hex} title={c.label}
                    onClick={() => { setColor(c.hex); setIsEraser(false); }}
                    style={{
                      width: 18, height: 18, borderRadius: '50%', background: c.hex,
                      border: (!isEraser && color === c.hex) ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer', flexShrink: 0,
                      boxShadow: (!isEraser && color === c.hex) ? `0 0 6px ${c.hex}88` : 'none',
                      transition: 'all 0.15s',
                    }} />
                ))}
              </div>

              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

              {/* Widths */}
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {CHALK_WIDTHS.map(w => (
                  <button key={w} title={`Size ${w}`}
                    onClick={() => { setWidth(w); setIsEraser(false); }}
                    style={{
                      width: 22, height: 22, borderRadius: 4,
                      background: (!isEraser && width === w) ? 'rgba(255,255,255,0.15)' : 'transparent',
                      border: (!isEraser && width === w) ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}>
                    <div style={{
                      width: Math.min(w * 1.1, 16), height: Math.min(w * 1.1, 16),
                      borderRadius: '50%', background: isEraser ? 'rgba(255,255,255,0.3)' : color,
                    }} />
                  </button>
                ))}
              </div>

              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

              {/* Eraser toggle */}
              <button onClick={() => setIsEraser(e => !e)}
                style={{
                  padding: '3px 8px', borderRadius: 5,
                  background: isEraser ? 'rgba(255,255,255,0.18)' : 'transparent',
                  border: isEraser ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.75)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontFamily: 'monospace', transition: 'all 0.15s', flexShrink: 0,
                }}>
                {isEraser ? <><Pencil size={11} /> Chalk</> : <><Eraser size={11} /> Eraser</>}
              </button>

              {/* Undo */}
              <button onClick={handleUndo} disabled={strokes.length === 0}
                style={{
                  padding: '3px 8px', borderRadius: 5,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: strokes.length === 0 ? 'not-allowed' : 'pointer',
                  color: strokes.length === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontFamily: 'monospace', flexShrink: 0,
                }}>
                <Undo2 size={11} /> Undo
              </button>

              {/* Clear */}
              <button onClick={handleClear} disabled={strokes.length === 0}
                style={{
                  padding: '3px 8px', borderRadius: 5,
                  background: strokes.length === 0 ? 'transparent' : 'rgba(239,68,68,0.15)',
                  border: strokes.length === 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(239,68,68,0.4)',
                  cursor: strokes.length === 0 ? 'not-allowed' : 'pointer',
                  color: strokes.length === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(252,165,165,0.9)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontFamily: 'monospace', flexShrink: 0,
                }}>
                <Trash2 size={11} /> Clear
              </button>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              style={{
                flex: 1, width: '100%', display: 'block',
                cursor: isEraser ? 'cell' : 'crosshair',
                touchAction: 'none', zIndex: 1,
              }}
            />

            {/* Empty hint */}
            {strokes.length === 0 && !isDrawing && (
              <div style={{
                position: 'absolute', inset: 0, top: 80,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none', zIndex: 1, gap: 8,
              }}>
                <span style={{ fontSize: 32, opacity: 0.15 }}>✏️</span>
                <span style={{
                  color: 'rgba(255,255,255,0.12)', fontSize: 11,
                  fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.6,
                }}>
                  Draw freely here<br />Rough work · Diagrams · Notes
                </span>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MEDIA MODE — show annotation image or video
        ══════════════════════════════════════════════════════════════ */}
        {mode === 'media' && (
          <div style={{
            flex: 1, zIndex: 2, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', padding: 12, gap: 12,
          }}>
            {/* Image display */}
            {mediaType === 'image' && mediaUrl && (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, overflow: 'hidden',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <img
                  src={mediaUrl}
                  alt="Annotation"
                  style={{
                    maxWidth: '100%', maxHeight: '100%',
                    objectFit: 'contain', borderRadius: 8,
                  }}
                />
              </div>
            )}

            {/* Video display */}
            {mediaType === 'video' && mediaUrl && (
              <div style={{
                flex: 1, borderRadius: 12, overflow: 'hidden',
                background: '#000',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {!isOnline ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', color: '#fca5a5', gap: 12, padding: 20
                  }}>
                    <span style={{ fontSize: 40 }}>📶❌</span>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 'bold' }}>Offline: Streaming Paused</h4>
                    <p style={{ margin: 0, fontSize: 11, opacity: 0.6, textAlign: 'center', maxWidth: 220, fontFamily: 'monospace' }}>
                      Internet connection is required to stream this video annotation.
                    </p>
                  </div>
                ) : (
                  <iframe
                    src={mediaUrl}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                )}
              </div>
            )}

            {/* Annotation text */}
            {mediaText && (
              <div style={{
                flexShrink: 0,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '10px 14px',
                color: 'rgba(240,236,224,0.85)',
                fontSize: 13, fontFamily: 'Georgia, serif',
                lineHeight: 1.6,
              }}>
                {mediaText}
              </div>
            )}

            {/* Empty fallback */}
            {!mediaUrl && (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.2)', fontSize: 12, fontFamily: 'monospace',
              }}>
                No media attached
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3% Collapsed strip (right edge) ───────────────────────────── */}
      <div
        onClick={onStripClick}
        title={isOpen ? 'Collapse board' : 'Open Rough Work board'}
        style={{
          width: 'max(3%, 28px)',
          minWidth: 28,
          flexShrink: 0,
          background: 'linear-gradient(180deg, #1b4332 0%, #145a32 40%, #0f3d26 100%)',
          borderLeft: '2px solid #2d6a4f',
          boxShadow: isOpen ? 'none' : '-3px 0 12px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grain texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Ccircle cx='1' cy='1' r='0.6' fill='rgba(255,255,255,0.04)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', pointerEvents: 'none',
        }} />
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          color: 'rgba(240,236,224,0.75)',
          fontSize: 9,
          fontFamily: 'monospace',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {isOpen ? 'Close →' : '✏ Rough Work'}
        </div>
      </div>
    </div>
  );
}
