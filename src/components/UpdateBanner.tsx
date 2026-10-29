/**
 * Web only: notices when a newer version of the site has been deployed while this tab was open
 * (the tab keeps running the old code until it is reloaded) and offers a one-click reload.
 * Checks when the tab comes back into view and every 10 minutes. Not used in the Android app,
 * which ships its own copy of the app.
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const currentBundle = () => {
  const s = Array.from(document.scripts).find(x => /\/assets\/index-[^/]+\.js/.test(x.src));
  return s ? (s.src.match(/\/assets\/(index-[^/?#]+\.js)/) || [])[1] || null : null;
};

export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const mine = currentBundle();
    if (!mine) return; // dev server / unusual build: nothing to compare
    let stopped = false;
    const check = async () => {
      if (stopped || !navigator.onLine || document.visibilityState !== 'visible') return;
      try {
        const html = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' }).then(r => (r.ok ? r.text() : ''));
        const live = (html.match(/\/assets\/(index-[^"'/?#]+\.js)/) || [])[1];
        if (live && live !== mine) setAvailable(true);
      } catch { /* offline or blocked: try later */ }
    };
    const onVisible = () => check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    const timer = window.setInterval(check, 10 * 60 * 1000);
    const first = window.setTimeout(check, 30 * 1000);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, []);

  if (!available) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 bg-slate-900 text-slate-100 border border-emerald-500/40 shadow-2xl rounded-xl px-4 py-2.5 text-sm">
      <span>A new version of the app is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Reload
      </button>
      <span className="text-[11px] text-slate-400">Save your work first.</span>
    </div>
  );
}
