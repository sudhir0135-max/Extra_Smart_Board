import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { dbLocal } from '../lib/db';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, Upload } from 'lucide-react';

export default function SyncManager() {
  const offlineBooks = useLiveQuery(() => dbLocal.offline_lessons.toArray());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ found: number; success: number; failed: number; time: number } | null>(null);

  const pendingBooks = offlineBooks?.filter(b => b.sync_status === 'pending' || b.sync_status === 'failed') || [];

  const handleSync = async () => {
    if (pendingBooks.length === 0) return;
    
    setIsSyncing(true);
    setSyncSummary(null);
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;

    for (const b of pendingBooks) {
      try {
        const bookIdStr = b.bookId.toString();
        const lessons = b.lessons || [];

        // Batch write lessons into the subcollection to avoid 1MB limit
        const BATCH_SIZE = 20;
        for (let i = 0; i < lessons.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = lessons.slice(i, i + BATCH_SIZE);
          chunk.forEach((lesson) => {
            const lessonRef = doc(collection(db, 'books', bookIdStr, 'lessons'), lesson.id);
            batch.set(lessonRef, lesson);
          });
          await batch.commit();
        }
        
        // Remove local cache to allow Firebase state to override
        await dbLocal.offline_lessons.delete(b.bookId);
        successCount++;
      } catch (err) {
        console.error(`Failed to sync book ${b.bookId}`, err);
        await dbLocal.offline_lessons.update(b.bookId, { sync_status: 'failed' });
        failedCount++;
      }
    }

    setIsSyncing(false);
    setSyncSummary({
      found: pendingBooks.length,
      success: successCount,
      failed: failedCount,
      time: Date.now() - startTime
    });
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Cloud className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white font-serif">Offline Synchronization</h2>
          <p className="text-sm text-slate-400 font-mono">Push local lesson changes to Firebase</p>
        </div>
      </div>

      <div className="bg-slate-950 rounded-lg p-5 border border-slate-800 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-slate-300 font-bold font-sans">Pending Uploads</h3>
            <p className="text-xs text-slate-500 mt-1">There are {pendingBooks.length} books with offline lesson modifications waiting to be verified and synced.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to discard all local offline edits? This will permanently wipe your offline cache and fetch the live Firebase data.")) {
                  await dbLocal.offline_lessons.clear();
                }
              }}
              disabled={isSyncing || pendingBooks.length === 0}
              className={`px-4 py-2 rounded-lg font-bold font-mono text-xs flex items-center gap-2 transition-colors ${
                isSyncing || pendingBooks.length === 0 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-rose-900/40 hover:bg-rose-600 text-rose-300 hover:text-white cursor-pointer shadow-lg shadow-rose-900/20'
              }`}
            >
              Discard Local Edits
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing || pendingBooks.length === 0}
              className={`px-4 py-2 rounded-lg font-bold font-mono text-xs flex items-center gap-2 transition-colors ${
                isSyncing || pendingBooks.length === 0 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-lg shadow-amber-900/20'
              }`}
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isSyncing ? 'Synchronizing...' : 'Upload to Firebase'}
            </button>
          </div>
        </div>
      </div>

      {syncSummary && (
        <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800 space-y-3">
          <h4 className="text-sm font-bold text-white mb-2">Last Sync Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Found</span>
              <span className="text-lg font-bold text-white">{syncSummary.found}</span>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-emerald-900/30">
              <span className="text-[10px] text-emerald-500 uppercase font-mono block flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Success</span>
              <span className="text-lg font-bold text-emerald-400">{syncSummary.success}</span>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-rose-900/30">
              <span className="text-[10px] text-rose-500 uppercase font-mono block flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Failed</span>
              <span className="text-lg font-bold text-rose-400">{syncSummary.failed}</span>
            </div>
            <div className="bg-slate-900 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Time Taken</span>
              <span className="text-lg font-bold text-white">{(syncSummary.time / 1000).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


