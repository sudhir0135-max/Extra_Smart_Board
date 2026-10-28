/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Chapter Recovery Tool  —  open at  /recover?book=<bookId>
 *
 * Finds surviving copies of a book's chapters and restores the ones missing from the live
 * database, without touching chapters that are still live.
 *
 * It runs INSTEAD of the main app (see main.tsx) so nothing re-syncs this browser's offline data
 * before it is read. Local copies are read FIRST (this device's offline store and the Firestore
 * cache); the live database is only queried after that, because a live query can clear the cache.
 *
 * Sources scanned:
 *   1. This device — offline chapter store (IndexedDB "SingleScreenOfflineDB")
 *   2. This device — Firestore offline cache (live chapters + editor submissions)
 *   3. Firebase Storage — large-chapter backups   books/{id}/lessons/{chapterId}/payload.json
 *   4. Firebase Storage — large editor submissions editor_submissions/{id}/lessons/{chapterId}/payload.json
 */
import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection, doc, getDocsFromCache, getDocsFromServer, getDocFromServer, setDoc, updateDoc,
} from 'firebase/firestore';
import { ref, listAll, getDownloadURL, getMetadata } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { dbLocal } from '../lib/db';
import { uploadLargeLessonPayload } from '../lib/firebaseHelper';
import { Lesson } from '../types';

type Version = {
  key: string;
  chapterId: string;
  source: string;
  savedAt: string | null; // ISO date if known
  lesson: Lesson & { order?: number };
};

const count = (a: any) => (Array.isArray(a) ? a.length : 0);
const stats = (l: any) => {
  const topics = count(l.topics);
  const pages = count(l.pages) + (l.topics || []).reduce((n: number, t: any) => n + count(t.pages), 0);
  // Topic questions are usually also stored at chapter level: count each question once
  const qKey = (q: any) => (typeof q === 'string' ? q : (q?.id || q?.text || JSON.stringify(q)));
  const inquiry = new Set([...(l.inquiryQuestions || []), ...(l.topics || []).flatMap((t: any) => t.inquiryQuestions || [])].map(qKey)).size;
  const flash = new Set([...(l.flashQuestions || []), ...(l.topics || []).flatMap((t: any) => t.flashQuestions || [])].map(qKey)).size;
  return { topics, pages, inquiry, flash, score: pages * 10 + inquiry + flash + topics * 5 };
};
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'date unknown');

