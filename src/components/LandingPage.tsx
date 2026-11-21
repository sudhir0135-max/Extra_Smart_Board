/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BookOpen, PenTool, PlayCircle, ListChecks, WifiOff, ChevronLeft, ChevronRight, ArrowRight, Download, RefreshCw, Layers } from 'lucide-react';

interface LandingPageProps {
  onEnterStudents: () => void;
  onEnterEditors: () => void;
  onEnterAdmin: () => void;
  onEnterDownloadExtra: () => void;
  onEnterSimulator: () => void;
  onDemoImageFrame?: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  booksCount: number;
  editorsCount: number;
  globalLogo?: string | null;
}

/**
 * Landing-page photos come from the "branding" folder in Firebase Storage: every file named
 * slide1, slide2, … (.webp / .jpg / .png) is shown, in number order. Add or remove files there to
 * change the slides; no code change needed. These texts rotate across however many photos there are.
 */
const SLIDE_TEXTS = [
  {
    kicker: 'Smart classroom',
    title: 'Every chapter, ready on the smartboard',
    text: 'Textbooks laid out topic by topic, with pages, pictures and lecture videos in one place, so the whole class follows along together.',
  },
  {
    kicker: 'Practice that sticks',
    title: 'Questions that make learning stick',
    text: 'Flash retrieval cards with team scores, extra questions sorted by source, and accountancy problems with ready-made journal and ledger tables.',
  },
  {
    kicker: 'Teach your way',
    title: 'A greenboard beside every page',
    text: 'Slide out the greenboard to write, highlight and solve right next to the lesson, without leaving the chapter.',
  },
  {
    kicker: 'Works offline',
    title: 'Keeps teaching when the internet stops',
    text: 'Books, questions, pictures and PDFs are saved on the device and update quietly in the background whenever a connection is available.',
  },
];

const SLIDE_CACHE_KEY = 'ep_landing_slides_v1';

/** Lists branding/slideN images in Firebase Storage (cached so the next visit starts instantly). */
async function loadBrandingSlides(): Promise<string[]> {
  const { storage } = await import('../lib/firebase');
  const { ref, listAll, getDownloadURL } = await import('firebase/storage');
  const res = await listAll(ref(storage, 'branding'));
  const slides = res.items
    .map(item => ({ item, m: item.name.match(/^slide\s*(\d+)\.(webp|jpe?g|png|avif)$/i) }))
    .filter(x => x.m)
    .sort((a, b) => Number(a.m![1]) - Number(b.m![1]));
  return Promise.all(slides.map(x => getDownloadURL(x.item)));
}

const FEATURES = [
  { icon: BookOpen, label: 'Digital Textbooks', bg: 'bg-[#3b7ddd]' },
  { icon: PenTool, label: 'Greenboard', bg: 'bg-[#8bc34a]' },
  { icon: PlayCircle, label: 'Video Lessons', bg: 'bg-[#f06b6b]' },
  { icon: ListChecks, label: 'Practice Questions', bg: 'bg-[#f5a623]' },
  { icon: WifiOff, label: 'Works Offline', bg: 'bg-[#26a69a]' },
  { icon: Layers, label: 'PDF & HTML Chapters', bg: 'bg-[#8e6fd8]' },
];

const SLIDE_MS = 7000;

