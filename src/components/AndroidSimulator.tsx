/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RotateCcw, 
  LogOut, 
  Battery, 
  Signal, 
  Info, 
  Tablet,
  ChevronLeft,
  Circle,
  Square,
  RotateCw
} from 'lucide-react';

interface AndroidSimulatorProps {
  children: React.ReactNode;
  isOnline: boolean;
  onToggleOnline: () => void;
  onWipeStorage: () => void;
  onExit: () => void;
  onAndroidBack: () => void;
  onAndroidHome: () => void;
}

export default function AndroidSimulator({
  children,
  isOnline,
  onToggleOnline,
  onWipeStorage,
  onExit,
  onAndroidBack,
  onAndroidHome
}: AndroidSimulatorProps) {
  const [time, setTime] = useState('');
  const [isLandscape, setIsLandscape] = useState(true);
  const [scale, setScale] = useState(1);

  // Dynamic clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Responsive scaling to fit tablet in viewport
  useEffect(() => {
    const handleResize = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      const targetWidth = isLandscape ? 1024 : 680;
      const targetHeight = isLandscape ? 680 : 1024;
      
      // Sidebar takes ~384px on large layouts (lg: min-width 1024px)
      const sidebarWidth = screenWidth >= 1024 ? 400 : 0;
      const availWidth = screenWidth - sidebarWidth - 64;
      const availHeight = screenHeight - 120;
      
      const scaleW = availWidth / targetWidth;
      const scaleH = availHeight / targetHeight;
      const calculatedScale = Math.min(scaleW, scaleH);
      
      // Bound the scale between 0.35 and 1.0
      setScale(Math.max(0.35, Math.min(1.0, calculatedScale)));
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLandscape]);

  const handleRecentsClick = () => {
    alert("Tablet Overview: No other background applications active.");
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans flex flex-col lg:flex-row items-center justify-center p-4 lg:p-6 gap-6 overflow-hidden selection:bg-emerald-500/30">
      
      {/* SIMULATOR DASHBOARD / CONTROL PANEL (LEFT SIDE) */}
      <div className="w-full lg:w-96 flex flex-col gap-5 bg-[#0c1220]/85 backdrop-blur-xl border border-slate-800 p-5 rounded-3xl shadow-2xl shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Tablet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white">Extra Pad Simulator</h1>
            <p className="text-[9px] font-mono text-emerald-400 tracking-wider">TABLET EMULATION DECK</p>
          </div>
        </div>

        <div className="p-3.5 bg-[#141b2e]/60 border border-slate-850 rounded-2xl flex flex-col gap-1.5 text-xs text-slate-350 font-serif italic leading-relaxed">
          <div className="flex items-start gap-2 text-emerald-400 not-italic font-sans font-bold text-[10px] uppercase tracking-wider mb-0.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Tablet Simulation Viewport
          </div>
          We have updated the emulator to a widescreen tablet design representing student tablets (pads) like Extra Pad. 
          Use the rotation setting to switch orientation.
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[9px] font-mono text-slate-500 tracking-wider uppercase font-bold">Simulator Controls</span>
          
          {/* Rotate Device */}
          <button
            onClick={() => setIsLandscape(!isLandscape)}
            className="w-full p-3.5 rounded-2xl border border-slate-800 bg-[#141b2e]/40 hover:bg-[#141b2e]/80 text-slate-350 hover:text-white text-left flex items-center justify-between cursor-pointer transition-all active:scale-98"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black uppercase font-sans tracking-wide">Rotate Screen</span>
              <span className="text-[10px] font-mono text-slate-500">{isLandscape ? 'LANDSCAPE (16:10 Aspect)' : 'PORTRAIT (10:16 Aspect)'}</span>
            </div>
            <RotateCw className="w-5 h-5 text-slate-400 transition-transform group-hover:rotate-90 duration-300" />
          </button>

          {/* Connection Toggle */}
          <button
            onClick={onToggleOnline}
            className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all active:scale-98 ${
              isOnline 
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-350 hover:bg-emerald-950/30' 
                : 'bg-red-950/20 border-red-500/30 text-red-350 hover:bg-red-950/30'
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black uppercase font-sans tracking-wide">Network Status</span>
              <span className="text-[10px] font-mono opacity-80">{isOnline ? 'ONLINE: YouTube stream active' : 'OFFLINE: Video overlay active'}</span>
            </div>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </button>

          {/* Reset Device Storage */}
          <button
            onClick={onWipeStorage}
            className="w-full p-3.5 rounded-2xl border border-slate-800 bg-[#141b2e]/40 hover:bg-[#141b2e]/80 text-slate-300 hover:text-white text-left flex items-center justify-between cursor-pointer transition-all active:scale-98"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black uppercase font-sans tracking-wide">Reset Device Storage</span>
              <span className="text-[10px] font-mono text-slate-500">Wipe profiles to configure class profiles again</span>
            </div>
            <RotateCcw className="w-5 h-5 text-slate-400" />
          </button>

          {/* Close Simulator */}
          <button
            onClick={onExit}
            className="w-full p-3.5 rounded-2xl border border-rose-900/30 bg-rose-950/10 hover:bg-rose-950/30 text-rose-350 hover:text-white text-left flex items-center justify-between cursor-pointer transition-all active:scale-98 mt-1.5"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black uppercase font-sans tracking-wide">Exit Simulator</span>
              <span className="text-[10px] font-mono text-rose-500">Return to landing page web portal</span>
            </div>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* TABLET VIEWPORT CONTAINER */}
      <div className="flex-1 flex items-center justify-center min-h-[500px] overflow-hidden relative">
        <div 
          className="transition-all duration-300 ease-out select-none flex flex-col"
          style={{
            transform: `scale(${scale})`,
            width: isLandscape ? '1024px' : '680px',
            height: isLandscape ? '680px' : '1024px',
            transformOrigin: 'center center'
          }}
        >
          {/* Tablet Frame Shell */}
          <div className="w-full h-full rounded-[36px] border-[16px] border-slate-900 bg-slate-950 shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-slate-800/80">
            
            {/* Front facing camera dot (Top bezel in Landscape, side bezel in portrait) */}
            <div className={`absolute w-2.5 h-2.5 rounded-full bg-[#111827] z-50 ${
              isLandscape 
                ? 'top-[-10px] left-1/2 -translate-x-1/2' 
                : 'top-1/2 left-[-10px] -translate-y-1/2'
            }`} />

            {/* Tablet Status Bar */}
            <div className="h-7 bg-black text-slate-300 text-[10px] font-mono flex items-center justify-between px-6 select-none z-45 shrink-0 border-b border-slate-900/20">
              <span>{time}</span>
              <div className="flex items-center gap-1.5">
                {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-500" />}
                <Signal className="w-3 h-3" />
                <Battery className="w-3 h-3" />
              </div>
            </div>

            {/* Screen Content Wrapper */}
            <div className="flex-1 w-full bg-[#f7fbf0] relative overflow-hidden select-none">
              {children}
            </div>

            {/* Tablet Hardware Android Bar */}
            <div className="h-11 bg-black flex items-center justify-around px-24 select-none z-45 shrink-0 border-t border-slate-900/50">
              {/* Back Button */}
              <button 
                onClick={onAndroidBack}
                className="p-3 text-slate-500 hover:text-white transition-colors active:scale-90 cursor-pointer"
                title="Android Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Home Button */}
              <button 
                onClick={onAndroidHome}
                className="p-3 text-slate-500 hover:text-white transition-colors active:scale-90 cursor-pointer"
                title="Android Home"
              >
                <Circle className="w-3.5 h-3.5 fill-transparent stroke-current" />
              </button>

              {/* Recents Button */}
              <button 
                onClick={handleRecentsClick}
                className="p-3 text-slate-500 hover:text-white transition-colors active:scale-90 cursor-pointer"
                title="Android Recents"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