async function resolvePayload(data: any): Promise<any | null> {
  if (!data?.payloadUrl) return data;
  try {
    const r = await fetch(data.payloadUrl, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export default function ChapterRecoveryTool() {
  const params = new URLSearchParams(window.location.search);
  const [bookIdInput, setBookIdInput] = useState(params.get('book') || '');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [liveIds, setLiveIds] = useState<Set<string> | null>(null);
  const [liveOrders, setLiveOrders] = useState<number[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({}); // chapterId -> version key ('' = skip)
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  const say = (m: string) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()}  ${m}`]);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); }), []);

  const scan = async () => {
    const bookId = bookIdInput.trim();
    if (!bookId) return;
    setScanning(true);
    setVersions([]); setLiveIds(null); setChoice({}); setDone([]); setLog([]);
    const found: Version[] = [];
    const add = (chapterId: string, source: string, savedAt: string | null, lesson: any) => {
      if (!lesson || !chapterId) return;
      found.push({ key: `${source}|${chapterId}|${found.length}`, chapterId, source, savedAt, lesson: { ...lesson, id: chapterId } });
    };

    // 1. Offline chapter store on this device (read before anything touches the network)
    try {
      const row = await dbLocal.offline_lessons.get(Number(bookId));
      (row?.lessons || []).forEach((l: any) => add(l.id, 'This device · offline copy', row?.updated_at || null, l));
      say(`This device offline copy: ${row?.lessons?.length || 0} chapter(s)${row?.updated_at ? ` (saved ${fmt(row.updated_at)})` : ''}.`);
    } catch (e: any) { say(`This device offline copy: not readable (${e?.message || e}).`); }

    // 2. Firestore offline cache on this device
    for (const [label, path] of [['This device · cached live chapter', ['books', bookId, 'lessons']], ['This device · cached editor submission', ['editor_submissions', bookId, 'lessons']]] as const) {
      try {
        const snap = await getDocsFromCache(collection(db, ...(path as unknown as [string, string, string])));
        let n = 0;
        for (const d of snap.docs) {
          const full = await resolvePayload(d.data());
          if (full) { add(d.id, label, null, full); n++; }
        }
        say(`${label}: ${n} chapter(s).`);
      } catch (e: any) { say(`${label}: none (${e?.code || e?.message || e}).`); }
    }

    // 3 & 4. Firebase Storage large-chapter copies
    for (const [label, base] of [['Cloud backup (large chapter copy)', `books/${bookId}/lessons`], ['Cloud backup (editor submission copy)', `editor_submissions/${bookId}/lessons`]] as const) {
      try {
        const lst = await listAll(ref(storage, base));
        let n = 0;
        for (const folder of lst.prefixes) {
          const inner = await listAll(folder);
          for (const item of inner.items.filter(i => i.name.endsWith('.json'))) {
            try {
              const [meta, url] = await Promise.all([getMetadata(item), getDownloadURL(item)]);
              const json = await fetch(url, { cache: 'no-store' }).then(r => r.json());
              add(folder.name, label, meta.updated || null, json);
              n++;
            } catch (e: any) { say(`  Could not read ${item.fullPath}: ${e?.message || e}`); }
          }
        }
        say(`${label}: ${n} chapter(s).`);
      } catch (e: any) { say(`${label}: not readable (${e?.code || e?.message || e}).`); }
    }

    // 5. Live database LAST (so it can't clear the cache before we've read it)
    try {
      const live = await getDocsFromServer(collection(db, 'books', bookId, 'lessons'));
      setLiveIds(new Set(live.docs.map(d => d.id)));
      setLiveOrders(live.docs.map(d => Number((d.data() as any).order ?? 0)));
      say(`Live database: ${live.size} chapter(s) currently in the book.`);
    } catch (e: any) { say(`Live database: could not read (${e?.message || e}).`); }

    // Default choice per chapter: the newest dated copy, else the one with the most content
    const byChapter = new Map<string, Version[]>();
    found.forEach(v => byChapter.set(v.chapterId, [...(byChapter.get(v.chapterId) || []), v]));
    const def: Record<string, string> = {};
    byChapter.forEach((vs, id) => {
      const best = [...vs].sort((a, b) => {
        const ta = a.savedAt ? Date.parse(a.savedAt) : 0, tb = b.savedAt ? Date.parse(b.savedAt) : 0;
        if (tb !== ta) return tb - ta;
        return stats(b.lesson).score - stats(a.lesson).score;
      })[0];
      def[id] = best.key;
    });
    setVersions(found);
    setChoice(def);
    say(`Scan complete: ${byChapter.size} distinct chapter(s) found in surviving copies.`);
    setScanning(false);
  };

  const grouped = useMemo(() => {
    const m = new Map<string, Version[]>();
    versions.forEach(v => m.set(v.chapterId, [...(m.get(v.chapterId) || []), v]));
    return Array.from(m.entries()).sort((a, b) => {
      const oa = a[1][0].lesson.order ?? 999, ob = b[1][0].lesson.order ?? 999;
      return oa - ob || a[0].localeCompare(b[0]);
    });
  }, [versions]);

  const missing = grouped.filter(([id]) => liveIds && !liveIds.has(id));

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify({ bookId: bookIdInput, scannedAt: new Date().toISOString(), versions }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `book-${bookIdInput}-chapter-recovery-${Date.now()}.json`;
    a.click();
  };

  const restore = async () => {
    const bookId = bookIdInput.trim();
    if (!user) { say('Sign in first (open the main app, sign in as admin, then reload this page).'); return; }
    // Re-check live chapters right before writing, never overwrite a live chapter
    const live = await getDocsFromServer(collection(db, 'books', bookId, 'lessons'));
    const liveNow = new Set(live.docs.map(d => d.id));
    let nextOrder = Math.max(-1, ...live.docs.map(d => Number((d.data() as any).order ?? -1))) + 1;
    setRestoring(true);
    const restored: string[] = [];
    for (const [id] of missing) {
      const key = choice[id];
      if (!key) continue;
      if (liveNow.has(id)) { say(`Skipped "${id}": it is live again, not overwritten.`); continue; }
      const v = versions.find(x => x.key === key);
      if (!v) continue;
      try {
        const order = typeof v.lesson.order === 'number' ? v.lesson.order : nextOrder++;
        let docToWrite: any = JSON.parse(JSON.stringify({ ...v.lesson, id, order }));
        delete docToWrite.payloadUrl;
        if (new Blob([JSON.stringify(docToWrite)]).size > 750000) {
          // Store under a new Storage path so the original backup file is kept untouched
          const { pointerLesson } = await uploadLargeLessonPayload(docToWrite, `books/${bookId}/lessons/${id}/restored-${Date.now()}`);
          docToWrite = JSON.parse(JSON.stringify(pointerLesson));
        }
        await setDoc(doc(db, 'books', bookId, 'lessons', id), docToWrite);
        restored.push(id);
        say(`Restored "${v.lesson.title}" from: ${v.source}.`);
      } catch (e: any) {
        say(`FAILED to restore "${v.lesson.title}": ${e?.message || e}`);
      }
    }
    try {
      const after = await getDocsFromServer(collection(db, 'books', bookId, 'lessons'));
      const bookSnap = await getDocFromServer(doc(db, 'books', bookId));
      if (bookSnap.exists()) await updateDoc(doc(db, 'books', bookId), { lessonCount: after.size });
      setLiveIds(new Set(after.docs.map(d => d.id)));
      say(`Done. The book now has ${after.size} chapter(s).`);
    } catch (e: any) { say(`Chapter count update failed: ${e?.message || e}`); }
    setDone(restored);
    setRestoring(false);
  };

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-200 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-black text-amber-400">Chapter Recovery Tool</h1>
          <p className="text-xs text-slate-400 mt-1">
            Finds surviving copies of a book's chapters (this device and cloud backups) and restores only the chapters missing from the live book.
            Chapters that are still live are never overwritten. Close other tabs of this app before scanning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-[#0b0e1b] border border-slate-800 rounded-xl p-4">
          <label className="text-xs text-slate-400">Book ID</label>
          <input value={bookIdInput} onChange={e => setBookIdInput(e.target.value)} className="w-28 bg-[#03060c] border border-slate-700 rounded p-2 text-sm" />
          <button onClick={scan} disabled={scanning || !bookIdInput.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-xs font-bold uppercase">
            {scanning ? 'Scanning…' : 'Scan for copies'}
          </button>
          <span className="text-xs ml-auto">
            {!authReady ? 'Checking sign-in…' : user ? <span className="text-emerald-400">Signed in: {user.email}</span> : <span className="text-amber-400">Not signed in — scanning works, but restoring and editor-submission backups need an admin sign-in.</span>}
          </span>
        </div>

        {log.length > 0 && (
          <pre className="bg-black/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 whitespace-pre-wrap max-h-56 overflow-auto">{log.join('\n')}</pre>
        )}

        {grouped.length > 0 && (
          <div className="bg-[#0b0e1b] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Chapters found ({grouped.length}) — missing from live book: {missing.length}</h2>
              <button onClick={downloadBackup} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-bold">Download backup file</button>
            </div>
            {grouped.map(([id, vs]) => {
              const isLive = liveIds?.has(id);
              return (
                <div key={id} className={`rounded-lg border p-3 ${isLive ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-amber-600/50 bg-amber-950/20'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm">{vs[0].lesson.title || '(untitled)'} <span className="font-mono text-[10px] text-slate-500">{id}</span></div>
                    <span className={`text-[10px] font-mono font-bold uppercase ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isLive ? 'Live — will not be changed' : done.includes(id) ? 'Restored' : 'Missing from live book'}
                    </span>
                  </div>
                  {!isLive && (
                    <div className="mt-2 space-y-1">
                      {vs.map(v => {
                        const s = stats(v.lesson);
                        return (
                          <label key={v.key} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="radio" name={id} checked={choice[id] === v.key} onChange={() => setChoice(c => ({ ...c, [id]: v.key }))} />
                            <span className="text-slate-300">{v.source}</span>
                            <span className="text-slate-500">· {fmt(v.savedAt)} · {s.topics} topics, {s.pages} pages, {s.inquiry} questions, {s.flash} flashcards</span>
                          </label>
                        );
                      })}
                      <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-500">
                        <input type="radio" name={id} checked={!choice[id]} onChange={() => setChoice(c => ({ ...c, [id]: '' }))} /> Don't restore
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={restore}
              disabled={restoring || !user || missing.every(([id]) => !choice[id])}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-sm font-black uppercase"
            >
              {restoring ? 'Restoring…' : `Restore selected missing chapters`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
