import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { InteractiveImageDef, ImageHotspot } from '../types';
import CachedImage from './CachedImage';

interface ImageFrameProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  description?: string;
  interactiveDef?: InteractiveImageDef;
}

export default function ImageFrame({ isOpen, onClose, src, alt = 'Image Frame', description, interactiveDef }: ImageFrameProps) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  
  // Interactive Map States
  const [viewStack, setViewStack] = useState<Array<InteractiveImageDef | ImageHotspot>>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsPanelOpen(true);
      if (interactiveDef) {
        setViewStack([interactiveDef]);
        
        // Eagerly preload all nested deep-dive images so they display instantly on click
        const traverseAndPreload = (hotspots: ImageHotspot[]) => {
          for (const hs of hotspots) {
            if (hs.targetImage) {
              const img = new Image();
              img.src = hs.targetImage;
            }
            if (hs.hotspots && hs.hotspots.length > 0) {
              traverseAndPreload(hs.hotspots);
            }
          }
        };
        traverseAndPreload(interactiveDef.hotspots || []);
      } else {
        setViewStack([]);
      }
    }
  }, [isOpen, interactiveDef]);

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

  // Resolve current active node
  const currentNode = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;
  const currentSrc = currentNode 
    ? (('rootImage' in currentNode) ? (currentNode as InteractiveImageDef).rootImage : (currentNode as ImageHotspot).targetImage)
    : src;
  const currentDesc = currentNode ? currentNode.description : description;
  const currentHotspots = currentNode ? currentNode.hotspots : undefined;

  const hasDescription = !!currentDesc;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* 90% Screen Container */}
      <div 
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex overflow-hidden"
        style={{ width: '90vw', height: '90vh' }}
      >
        {viewStack.length === 1 && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 z-50 p-2.5 bg-black/60 hover:bg-rose-500/90 text-white rounded-full backdrop-blur-md transition-all shadow-xl border border-white/10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {viewStack.length > 1 && (
          <button 
            onClick={() => {
              setViewStack(prev => prev.slice(0, -1));
              setScale(1);
              setPosition({x:0, y:0});
            }} 
            className="absolute top-4 left-4 z-50 px-4 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-full backdrop-blur-md transition-all shadow-xl flex items-center gap-2 font-bold text-sm"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}

        {/* Main Image Area */}
        <div 
          ref={containerRef}
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
          {/* We wrap the img and hotspots in a single scaling container */}
          <div 
            className="relative flex items-center justify-center max-w-full max-h-full"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <CachedImage 
              src={currentSrc} 
              alt={alt}
              draggable={false}
              className="max-w-full max-h-full object-contain pointer-events-none"
            />
            {currentHotspots?.map((hs) => (
              <div
                key={hs.id}
                className="absolute cursor-pointer border-2 border-dashed border-emerald-400/80 hover:border-emerald-400 hover:bg-emerald-400/20 transition-all z-10 rounded-sm shadow-[inset_0_0_10px_rgba(52,211,153,0.3)] hover:shadow-[inset_0_0_20px_rgba(52,211,153,0.6)]"
                style={{ left: `${hs.x}%`, top: `${hs.y}%`, width: `${hs.width}%`, height: `${hs.height}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDragging) {
                    setViewStack([...viewStack, hs]);
                    setScale(1);
                    setPosition({x:0, y:0});
                  }
                }}
              >
                {/* Optional pulse effect for hotspots */}
                <div className="absolute inset-0 bg-emerald-400/10 animate-pulse pointer-events-none rounded-sm"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Collapsible Text Panel */}
        {hasDescription && (
          <div 
            className={`relative bg-slate-800/95 backdrop-blur-md border-l border-slate-700 transition-all duration-300 ease-in-out flex flex-col ${isPanelOpen ? 'w-[40%] opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}
          >
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-50 bg-slate-700 hover:bg-emerald-500 text-white rounded-full p-1 shadow-lg border border-slate-600 cursor-pointer transition-colors"
            >
              {isPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <div className="p-6 h-full overflow-y-auto w-full">
              <h3 className="text-emerald-400 font-bold text-lg mb-4 uppercase tracking-wider font-mono">
                {('title' in (currentNode || {})) ? (currentNode as InteractiveImageDef).title : 'Details'}
              </h3>
              <div 
                className="prose prose-invert prose-sm max-w-none text-slate-300 font-serif leading-relaxed"
                dangerouslySetInnerHTML={{ __html: currentDesc || '' }}
              />
            </div>
          </div>
        )}
        
        {/* Button to open panel if it's closed and description exists */}
        {hasDescription && !isPanelOpen && (
          <button
            onClick={() => setIsPanelOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-40 bg-slate-700/80 hover:bg-emerald-500 text-white rounded-l-lg p-2 shadow-lg backdrop-blur cursor-pointer transition-colors border-y border-l border-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
