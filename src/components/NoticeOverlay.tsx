/**
 * Shows the admin's notice images over the book shelf page on the days they are scheduled.
 * Images come from the copy saved on the device (lib/notices.ts), so this also works offline.
 * Shown every time the book shelf page opens; closing hides it for this visit only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getActiveSavedNotices, DisplayNotice, NOTICES_UPDATED_EVENT, syncNoticeImages } from '../lib/notices';

export default function NoticeOverlay() {
  const [notices, setNotices] = useState<DisplayNotice[]>([]);
  const [index, setIndex] = useState(0);
  const closedRef = React.useRef(false); // closed during this visit to the book shelf

  const load = useCallback(async () => {
    const { notices: all, release } = await getActiveSavedNotices();
    setNotices(closedRef.current ? [] : all);
    setIndex(0);
    return release;
  }, []);

  useEffect(() => {
    let release: (() => void) | undefined;
    let alive = true;
    const refresh = () => {
      load().then(r => {
        if (!alive) { r(); return; }
        release?.();
        release = r;
      }).catch(() => {});
    };
    refresh();
    syncNoticeImages().catch(() => {}); // fetch new notices if online (fires the event when something changed)
    window.addEventListener(NOTICES_UPDATED_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(NOTICES_UPDATED_EVENT, refresh);
      release?.();
    };
  }, [load]);

  if (notices.length === 0) return null;
  const current = notices[Math.min(index, notices.length - 1)];
  const many = notices.length > 1;

  const close = () => {
    closedRef.current = true;
    setNotices([]);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
      onClick={close}
      id="notice-overlay"
    >
      <div className="relative max-w-[92vw] max-h-[88vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <img
          src={current.src}
          alt="Notice"
          className="max-w-[92vw] max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10 bg-slate-900"
          onError={() => setNotices(list => list.filter(n => n.id !== current.id))}
        />

        <button
          onClick={close}
          className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white text-slate-900 shadow-lg flex items-center justify-center hover:bg-slate-200 active:scale-95 transition"
          title="Close"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {many && (
          <>
            <button
              onClick={() => setIndex(i => (i - 1 + notices.length) % notices.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => setIndex(i => (i + 1) % notices.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="mt-3 flex gap-2">
              {notices.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => setIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
                  aria-label={`Notice ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