export default function LandingPage({
  onEnterDownloadExtra,
  onSignIn,
  onSignUp,
  globalLogo,
}: LandingPageProps) {
  const apkUrl = "/ExtraPadhai.apk";
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [featureStart, setFeatureStart] = useState(0);
  const [images, setImages] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(SLIDE_CACHE_KEY) || '[]'); } catch { return []; }
  });

  // Photos from Firebase Storage "branding/slideN"
  useEffect(() => {
    let alive = true;
    loadBrandingSlides()
      .then(urls => {
        if (!alive || urls.length === 0) return;
        setImages(urls);
        try { localStorage.setItem(SLIDE_CACHE_KEY, JSON.stringify(urls)); } catch { /* ignore */ }
      })
      .catch(err => console.warn('[landing] could not load slides:', err));
    return () => { alive = false; };
  }, []);

  const count = Math.max(images.length, SLIDE_TEXTS.length);
  const loadedRef = React.useRef<Set<string>>(new Set());
  // Rotate the hero photos; only move on to a photo once it has finished downloading
  useEffect(() => {
    if (paused) return;
    let t: number;
    const advance = () => {
      const next = (active + 1) % count;
      const nextImg = images.length ? images[next % images.length] : null;
      if (nextImg && !loadedRef.current.has(nextImg)) { t = window.setTimeout(advance, 500); return; }
      setActive(next);
    };
    t = window.setTimeout(advance, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [active, paused, count, images]);

  const go = (dir: number) => setActive(i => (i + dir + count) % count);
  const slide = SLIDE_TEXTS[active % SLIDE_TEXTS.length];
  const activeImage = images.length ? active % images.length : -1;
  const visibleFeatures = [0, 1, 2].map(k => FEATURES[(featureStart + k) % FEATURES.length]);

  const resetCache = () => {
    if (!window.confirm("Are you sure you want to clear all local cache, configured classes, and notes? This will reload the app.")) return;
    localStorage.clear();
    try { indexedDB.deleteDatabase("OfflineSmartboardLocalDB"); } catch (e) {}
    if (typeof (window as any).Capacitor !== 'undefined') {
      import('@capacitor/preferences')
        .then(({ Preferences }) => Preferences.clear().then(() => window.location.reload()))
        .catch(() => window.location.reload());
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen w-full bg-white text-[#0e2240] flex flex-col font-sans" id="landing-page-container">
      <style>{`
        @keyframes epKenBurns { from { transform: scale(1); } to { transform: scale(1.09); } }
        @keyframes epRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .ep-head { font-family: Manrope, Inter, 'Segoe UI', Roboto, system-ui, sans-serif; letter-spacing: -0.01em; }
        #landing-page-container { font-family: Inter, 'Segoe UI', Roboto, system-ui, sans-serif; }
        .ep-rise { animation: epRise .8s ease both; }
        .ep-rise-2 { animation: epRise .8s .12s ease both; }
        .ep-rise-3 { animation: epRise .8s .24s ease both; }
        @media (prefers-reduced-motion: reduce) { .ep-kb, .ep-rise, .ep-rise-2, .ep-rise-3 { animation: none !important; } }
      `}</style>

      {/* ── HERO with rotating, slowly zooming photos ── */}
      <section
        className="relative w-full min-h-[680px] h-[92svh] max-h-[860px] overflow-hidden bg-[#0e2240] flex flex-col"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {images.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in-out ${i === activeImage ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={i !== activeImage}
          >
            <img
              src={src}
              alt=""
              className="ep-kb absolute inset-0 w-full h-full object-cover"
              style={{ animation: i === activeImage ? `epKenBurns ${SLIDE_MS + 1500}ms ease-out forwards` : 'none' }}
              loading="eager"
              decoding="async"
              onLoad={() => { loadedRef.current.add(src); }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        ))}
        {/* Readability overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1b33]/90 via-[#0b1b33]/60 to-[#0b1b33]/20" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#0b1b33]/70 to-transparent" />

        {/* Header */}
        <header className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {globalLogo ? (
              <img src={globalLogo} alt="Extrapadhai logo" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-white/90 p-1 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#f5b301] flex items-center justify-center text-[#0e2240]">
                <BookOpen className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="ep-head font-extrabold text-white text-base sm:text-lg leading-tight truncate">Extrapadhai.com</div>
              <div className="hidden sm:block text-[11px] text-white/70 tracking-wide">Smartboard textbook suite</div>
            </div>
          </div>
          <nav className="flex items-center gap-1.5 sm:gap-5 text-sm shrink-0 whitespace-nowrap">
            <a href="#features" className="hidden md:inline text-white/85 hover:text-white font-medium">Features</a>
            <a href="#contact" className="hidden md:inline text-white/85 hover:text-white font-medium">Contact</a>
            <button onClick={onSignIn} className="text-white/90 hover:text-white font-semibold px-1.5 sm:px-2 py-1.5 cursor-pointer">Sign In</button>
            <button onClick={onSignUp} className="bg-white text-[#0e2240] hover:bg-[#f5b301] font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors cursor-pointer">Sign Up</button>
          </nav>
        </header>

        {/* Slide text */}
        <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 flex-1 flex items-center pt-8 pb-36 sm:pb-40">
          <div key={active} className="max-w-xl">
            <div className="ep-rise inline-block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#f5b301] mb-3">{slide.kicker}</div>
            <h1 className="ep-rise ep-head font-extrabold text-white text-[34px] leading-[1.12] sm:text-5xl sm:leading-[1.1]">
              {slide.title}
            </h1>
            <p className="ep-rise-2 mt-4 text-white/85 text-[15px] sm:text-base leading-relaxed max-w-lg">{slide.text}</p>
            <div className="ep-rise-3 mt-7 flex flex-wrap gap-3">
              <button
                onClick={onEnterDownloadExtra}
                className="flex items-center gap-2 bg-[#f5b301] hover:bg-[#ffc626] text-[#0e2240] font-bold text-sm px-6 py-3 rounded-md shadow-lg shadow-black/20 transition-colors cursor-pointer"
              >
                Start Learning <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={apkUrl}
                download="ExtraPadhai.apk"
                className="flex items-center gap-2 border-2 border-[#f5b301] text-[#f5b301] hover:bg-[#f5b301] hover:text-[#0e2240] font-bold text-sm px-6 py-[10px] rounded-md transition-colors"
              >
                <Download className="w-4 h-4" /> Download App
              </a>
            </div>
          </div>
        </div>

        {/* Slide controls */}
        <div className="absolute z-20 right-4 sm:right-8 bottom-32 sm:bottom-36 flex items-center gap-3">
          <button onClick={() => go(-1)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur cursor-pointer" aria-label="Previous slide"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex gap-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <button key={i} onClick={() => setActive(i)} aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${i === active ? 'w-7 bg-[#f5b301]' : 'w-3 bg-white/50 hover:bg-white/80'}`} />
            ))}
          </div>
          <button onClick={() => go(1)} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur cursor-pointer" aria-label="Next slide"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </section>

      {/* ── Overlapping feature panel ── */}
      <section id="features" className="relative z-20 max-w-5xl w-full mx-auto px-4 sm:px-6 -mt-20 sm:-mt-24">
        <div className="bg-[#0e2240] rounded-lg shadow-2xl shadow-[#0e2240]/30 px-5 sm:px-8 py-7 sm:py-8 flex flex-col md:flex-row md:items-center gap-6">
          <h2 className="ep-head font-extrabold text-white text-2xl sm:text-[28px] leading-tight md:w-56 shrink-0">
            One app for the whole classroom
          </h2>
          <div className="flex-1 flex items-center gap-3">
            <button onClick={() => setFeatureStart(s => (s - 1 + FEATURES.length) % FEATURES.length)} className="hidden sm:flex w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center cursor-pointer" aria-label="Previous features"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex-1 grid grid-cols-3 gap-3 sm:gap-4">
              {visibleFeatures.map(f => (
                <div key={f.label} className={`${f.bg} rounded-md aspect-[1/1] sm:aspect-[6/5] flex flex-col items-center justify-center gap-2 sm:gap-3 text-white text-center px-2 shadow-md`}>
                  <f.icon className="w-8 h-8 sm:w-11 sm:h-11" strokeWidth={1.4} />
                  <span className="text-[11px] sm:text-sm font-bold leading-tight">{f.label}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setFeatureStart(s => (s + 1) % FEATURES.length)} className="hidden sm:flex w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center cursor-pointer" aria-label="Next features"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </section>

      {/* ── What the app does ── */}
      <section className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-14 sm:py-16 grid gap-10 md:grid-cols-3">
        {[
          { icon: BookOpen, title: 'Built around your textbooks', text: 'Chapters follow the book: topics, pages, PDFs and interactive HTML pages, with lecture videos linked to each topic.' },
          { icon: ListChecks, title: 'Practice in class, together', text: 'Retrieval cards for quick recall with team scoring, plus extra questions by source, with answers revealed when you choose.' },
          { icon: RefreshCw, title: 'Always up to date, even offline', text: 'Content is saved on the device for no-internet classrooms and refreshes automatically in the background when online.' },
        ].map(f => (
          <div key={f.title}>
            <div className="w-11 h-11 rounded-md bg-[#fff4d1] text-[#b07d00] flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5" />
            </div>
            <h3 className="ep-head font-extrabold text-lg text-[#0e2240]">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="mt-auto bg-[#0b1b33] text-white/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-sm">
            <a href="https://wa.me/919990793355" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-[#f5b301] transition-colors" title="Chat with us on WhatsApp">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span className="font-semibold">+91 9990793355</span>
            </a>
            <a href="mailto:support@extrapadhai.com" className="flex items-center gap-2 hover:text-[#f5b301] transition-colors" title="Email support">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span className="font-semibold">support@extrapadhai.com</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[11px] text-white/50">© {new Date().getFullYear()} Extrapadhai Smartboard</p>
            <button onClick={resetCache} className="text-[10px] font-semibold uppercase tracking-wider text-white/40 hover:text-rose-300 border border-white/15 hover:border-rose-400/50 rounded px-2 py-1 cursor-pointer transition-colors" title="Clear local cache, classes and notes on this device">
              Reset cache
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
