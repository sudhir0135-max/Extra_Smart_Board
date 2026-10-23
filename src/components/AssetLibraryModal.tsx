import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Copy, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon, 
  Trash2, 
  Check, 
  CheckSquare, 
  Square,
  FolderOpen
} from 'lucide-react';
import { fetchAllUploadedImages, uploadImageToStorage, deleteFileFromStorage } from '../lib/firebaseHelper';

interface AssetLibraryModalProps {
  isOpen: boolean;
  folderPath?: string;
  subjects?: any[];
  onClose: () => void;
  onSelect?: (url: string) => void;
}

export default function AssetLibraryModal({ 
  isOpen, 
  folderPath = 'images', 
  subjects, 
  onClose, 
  onSelect 
}: AssetLibraryModalProps) {
  const [currentFolder, setCurrentFolder] = useState<string>(folderPath);
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentFolder(folderPath);
      setSelectedUrls(new Set());
    }
  }, [isOpen, folderPath]);

  useEffect(() => {
    if (isOpen) {
      setSelectedUrls(new Set());
      loadImages();
    }
  }, [isOpen, currentFolder]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const items = await fetchAllUploadedImages(currentFolder);
      // Filter out keep files and sort by name descending
      const valid = items.filter(img => img.name !== '.keep' && !img.name.endsWith('.keep'));
      valid.sort((a, b) => b.name.localeCompare(a.name));
      setImages(valid);
    } catch (err) {
      console.error('Error loading images:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFolderDisplayName = () => {
    if (currentFolder === 'images') return 'Global Assets (Root)';
    const matchedSubject = subjects?.find(s => `images/subjects/${s.name}` === currentFolder);
    if (matchedSubject) return matchedSubject.name;
    if (currentFolder.startsWith('images/subjects/')) {
      return currentFolder.replace('images/subjects/', '');
    }
    return currentFolder;
  };

  const isAllSelected = images.length > 0 && selectedUrls.size === images.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(images.map(img => img.url)));
    }
  };

  const toggleSelectImage = (url: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImageToStorage(file, currentFolder);
      setImages(prev => [{ url, name: file.name }, ...prev]);
      if (onSelect) {
        onSelect(url);
        onClose();
      }
    } catch (err) {
      console.error('Error uploading image:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCardClick = (url: string) => {
    // If multi-select is currently active, clicking the card toggles its selection
    if (selectedUrls.size > 0) {
      toggleSelectImage(url);
      return;
    }

    if (onSelect) {
      onSelect(url);
      onClose();
    } else {
      navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const handleDeleteSingleImage = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this image from the Asset Library?")) return;
    
    setLoading(true);
    try {
      await deleteFileFromStorage(url);
      setSelectedUrls(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
      await loadImages();
    } catch (err) {
      console.error('Error deleting image:', err);
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedUrls.size === 0) return;
    const count = selectedUrls.size;
    const folderName = getFolderDisplayName();

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${count} selected image${count > 1 ? 's' : ''} from "${folderName}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeletingMultiple(true);
    setDeleteProgress({ current: 0, total: count });

    const urlsToDelete = Array.from(selectedUrls);
    let deletedCount = 0;
    let failedCount = 0;

    const chunkSize = 4;
    for (let i = 0; i < urlsToDelete.length; i += chunkSize) {
      const chunk = urlsToDelete.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map(async (url) => {
          try {
            await deleteFileFromStorage(url);
            deletedCount++;
          } catch (err) {
            console.error('Failed to delete image:', url, err);
            failedCount++;
          }
        })
      );
      setDeleteProgress({ current: Math.min(i + chunkSize, count), total: count });
    }

    setIsDeletingMultiple(false);
    setDeleteProgress(null);
    setSelectedUrls(new Set());
    await loadImages();

    if (failedCount > 0) {
      alert(`Deleted ${deletedCount} images. ${failedCount} images could not be deleted.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <ImageIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  Asset Library
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  {onSelect ? 'Select an image to use, or manage/upload assets.' : 'Manage your uploaded images or upload new assets.'}
                </p>
              </div>
              
              {subjects && subjects.length > 0 && (
                <div className="flex items-center gap-2 border-l border-slate-700 pl-3 sm:pl-4">
                  <FolderOpen className="w-4 h-4 text-indigo-400 hidden sm:inline-block" />
                  <select
                    value={currentFolder}
                    onChange={(e) => setCurrentFolder(e.target.value)}
                    disabled={isDeletingMultiple}
                    className="bg-slate-800 text-xs sm:text-sm text-slate-200 rounded-lg px-3 py-1.5 border border-slate-700 outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                  >
                    <option value="images">📁 Global Assets (Root)</option>
                    {subjects.map(s => (
                      <option key={s.id} value={`images/subjects/${s.name}`}>
                        📚 Subject: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isDeletingMultiple}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
            title="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Upload Dropzone */}
          <div 
            onClick={() => !isDeletingMultiple && fileInputRef.current?.click()}
            className={`border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/30 hover:bg-indigo-500/5 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-all group ${
              isDeletingMultiple ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isDeletingMultiple}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-slate-300 font-medium">Uploading image to {getFolderDisplayName()}...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-slate-800 rounded-full group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-300">
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
                </div>
                <div className="text-center">
                  <span className="text-indigo-400 font-medium text-sm">Click to upload image</span>
                  <span className="text-slate-400 text-sm ml-1">to {getFolderDisplayName()}</span>
                </div>
                <p className="text-xs text-slate-500">SVG, PNG, JPG, GIF or WebP (max. 10MB)</p>
              </div>
            )}
          </div>

          {/* Section Header & Bulk Operations Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/40 border border-slate-800 rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={images.length === 0 || isDeletingMultiple}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title={isAllSelected ? 'Deselect all images' : 'Select all images in this folder'}
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                </button>

                <span className="text-xs text-slate-400">
                  {images.length} {images.length === 1 ? 'image' : 'images'} in <span className="font-semibold text-slate-200">{getFolderDisplayName()}</span>
                </span>

                {selectedUrls.size > 0 && (
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold px-2.5 py-1 rounded-full animate-fadeIn">
                    {selectedUrls.size} selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedUrls.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedUrls(new Set())}
                      disabled={isDeletingMultiple}
                      className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Clear Selection
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      disabled={isDeletingMultiple}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 px-3.5 py-1.5 rounded-lg shadow-lg shadow-rose-950 transition-all cursor-pointer disabled:opacity-50"
                      title={`Permanently delete ${selectedUrls.size} selected images from ${getFolderDisplayName()}`}
                    >
                      {isDeletingMultiple ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Deleting {deleteProgress?.current || 0}/{deleteProgress?.total || selectedUrls.size}...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Selected ({selectedUrls.size})</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400">Loading assets from {getFolderDisplayName()}...</span>
              </div>
            ) : images.length === 0 ? (
              <div className="text-center p-12 border border-slate-800 border-dashed rounded-xl bg-slate-800/10 text-slate-500">
                No images found in "{getFolderDisplayName()}". Upload images using the box above.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {images.map((img) => {
                  const isSelected = selectedUrls.has(img.url);

                  return (
                    <div 
                      key={img.url}
                      onClick={() => handleCardClick(img.url)}
                      className={`group relative aspect-square bg-slate-950 rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 select-none ${
                        isSelected 
                          ? 'border-indigo-500 ring-2 ring-indigo-500/60 bg-indigo-950/30' 
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {/* Checkbox badge in top-left corner */}
                      <div 
                        className="absolute top-2 left-2 z-20"
                        onClick={(e) => toggleSelectImage(img.url, e)}
                      >
                        <button
                          type="button"
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400 scale-105' 
                              : 'bg-black/60 text-transparent hover:text-slate-300 hover:bg-black/90 border border-slate-600 backdrop-blur-sm group-hover:text-slate-400'
                          }`}
                          title={isSelected ? 'Deselect image' : 'Select image for deletion'}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      </div>

                      <img 
                        src={img.url} 
                        alt={img.name} 
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          isSelected ? 'opacity-90 scale-95' : 'opacity-80 group-hover:opacity-100 group-hover:scale-105'
                        }`}
                        loading="lazy"
                      />

                      {/* Filename caption bar */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-5 pointer-events-none z-10">
                        <p className="text-[10.5px] font-mono text-slate-300 truncate" title={img.name}>
                          {img.name}
                        </p>
                      </div>

                      {/* Hover action overlay */}
                      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px] gap-2 z-10 pointer-events-none">
                        <div className="pointer-events-auto flex flex-col items-center gap-2">
                          {selectedUrls.size > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => toggleSelectImage(img.url, e)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                                isSelected ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              {isSelected ? 'Deselect' : 'Select'}
                            </button>
                          ) : onSelect ? (
                            <span className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg">
                              Select Image
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(img.url);
                                  setCopiedUrl(img.url);
                                  setTimeout(() => setCopiedUrl(null), 2000);
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                {copiedUrl === img.url ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedUrl === img.url ? 'Copied!' : 'Copy URL'}
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => handleDeleteSingleImage(img.url, e)}
                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Delete single image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
