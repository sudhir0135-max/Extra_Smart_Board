/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, ShieldAlert, GraduationCap, PenTool, ArrowRight, Settings, Sparkles } from 'lucide-react';

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

export default function LandingPage({
  onEnterStudents,
  onEnterEditors,
  onEnterAdmin,
  onEnterDownloadExtra,
  onEnterSimulator,
  onDemoImageFrame,
  onSignIn,
  onSignUp,
  booksCount,
  editorsCount,
  globalLogo,
}: LandingPageProps) {
  return (
    <div className="min-h-screen w-full bg-[#070b13] text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden" id="landing-page-container">
      {/* Dynamic Grid Background Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* Decorative Blur Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

      {/* TOP HEADER */}
      <header className="px-6 py-5 max-w-7xl mx-auto w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2.5">
          {globalLogo ? (
            <img src={globalLogo} alt="Global Logo" className="w-8 h-8 rounded-lg object-contain bg-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold select-none shadow-md shadow-emerald-900/30">
              <BookOpen className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-base tracking-tight text-white font-sans">Extrapadhai.com</h1>

            </div>
            <p className="text-[10px] text-emerald-400 font-mono tracking-wider">OFFLINE-FIRST TEXTBOOK SUITE</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
          <button onClick={onSignIn} className="hover:text-emerald-400 font-bold transition-colors">Sign In</button>
          <button onClick={onSignUp} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-sans font-bold transition-colors shadow-lg shadow-emerald-900/20">Sign Up</button>
        </div>
      </header>

      {/* CORE DISPLAY HERO HERO */}
      <main className="flex-1 max-w-6xl mx-auto w-full flex flex-col justify-center items-center px-6 py-12 z-10 text-left gap-10">
        <div className="flex flex-col md:flex-row items-center w-full gap-10">
          <div className="space-y-6 flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 rounded-full text-[10px] font-bold tracking-wider uppercase animate-fade-in">
            Educational Framework v4.0
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black text-slate-100 font-sans tracking-tight leading-none max-w-xl">
            Empower Classrooms <br />
            With <span className="text-emerald-400 font-extrabold decoration-wavy underline decoration-emerald-800">Smart Curriculums</span>
          </h2>
          
          <p className="text-sm md:text-base text-slate-400 max-w-xl leading-relaxed">
            A cohesive hub designed for digital instruction, dynamic page markups, and offline synchronization. Select your customized clearance below to proceed.
          </p>
        </div>
        
        {/* Right side hero image */}
        <div className="flex-1 hidden md:flex justify-center animate-fade-in relative">
           {/* Decorative glow behind image */}
           <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-75 pointer-events-none" />
           <img 
             src="/smartboard1img.webp" 
             alt="Teacher with Smartboard" 
             className="w-[500px] h-auto object-contain drop-shadow-2xl z-10"
           />
        </div>
      </div>



        {/* ACTION BUTTONS */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-4xl mx-auto px-4">
          <button
            onClick={onEnterDownloadExtra}
            className="group relative px-8 py-5 bg-gradient-to-r from-emerald-900/40 to-indigo-900/40 hover:from-emerald-800/60 hover:to-indigo-800/60 border-2 border-emerald-500/50 hover:border-emerald-400 rounded-2xl text-emerald-300 hover:text-white font-extrabold tracking-widest transition-all duration-300 shadow-2xl shadow-emerald-900/20 hover:shadow-emerald-500/40 flex items-center justify-center gap-4 w-full sm:w-auto uppercase text-sm md:text-lg hover:scale-105 transform"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/0 via-emerald-400/10 to-emerald-400/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            Start Learning
          </button>

          <a
            href="/ExtraPadhai.apk"
            download="ExtraPadhai.apk"
            className="group relative px-8 py-5 bg-gradient-to-r from-slate-900/40 to-slate-800/40 hover:from-slate-800/60 hover:to-slate-700/60 border-2 border-slate-600/50 hover:border-slate-400 rounded-2xl text-slate-300 hover:text-white font-extrabold tracking-widest transition-all duration-300 shadow-2xl shadow-slate-900/20 hover:shadow-slate-500/40 flex items-center justify-center gap-4 w-full sm:w-auto uppercase text-sm md:text-lg hover:scale-105 transform"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-slate-400/0 via-slate-400/10 to-slate-400/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Download APK
          </a>


        </div>
      </main>

      {/* FOOTER METRICS & CONTACT */}
      <footer className="w-full py-8 mt-12 border-t border-slate-900 bg-[#04060b] text-center z-10 flex flex-col items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-slate-300 text-sm">
          <a href="https://wa.me/919990793355" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-emerald-400 transition-colors cursor-pointer" title="Chat with us on WhatsApp">
            {/* WhatsApp Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M16.5 16.5c-1.5 1.5-4 1.5-5.5 0l-4-4c-1.5-1.5-1.5-4 0-5.5.5-.5 1-.5 1.5 0l1.5 1.5c.5.5.5 1 0 1.5l-1.5 1.5c.5 1.5 2 3 3.5 3.5l1.5-1.5c.5-.5 1-.5 1.5 0l1.5 1.5c.5.5.5 1 0 1.5z"/></svg>
            <span className="font-semibold">+91 9990793355</span>
          </a>
          
          <a href="mailto:support@extrapadhai.com" className="flex items-center gap-2 hover:text-blue-400 transition-colors cursor-pointer" title="Email Support">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span className="font-semibold">support@extrapadhai.com</span>
          </a>
        </div>
        
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to clear all local cache, configured classes, and notes? This will reload the app.")) {
              localStorage.clear();
              try {
                indexedDB.deleteDatabase("OfflineSmartboardLocalDB");
              } catch(e){}
              
              if (typeof (window as any).Capacitor !== 'undefined') {
                import('@capacitor/preferences').then(({ Preferences }) => {
                  Preferences.clear().then(() => {
                    window.location.reload();
                  });
                }).catch(() => {
                  window.location.reload();
                });
              } else {
                window.location.reload();
              }
            }
          }}
          className="mt-1 px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-900/35 hover:border-rose-700 text-rose-350 hover:text-white rounded-lg text-[9px] font-bold tracking-widest uppercase cursor-pointer transition-all active:scale-95"
        >
          Reset System Cache
        </button>

        <p className="text-[10px] text-slate-500 font-mono tracking-wider mt-1">
          © {new Date().getFullYear()} EXTRAPADHAI SMARTBOARD • OFFLINE LEARNING ARCHITECTURE
        </p>
      </footer>
    </div>
  );
}

