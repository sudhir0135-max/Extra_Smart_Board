/**
 * Admin: notice images shown over the student book shelf between a start and an end date.
 * Stored in Firestore settings/notice_images; images in Storage images/notices/.
 */
import React, { useEffect, useState } from 'react';
import { Bell, Trash2, Upload, Save, RefreshCw } from 'lucide-react';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { uploadImageToStorage } from '../lib/firebaseHelper';
import { fetchNoticeList, saveNoticeList, NoticeImage, todayStr, isNoticeActive } from '../lib/notices';

const addDays = (yyyyMmDd: string, days: number) => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + days));
};
const fmt = (yyyyMmDd: string) => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function NoticeManager() {
  const [items, setItems] = useState<NoticeImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(addDays(todayStr(), 7));
  const [edits, setEdits] = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [fileInputKey, setFileInputKey] = useState(0);

  const reload = async () => {
    setLoading(true);
    try {
      setItems(await fetchNoticeList());
      setEdits({});
    } catch (e: any) {
      alert('Could not load notices: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleAdd = async () => {
    if (!file) { alert('Choose an image first.'); return; }
    if (!startDate || !endDate) { alert('Choose both dates.'); return; }
    if (endDate < startDate) { alert('End date cannot be before the start date.'); return; }
    setBusy(true);
    try {
      const imageUrl = await uploadImageToStorage(file, 'images/notices');
      const latest = await fetchNoticeList();
      const item: NoticeImage = {
        id: `notice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        imageUrl,
        startDate,
        endDate,
        title: title.trim() || file.name,
        createdAt: new Date().toISOString(),
      };
      await saveNoticeList([...latest, item]);
      pickFile(null);
      setTitle('');
      setFileInputKey(k => k + 1);
      await reload();
    } catch (e: any) {
      alert('Failed to add notice: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDates = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    if (e.endDate < e.startDate) { alert('End date cannot be before the start date.'); return; }
    setBusy(true);
    try {
      const latest = await fetchNoticeList();
      await saveNoticeList(latest.map(n => (n.id === id ? { ...n, startDate: e.startDate, endDate: e.endDate } : n)));
      await reload();
    } catch (err: any) {
      alert('Failed to save: ' + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (n: NoticeImage) => {
    if (!window.confirm(`Delete notice "${n.title || 'image'}"? It will disappear from all devices the next time they connect.`)) return;
    setBusy(true);
    try {
      const latest = await fetchNoticeList();
      await saveNoticeList(latest.filter(x => x.id !== n.id));
      try { await deleteObject(ref(storage, n.imageUrl)); } catch { /* file already gone */ }
      await reload();
    } catch (e: any) {
      alert('Failed to delete: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const today = todayStr();
  const status = (n: NoticeImage) =>
    n.endDate < today ? { label: 'Expired', cls: 'bg-slate-800 text-slate-400 border-slate-700' }
    : isNoticeActive(n, today) ? { label: 'Showing now', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
    : { label: 'Scheduled', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };

  const sorted = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="flex-1 overflow-y-auto p-6" id="notices-dashboard">
      <div className="max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> Notice Images
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Images shown over the student book shelf from the start date to the end date (both days included).
              Devices download them whenever they have internet, show them offline on those dates, and delete them after the end date.
            </p>
          </div>
          <button onClick={reload} disabled={loading || busy} className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Add notice */}
        <div className="bg-[#0b0e1b] border border-slate-800 p-5 rounded-xl space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Add a notice</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <label className="w-full md:w-56 h-40 shrink-0 rounded-lg border border-dashed border-slate-700 bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden hover:border-amber-500/60">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-500 flex flex-col items-center gap-2"><Upload className="w-5 h-5" /> Choose image</span>
              )}
              <input key={fileInputKey} type="file" accept="image/*" className="hidden" onChange={e => pickFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex-1 space-y-3">
              <div>
                <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">Name (for your reference)</span>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Diwali holidays"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">Start date</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">End date</span>
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <button onClick={handleAdd} disabled={busy || !file}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-4 h-4" /> {busy ? 'Saving…' : 'Upload notice'}
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">All notices ({items.length})</h3>
          {loading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-xs text-slate-500">No notices yet.</p>
          ) : sorted.map(n => {
            const s = status(n);
            const e = edits[n.id] || { startDate: n.startDate, endDate: n.endDate };
            const dirty = e.startDate !== n.startDate || e.endDate !== n.endDate;
            return (
              <div key={n.id} className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row gap-4 items-start">
                <img src={n.imageUrl} alt={n.title || 'Notice'} className="w-full sm:w-36 h-24 object-contain rounded-lg bg-slate-950 border border-slate-800" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-100 truncate">{n.title || 'Notice'}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{fmt(n.startDate)} → {fmt(n.endDate)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" value={e.startDate}
                      onChange={ev => setEdits(p => ({ ...p, [n.id]: { ...e, startDate: ev.target.value } }))}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-white [color-scheme:dark]" />
                    <span className="text-slate-600 text-xs">to</span>
                    <input type="date" value={e.endDate} min={e.startDate}
                      onChange={ev => setEdits(p => ({ ...p, [n.id]: { ...e, endDate: ev.target.value } }))}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-white [color-scheme:dark]" />
                    {dirty && (
                      <button onClick={() => handleSaveDates(n.id)} disabled={busy}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1">
                        <Save className="w-3 h-3" /> Save dates
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(n)} disabled={busy}
                  className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30" title="Delete notice" aria-label="Delete notice">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
