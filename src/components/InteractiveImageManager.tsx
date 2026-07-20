import React, { useState, useRef } from 'react';
import { Map, Upload, Plus, Trash2, Edit, ChevronLeft, Image as ImageIcon } from 'lucide-react';
import { Editor } from '@tinymce/tinymce-react';
import { InteractiveImageDef, ImageHotspot } from '../types';

export interface InteractiveImageManagerProps {
  sequences: InteractiveImageDef[];
  onRequestAssetLibrary?: (onSelect: (url: string) => void) => void;
  onSequencesUpdate: (newSequences: InteractiveImageDef[]) => void;
}

export default function InteractiveImageManager({ sequences, onRequestAssetLibrary, onSequencesUpdate }: InteractiveImageManagerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftSeq, setDraftSeq] = useState<InteractiveImageDef | null>(null);
  
  // path represents indices to drill down. [] = root, [0] = first hotspot of root, etc.
  const [navPath, setNavPath] = useState<number[]>([]);

  // Helpers to get/set the current node being edited in the deep tree
  const getCurrentNode = () => {
    if (!draftSeq) return null;
    let node: any = draftSeq; // type it loosely for traversal
    for (let i = 0; i < navPath.length; i++) {
      node = node.hotspots[navPath[i]];
    }
    return node; // could be InteractiveImageDef or ImageHotspot
  };

  const updateCurrentNode = (updates: any) => {
    if (!draftSeq) return;
    const newSeq = JSON.parse(JSON.stringify(draftSeq)) as InteractiveImageDef;
    let node: any = newSeq;
    for (let i = 0; i < navPath.length; i++) {
      node = node.hotspots[navPath[i]];
    }
    Object.assign(node, updates);
    setDraftSeq(newSeq);
  };

  // Start adding a new sequence
  const handleAddNew = () => {
    setDraftSeq({
      id: `map-${Date.now()}`,
      title: 'New Interactive Map',
      rootImage: '',
      description: '',
      hotspots: []
    });
    setEditingIndex(null);
    setNavPath([]);
  };

  const handleEdit = (index: number) => {
    setDraftSeq(JSON.parse(JSON.stringify(sequences[index])));
    setEditingIndex(index);
    setNavPath([]);
  };

  const handleSave = () => {
    if (!draftSeq) return;
    if (!draftSeq.rootImage) {
      alert("Please upload a root image first.");
      return;
    }
    const newArr = [...sequences];
    if (editingIndex !== null) {
      newArr[editingIndex] = draftSeq;
    } else {
      newArr.push(draftSeq);
    }
    onSequencesUpdate(newArr);
    setDraftSeq(null);
    setEditingIndex(null);
    setNavPath([]);
  };

  const handleDelete = (index: number) => {
    if(confirm("Are you sure you want to delete this interactive map?")) {
      const newArr = [...sequences];
      newArr.splice(index, 1);
      onSequencesUpdate(newArr);
    }
  };

  // Image Upload helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isRoot: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (isRoot) {
        setDraftSeq(prev => prev ? { ...prev, rootImage: ev.target?.result as string } : null);
      } else {
        updateCurrentNode({ targetImage: ev.target?.result as string });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLibrarySelect = (url: string, isRoot: boolean) => {
    if (isRoot) {
      setDraftSeq(prev => prev ? { ...prev, rootImage: url } : null);
    } else {
      updateCurrentNode({ targetImage: url });
    }
  };

  // Drawing Hotspot logic
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const getPercentagePos = (e: React.MouseEvent) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getPercentagePos(e);
    setStartPos(pos);
    setCurrentBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getPercentagePos(e);
    const x = Math.min(startPos.x, pos.x);
    const y = Math.min(startPos.y, pos.y);
    const w = Math.abs(pos.x - startPos.x);
    const h = Math.abs(pos.y - startPos.y);
    setCurrentBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);
    if (currentBox.w > 2 && currentBox.h > 2) {
      // Add the new hotspot to current node
      const node = getCurrentNode();
      const newHotspot: ImageHotspot = {
        id: `hs-${Date.now()}`,
        x: currentBox.x,
        y: currentBox.y,
        width: currentBox.w,
        height: currentBox.h,
        targetImage: '',
        description: '',
        hotspots: []
      };
      updateCurrentNode({ hotspots: [...(node.hotspots || []), newHotspot] });
    }
    setCurrentBox(null);
  };

  return (
    <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-5 space-y-4 w-full">
      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-sans">
        <Map className="w-4 h-4 text-emerald-400" /> Interactive Deep-dive Maps
      </h3>

      {!draftSeq ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-mono text-slate-400">Your Sequences</span>
            <button
              onClick={handleAddNew}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add New Map
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sequences.length === 0 ? (
              <div className="col-span-full p-4 text-center text-slate-500 text-[11px] italic font-serif">
                No interactive maps created. Create one and link it via Text Annotations!
              </div>
            ) : (
              sequences.map((seq, idx) => (
                <div key={seq.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                  <div>
                    <h4 className="text-emerald-400 font-bold text-sm mb-1">{seq.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{seq.description || 'No description'}</p>
                    <p className="text-[9px] text-slate-500 mt-2">{seq.hotspots?.length || 0} top-level hotspots</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => handleEdit(idx)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-1 rounded text-[10px] font-bold uppercase transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(idx)} className="bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white px-2 py-1 rounded transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 bg-slate-950 border border-slate-850 p-4 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              {navPath.length > 0 && (
                <button
                  onClick={() => setNavPath(prev => prev.slice(0, -1))}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  title="Go Back Up"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold">
                {navPath.length === 0 ? 'Editing Root Map' : `Editing Hotspot Level ${navPath.length}`}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDraftSeq(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold uppercase transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold uppercase transition-colors"
              >
                Save Entire Sequence
              </button>
            </div>
          </div>

          {(() => {
            const node = getCurrentNode();
            if (!node) return null;
            const isRoot = navPath.length === 0;
            const imageUrl = isRoot ? node.rootImage : node.targetImage;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: Image and drawing */}
                <div className="lg:col-span-2 space-y-3">
                  <span className="text-[10px] text-slate-400 uppercase">Image Preview & Hotspots</span>
                  {imageUrl ? (
                    <div 
                      className="relative border-2 border-dashed border-emerald-500/30 rounded cursor-crosshair overflow-hidden group select-none"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <img 
                        ref={imageRef}
                        src={imageUrl} 
                        alt="Current level" 
                        className="w-full h-auto pointer-events-none"
                        draggable={false}
                      />
                      
                      {/* Render existing hotspots */}
                      {(node.hotspots || []).map((hs: ImageHotspot, i: number) => (
                        <div 
                          key={hs.id}
                          className="absolute border-2 border-dashed border-emerald-400/80 bg-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-500/40 transition-colors flex items-center justify-center cursor-pointer"
                          style={{ left: `${hs.x}%`, top: `${hs.y}%`, width: `${hs.width}%`, height: `${hs.height}%` }}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent drawing new box
                            setNavPath([...navPath, i]); // Drill down
                          }}
                        >
                          <span className="bg-emerald-900/80 text-emerald-300 text-[8px] px-1 rounded truncate max-w-full">
                            Drill Down
                          </span>
                        </div>
                      ))}

                      {/* Render drawing box */}
                      {isDrawing && currentBox && (
                        <div 
                          className="absolute border-2 border-sky-400 bg-sky-400/30 pointer-events-none"
                          style={{ left: `${currentBox.x}%`, top: `${currentBox.y}%`, width: `${currentBox.w}%`, height: `${currentBox.h}%` }}
                        />
                      )}
                      
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded backdrop-blur">
                        Click & Drag to define regions
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-700 bg-slate-800/30 rounded-xl h-64 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs mb-4">No image uploaded for this {isRoot ? 'root map' : 'hotspot target'}.</p>
                        <div className="flex items-center gap-2">
                          <label className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs cursor-pointer transition-colors flex items-center gap-2">
                            <Upload className="w-3 h-3" /> Upload Image
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, isRoot)} />
                          </label>
                          {onRequestAssetLibrary && (
                            <button
                              onClick={() => onRequestAssetLibrary((url) => handleLibrarySelect(url, isRoot))}
                              className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 px-4 py-2 rounded text-xs cursor-pointer transition-colors flex items-center gap-2 border border-indigo-500/30"
                            >
                              <ImageIcon className="w-3 h-3" /> Library
                            </button>
                          )}
                        </div>
                    </div>
                  )}

                  {imageUrl && (
                      <div className="flex items-center gap-4 mt-2">
                        <label className="text-[9px] text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1 font-mono uppercase">
                          <Upload className="w-3 h-3" /> Replace
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, isRoot)} />
                        </label>
                        {onRequestAssetLibrary && (
                          <button
                            onClick={() => onRequestAssetLibrary((url) => handleLibrarySelect(url, isRoot))}
                            className="text-[9px] text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 font-mono uppercase"
                          >
                            <ImageIcon className="w-3 h-3" /> Library
                          </button>
                        )}
                      </div>
                  )}
                </div>

                {/* Right side: Properties */}
                <div className="lg:col-span-1 space-y-4">
                  <span className="text-[10px] text-slate-400 uppercase">Properties</span>
                  
                  {isRoot && (
                    <div>
                      <label className="text-[9px] uppercase text-slate-500 mb-1 block">Title</label>
                      <input 
                        type="text" 
                        value={node.title || ''}
                        onChange={(e) => updateCurrentNode({ title: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-emerald-500"
                        placeholder="e.g. Map of Asia"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 mb-1 block">Details Panel Text</label>
                    <Editor
                      tinymceScriptSrc="/tinymce/tinymce.min.js"
                      value={node.description || ''}
                      onEditorChange={(content) => updateCurrentNode({ description: content })}
                      init={{
                        license_key: 'gpl',
                        height: 250,
                        menubar: false,
                        skin: 'oxide-dark',
                        content_css: 'dark',
                        plugins: ['lists', 'link', 'code', 'table'],
                        toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat'
                      }}
                    />
                  </div>
                  
                  {/* List of sub-hotspots so user can easily delete them */}
                  <div className="pt-4 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase mb-2 block">Regions ({node.hotspots?.length || 0})</span>
                    <div className="space-y-2">
                      {(node.hotspots || []).map((hs: ImageHotspot, i: number) => (
                        <div key={hs.id} className="bg-slate-900 p-2 rounded flex justify-between items-center text-xs border border-slate-800">
                          <span className="text-slate-300 truncate w-32">Region {i + 1}</span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setNavPath([...navPath, i])}
                              className="text-[9px] uppercase text-emerald-400 hover:text-emerald-300"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => {
                                const newHs = [...node.hotspots];
                                newHs.splice(i, 1);
                                updateCurrentNode({ hotspots: newHs });
                              }}
                              className="text-[9px] uppercase text-rose-400 hover:text-rose-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!node.hotspots || node.hotspots.length === 0) && (
                        <div className="text-[9px] italic text-slate-500 font-serif">No regions defined. Draw on the image to add one.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
