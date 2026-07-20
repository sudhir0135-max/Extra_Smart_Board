import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Copy, CheckCircle2, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { fetchAllUploadedImages, uploadImageToStorage, deleteFileFromStorage } from '../lib/firebaseHelper';

interface AssetLibraryModalProps {
  isOpen: boolean;
  folderPath?: string;
  subjects?: any[];
  onClose: () => void;
  onSelect?: (url: string) => void;
}

export default function AssetLibraryModal({ isOpen, folderPath = 'images', subjects, onClose, onSelect }: AssetLibraryModalProps) {
  const [currentFolder, setCurrentFolder] = useState<string>(folderPath);
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentFolder(folderPath);
    }
  }, [isOpen, folderPath]);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen, currentFolder]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const items = await fetchAllUploadedImages(currentFolder);
      // Sort by name descending (since we prefix with timestamp)
      items.sort((a, b) => b.name.localeCompare(a.name));
      setImages(items);
    } catch (err) {
      console.error('Error loading images:', err);
    } finally {
      setLoading(false);
    }
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

  const handleImageClick = (url: string) => {
    if (onSelect) {
      onSelect(url);
      onClose();
    } else {
      navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const handleDeleteImage = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this image from the Asset Library?")) return;
    
    setLoading(true);
    try {
      await deleteFileFromStorage(url);
      await loadImages();
    } catch (err) {
      console.error('Error deleting image:', err);
      setLoading(false);
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
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Asset Library</h2>
                <p className="text-sm text-slate-400">
                  {onSelect ? 'Select an image to use, or upload a new one.' : 'Manage your uploaded images or upload new assets.'}
                </p>
              </div>
              
              {subjects && subjects.length > 0 && (
                <div className="ml-4 border-l border-slate-700 pl-4">
                  <select
                    value={currentFolder}
                    onChange={(e) => setCurrentFolder(e.target.value)}
                    className="bg-slate-800 text-sm text-slate-200 rounded px-3 py-1.5 border border-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="images">Global Assets (Root)</option>
                    {subjects.map(s => (
                      <option key={s.id} value={`images/subjects/${s.name}`}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Upload Dropzone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/30 hover:bg-indigo-500/5 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileUpload}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-slate-300 font-medium">Uploading image...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-slate-800 rounded-full group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-300">
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
                </div>
                <div className="text-center">
                  <span className="text-indigo-400 font-medium">Click to upload</span>
                  <span className="text-slate-400 ml-1">or drag and drop</span>
                </div>
                <p className="text-xs text-slate-500">SVG, PNG, JPG or GIF (max. 10MB)</p>
              </div>
            )}
          </div>

          {/* Grid */}
          <div>
            <h3 className="text-sm font-bold tracking-wider text-slate-500 uppercase mb-4">Previously Uploaded</h3>
            
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center p-12 border border-slate-800 border-dashed rounded-xl bg-slate-800/10 text-slate-500">
                No images found in your library yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((img, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleImageClick(img.url)}
                    className="group relative aspect-square bg-black rounded-xl border border-slate-700 overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors"
                  >
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm gap-2">
                      {onSelect ? (
                        <span className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg">
                          Select Image
                        </span>
                      ) : (
                        <>
                          <span className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg shadow-lg flex items-center gap-1.5">
                            {copiedUrl === img.url ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedUrl === img.url ? 'Copied!' : 'Copy URL'}
                          </span>
                          <button 
                            onClick={(e) => handleDeleteImage(img.url, e)}
                            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
