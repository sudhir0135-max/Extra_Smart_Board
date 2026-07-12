import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ImageFrameProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
}

export default function ImageFrame({ isOpen, onClose, src, alt = 'Image Frame' }: ImageFrameProps) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const clampPosition = (newScale: number, newX: number, newY: number) => {
    if (newScale <= 1) return { x: 0, y: 0 };
    if (!containerRef.current) return { x: newX, y: newY };

    const rect = containerRef.current.getBoundingClientRect();
    const maxTx = (rect.width * newScale - rect.width) / 2;
    const maxTy = (rect.height * newScale - rect.height) / 2;

    const clamp = (val: number, max: number) => Math.max(-max, Math.min(max, val));

    return {
      x: clamp(newX, maxTx),
      y: clamp(newY, maxTy)
    };
  };

  const updateScaleAndClamp = (newScale: number) => {
    setScale(newScale);
    setPosition(prev => clampPosition(newScale, prev.x, prev.y));
  };

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartPos({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const newX = e.clientX - startPos.x;
      const newY = e.clientY - startPos.y;
      setPosition(clampPosition(scale, newX, newY));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      updateScaleAndClamp(Math.min(scale + 0.1, 5));
    } else {
      updateScaleAndClamp(Math.max(scale - 0.1, 1));
    }
  };

  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setInitialDistance(getDistance(e.touches));
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== null) {
      const currentDistance = getDistance(e.touches);
      const diff = currentDistance - initialDistance;
      const newScale = Math.min(Math.max(scale + diff * 0.01, 1), 5);
      updateScaleAndClamp(newScale);
      setInitialDistance(currentDistance);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      const newX = e.touches[0].clientX - startPos.x;
      const newY = e.touches[0].clientY - startPos.y;
      setPosition(clampPosition(scale, newX, newY));
    }
  };

  const handleTouchEnd = () => {
    setInitialDistance(null);
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* 90% Screen Container */}
      <div 
        ref={containerRef}
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', height: '90vh' }}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-20 p-2.5 bg-black/60 hover:bg-rose-500/90 text-white rounded-full backdrop-blur-md transition-all shadow-xl border border-white/10"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image Display Area (Overflow Hidden to prevent overlapping boundaries) */}
        <div 
          className="flex-1 overflow-hidden relative flex items-center justify-center bg-[#050505] cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img 
            src={src} 
            alt={alt}
            draggable={false}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          />
        </div>
      </div>
    </div>
  );
}
