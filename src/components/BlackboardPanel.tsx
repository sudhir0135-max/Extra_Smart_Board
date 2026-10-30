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
import { X, Trash2, Undo2, Pencil, Highlighter, Eye, EyeOff } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'highlighter';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isEraser: boolean;
  /** 'highlighter' strokes are wide and see-through */
  tool?: Tool;
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

// Only four colours (bright shades that stay readable on the green board)
const CHALK_COLORS = [
  { label: 'Red',    hex: '#ff5a5a' },
  { label: 'Blue',   hex: '#5aa9ff' },
  { label: 'Yellow', hex: '#f5d76e' },
  { label: 'White',  hex: '#f0ece0' },
];

// Fixed thickness per tool (no size picker)
const TOOL_WIDTH: Record<Tool, number> = { pen: 4, highlighter: 22 };
const TOOL_ALPHA: Record<Tool, number> = { pen: 0.92, highlighter: 0.45 };

// Board width (percent of the lesson area): dragged by the handle, remembered on this device
const WIDTH_KEY = 'greenboard_width_pct';
const DEFAULT_WIDTH = 40;
const MIN_OPEN_WIDTH = 30;   // narrowest open board; released narrower than this → board closes
const FULL_FROM = 80;        // released wider than this → full width
const MAX_WIDTH = 100;
const SEE_THROUGH_ALPHA = 0.3; // full-width board can be made see-through: 70% transparent (30% green)
const DRAG_THRESHOLD_PX = 6; // smaller movements count as a tap

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
  const [color, setColor]         = useState(CHALK_COLORS[3].hex); // white chalk by default
  const [tool, setTool]           = useState<Tool>('pen');
  const isEraser = false; // eraser removed: Undo and Clear cover corrections
  const [strokes, setStrokes]     = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  const [widthPct, setWidthPct] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(WIDTH_KEY));
      return v >= MIN_OPEN_WIDTH && v <= MAX_WIDTH ? v : DEFAULT_WIDTH;
    } catch { return DEFAULT_WIDTH; }
  });
  const [dragPct, setDragPct] = useState<number | null>(null); // live width while dragging
  const [seeThrough, setSeeThrough] = useState(false);          // only offered at full width
  const [parentW, setParentW] = useState<number>(() => window.innerWidth);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startPct: number; parentW: number; moved: boolean; pct: number } | null>(null);

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
      ctx.globalAlpha = s.isEraser ? 1 : TOOL_ALPHA[s.tool === 'highlighter' ? 'highlighter' : 'pen'];
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

  // Keep the canvas pixel size equal to the board size while it is dragged wider/narrower.
  // Strokes keep their positions (nothing is stretched); widening shows hidden parts again.
  const resizeRef = useRef(resizeCanvas);
  resizeRef.current = resizeCanvas;
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (panel.clientWidth > 0) resizeRef.current(); });
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);

  // Width of the lesson area (the board's container), so the handle and the closed board are the same size
  useEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const update = () => setParentW(parent.clientWidth || window.innerWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  const handlePx = Math.max(28, Math.round(parentW * 0.03));
  const openPct = Math.min(MAX_WIDTH, Math.max(MIN_OPEN_WIDTH, widthPct));
  const isFull = isOpen && dragPct === null && openPct >= MAX_WIDTH;
  useEffect(() => { if (!isFull) setSeeThrough(false); }, [isFull]);

  // ── Drag handle: tap = open/close, drag sideways = resize ─────────────────
  const stripPct = () => (handlePx / (rootRef.current?.parentElement?.clientWidth || parentW)) * 100;
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const parentW = rootRef.current?.parentElement?.clientWidth || window.innerWidth;
    const startPct = isOpen ? openPct : stripPct();
    dragRef.current = { startX: e.clientX, startPct, parentW, moved: false, pct: startPct };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = d.startX - e.clientX; // board is on the right: moving left makes it wider
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    d.pct = Math.min(MAX_WIDTH, Math.max(stripPct(), d.startPct + (dx / d.parentW) * 100));
    setDragPct(d.pct);
  };
  const onHandleUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    setDragPct(null);
    if (!d.moved) { onStripClick(); return; } // tap: open / close as before
    if (d.pct < MIN_OPEN_WIDTH) {
      if (isOpen) onClose();
      return;
    }
    const next = d.pct > FULL_FROM ? MAX_WIDTH : Math.round(d.pct);
    setWidthPct(next);
    try { localStorage.setItem(WIDTH_KEY, String(next)); } catch { /* storage unavailable */ }
    if (!isOpen) onStripClick(); // dragged out from closed: open it
  };

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
    const stroke: Stroke = { points: [pos], color, width: TOOL_WIDTH[tool], isEraser, tool };
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
  const a = SEE_THROUGH_ALPHA;
  const boardBgSeeThrough = `linear-gradient(160deg, rgba(26,61,43,${a}) 0%, rgba(20,83,45,${a}) 30%, rgba(15,61,36,${a}) 70%, rgba(10,46,27,${a}) 100%)`;
  const grainBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='3'%3E%3Ccircle cx='1.5' cy='1.5' r='0.7' fill='rgba(255,255,255,0.025)'/%3E%3C/svg%3E")`;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        width: dragPct !== null ? `${dragPct}%` : isOpen ? `${openPct}%` : `${handlePx}px`,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'row',
        transition: dragPct !== null ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Handle on the board's moving edge: tap = open/close, drag sideways = resize ── */}
      <div
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        title={isOpen ? 'Drag to resize · Tap to close' : 'Tap to open · Drag to pull out the Rough Work board'}
        style={{
          width: handlePx,
          minWidth: handlePx,
          flexShrink: 0,
          background: 'linear-gradient(180deg, #1b4332 0%, #145a32 40%, #0f3d26 100%)',
          borderRight: '2px solid #2d6a4f',
          touchAction: 'none',
          boxShadow: isOpen ? 'none' : '-3px 0 12px rgba(0,0,0,0.4)',
          cursor: 'ew-resize',
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
          {isOpen ? '⇔ Drag · Tap to close' : '✏ Rough Work'}
        </div>
      </div>

      {/* ── Board body (to the right of the handle) ─────── */}
      <div
        ref={panelRef}
        style={{
          flex: 1,
          background: seeThrough ? boardBgSeeThrough : boardBg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: isOpen || dragPct !== null ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          position: 'relative',
        }}
      >
        {/* Chalk grain overlay */}
        <div style={{
          display: seeThrough ? 'none' : 'block',
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: grainBg, backgroundRepeat: 'repeat',
        }} />

        {/* ── Top bar: title on the left, all buttons on the right ─────────
             The board's right edge never moves, so right-aligned buttons keep their
             place while the board is dragged wider or narrower (no wrapping). */}
        <div style={{
          zIndex: 2, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
          justifyContent: 'flex-end', // anything that does not fit is cut off on the left, never pushes buttons
          overflow: 'hidden',
          padding: '6px 8px 6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{mode === 'media' ? '🖼' : '🖊'}</span>
            <span style={{
              color: '#d4f0c4', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {mode === 'media' ? 'Annotation Detail' : 'Rough Work'}
            </span>
          </div>

          {mode === 'draw' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {/* Colours */}
              {CHALK_COLORS.map(c => {
                const active = color === c.hex;
                return (
                  <button key={c.hex} title={c.label} aria-label={c.label}
                    onClick={() => setColor(c.hex)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: c.hex,
                      border: active ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer', flexShrink: 0,
                      boxShadow: active ? `0 0 0 2px rgba(0,0,0,0.35), 0 0 8px ${c.hex}aa` : 'none',
                      transform: active ? 'scale(1.12)' : 'none',
                      transition: 'all 0.15s',
                    }} />
                );
              })}

              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', flexShrink: 0, margin: '0 2px' }} />

              {/* Pen / Highlighter */}
              {([
                { id: 'pen', label: 'Pen', Icon: Pencil },
                { id: 'highlighter', label: 'Highlighter', Icon: Highlighter },
              ] as const).map(({ id, label, Icon }) => {
                const active = tool === id;
                return (
                  <button key={id} onClick={() => setTool(id)} title={label} aria-label={label}
                    style={{
                      width: 30, height: 28, borderRadius: 6, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                      border: active ? '1px solid rgba(255,255,255,0.45)' : '1px solid rgba(255,255,255,0.12)',
                      color: active ? color : 'rgba(255,255,255,0.7)',
                    }}>
                    <Icon size={15} />
                  </button>
                );
              })}

              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', flexShrink: 0, margin: '0 2px' }} />

              {/* Undo */}
              <button onClick={handleUndo} disabled={strokes.length === 0} title="Undo" aria-label="Undo"
                style={{
                      width: 30, height: 28, borderRadius: 6, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: strokes.length === 0 ? 'not-allowed' : 'pointer',
                  color: strokes.length === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)',
                }}>
                <Undo2 size={15} />
              </button>

              {/* Clear */}
              <button onClick={handleClear} disabled={strokes.length === 0} title="Clear board" aria-label="Clear"
                style={{
                      width: 30, height: 28, borderRadius: 6, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                  background: strokes.length === 0 ? 'transparent' : 'rgba(239,68,68,0.15)',
                  border: strokes.length === 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(239,68,68,0.4)',
                  cursor: strokes.length === 0 ? 'not-allowed' : 'pointer',
                  color: strokes.length === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(252,165,165,0.95)',
                }}>
                <Trash2 size={15} />
              </button>

              {/* See-through (full width only) */}
              {isFull && (
                <button onClick={() => setSeeThrough(s => !s)}
                  title={seeThrough ? 'Make board solid' : 'See through the board (70% transparent)'}
                  aria-label="See-through board"
                  style={{
                      width: 30, height: 28, borderRadius: 6, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s',
                    background: seeThrough ? 'rgba(255,255,255,0.22)' : 'transparent',
                    border: seeThrough ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                  }}>
                  {seeThrough ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            title="Close"
            aria-label="Close board"
            style={{
                      width: 30, height: 28, borderRadius: 6, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            DRAW MODE
        ══════════════════════════════════════════════════════════════ */}
        {mode === 'draw' && (
          <>
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
                    justifyContent: 'center', color: '#94a3b8', gap: 8, padding: 20
                  }}>
                    <p style={{ margin: 0, fontSize: 13, textAlign: 'center', maxWidth: 240 }}>
                      Videos will play when the device is connected to the internet.
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

    </div>
  );
}
