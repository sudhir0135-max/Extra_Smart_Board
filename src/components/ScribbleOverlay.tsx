/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { DrawingStroke } from '../types';
import { Palette, Trash2, Undo, Circle, Sparkles, BookOpen, X } from 'lucide-react';

interface ScribbleOverlayProps {
  lessonId: string;
  isDrawingMode: boolean;
  onStrokeSaved: (drawingDataUrl: string) => void;
  onCloseDrawing?: () => void;
  selectedColor?: string;
  lineWidth?: number;
  isHighlighter?: boolean;
}

const PALETTE_COLORS = [
  { name: 'Classroom Amber', hex: '#f59e0b' },
  { name: 'Alert Red', hex: '#f43f5e' },
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Chalk White', hex: '#ffffff' },
  { name: 'Ink Charcoal', hex: '#0f172a' },
];

export default function ScribbleOverlay({
  lessonId,
  isDrawingMode,
  onStrokeSaved,
  onCloseDrawing,
  selectedColor = '#f59e0b',
  lineWidth = 4,
  isHighlighter = false,
}: ScribbleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const isDrawing = useRef(false);

  // Reset sketches on mount/lesson rotation
  useEffect(() => {
    setStrokes([]);
  }, [lessonId]);

  // Save strokes to temporary state (Wiped on close)
  const saveStrokes = (updatedStrokes: DrawingStroke[]) => {
    if (canvasRef.current) {
      onStrokeSaved(canvasRef.current.toDataURL());
    }
  };

  // Canvas context setups & resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Use scrollWidth and scrollHeight to cover the full length of the document,
        // not just the visible viewport
        canvas.width = parent.scrollWidth || 800;
        canvas.height = parent.scrollHeight || 1200;
      }
      redrawStrokes(ctx, strokes);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [strokes]);

  // Recalculate canvas view
  const redrawStrokes = (ctx: CanvasRenderingContext2D, strokeList: DrawingStroke[]) => {
    if (!canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    strokeList.forEach(stroke => {
      if (stroke.points.length < 1) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.isHighlighter) {
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalAlpha = 1.0;
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Reset alpha
    ctx.globalAlpha = 1.0;
  };

  // Touch & Mouse coordination coordinates
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    isDrawing.current = true;
    const newStroke: DrawingStroke = {
      points: [coords],
      color: selectedColor,
      width: lineWidth,
      isHighlighter,
    };
    setCurrentStroke(newStroke);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !currentStroke || !isDrawingMode) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const nextStroke = {
      ...currentStroke,
      points: [...currentStroke.points, coords],
    };
    setCurrentStroke(nextStroke);

    // Live display drawing
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        redrawStrokes(ctx, [...strokes, nextStroke]);
      }
    }
  };

  const endDrawing = () => {
    if (!isDrawing.current || !currentStroke) return;
    isDrawing.current = false;

    const finalStrokes = [...strokes, currentStroke];
    setStrokes(finalStrokes);
    setCurrentStroke(null);
    saveStrokes(finalStrokes);
  };

  // Track strokes length in window attribute so App.tsx can disable its buttons
  useEffect(() => {
    (window as any).__strokesLength = strokes.length;
  }, [strokes]);

  useEffect(() => {
    const handleClear = () => {
      const confirmClear = window.confirm('Clear all drawings and annotations off this lesson?');
      if (confirmClear) {
        setStrokes([]);
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          onStrokeSaved(canvasRef.current.toDataURL());
        }
      }
    };

    const handleUndo = () => {
      setStrokes(prev => {
        if (prev.length === 0) return prev;
        const next = prev.slice(0, -1);
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            redrawStrokes(ctx, next);
          }
          onStrokeSaved(canvasRef.current.toDataURL());
        }
        return next;
      });
    };

    window.addEventListener('classroom-canvas-clear', handleClear);
    window.addEventListener('classroom-canvas-undo', handleUndo);
    return () => {
      window.removeEventListener('classroom-canvas-clear', handleClear);
      window.removeEventListener('classroom-canvas-undo', handleUndo);
    };
  }, [lessonId, onStrokeSaved]);

  const clearCanvas = () => {
    const confirmClear = window.confirm('Clear all drawings and annotations off this lesson?');
    if (confirmClear) {
      setStrokes([]);
      saveStrokes([]);
    }
  };

  const undoLastStroke = () => {
    if (strokes.length === 0) return;
    const previous = strokes.slice(0, -1);
    setStrokes(previous);
    saveStrokes(previous);
  };

  return (
    <div className={`absolute inset-0 z-20 ${isDrawingMode ? 'pointer-events-auto' : 'pointer-events-none'}`} id={`canvas-wrapper-${lessonId}`}>
      {/* Drawing Canvas element */}
      <canvas
        ref={canvasRef}
        id={`scribble-canvas-${lessonId}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
        className={`w-full h-full block cursor-crosshair transition-opacity duration-200 touch-none ${
          isDrawingMode ? 'opacity-100' : 'opacity-85 pointer-events-none'
        }`}
      />
    </div>
  );
}
