/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface DynamicFigureProps {
  type: 'brain' | 'river' | 'ecosystem' | 'math' | 'music' | 'language' | 'fairness';
}

export default function DynamicFigure({ type }: DynamicFigureProps) {
  switch (type) {
    case 'brain':
      return (
        <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto my-4 bg-amber-500/5 rounded-lg border border-amber-500/10 p-2" id="svg-figure-brain">
          {/* Outer brain boundary */}
          <path d="M100,120 Q80,100 100,70 Q120,40 200,40 Q280,40 300,70 Q320,100 300,120 Q320,150 290,180 Q250,210 200,210 Q140,210 110,180 Q80,150 100,120 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="none" />
          {/* Inner gyri / lobes mapping */}
          <path d="M160,40 Q150,80 200,80 Q250,80 240,40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
          <path d="M200,80 Q190,120 150,130 Q110,140 100,120" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
          <path d="M200,80 Q220,130 260,110 Q300,90 300,120" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
          <path d="M150,130 Q210,160 250,130 Q280,110 290,180" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
          <path d="M150,130 Q170,180 200,210" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
          {/* Firing Neural Nodes (Simulating classroom display points) */}
          <circle cx="130" cy="80" r="6" className="fill-amber-500 text-amber-500 animate-pulse" />
          <circle cx="210" cy="110" r="8" className="fill-emerald-500 text-emerald-500 animate-pulse" />
          <circle cx="270" cy="90" r="5" className="fill-amber-500 text-amber-500 animate-pulse" />
          <circle cx="180" cy="160" r="7" className="fill-red-500 text-red-500 animate-pulse" />
          {/* Neural Synapse Connections (Lines) */}
          <line x1="130" y1="80" x2="210" y2="110" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="210" y1="110" x2="270" y2="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="180" y1="160" x2="210" y2="110" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="210" y="30" textAnchor="middle" className="font-mono text-[10px] tracking-wider fill-current opacity-80 uppercase">Frontal Cortex</text>
          <text x="310" y="150" textAnchor="middle" className="font-mono text-[10px] tracking-wider fill-current opacity-80 uppercase">Occipital</text>
        </svg>
      );
    case 'river':
      return (
        <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto my-4 bg-amber-500/5 rounded-lg border border-amber-500/10 p-2" id="svg-figure-river">
          {/* Mountain contours */}
          <path d="M40,160 L120,40 L200,160" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" />
          <path d="M150,180 L220,70 L310,180" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.4" />
          {/* Winding River */}
          <path d="M125,55 C120,90 220,110 180,140 C140,170 340,190 320,230" fill="none" stroke="currentColor" strokeWidth="5.5" className="text-sky-500" />
          <path d="M125,55 C120,90 220,110 180,140 C140,170 340,190 320,230" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" className="text-white" />
          {/* Settlement / Core dots of alluvial civilization */}
          <circle cx="160" cy="155" r="8" className="fill-amber-500 text-amber-500" />
          <circle cx="280" cy="195" r="8" className="fill-amber-500 text-amber-500" />
          <text x="160" y="140" textAnchor="middle" className="font-sans italic text-[11px] fill-current font-bold bg-white px-1">Ancient Susa</text>
          <text x="280" y="180" textAnchor="middle" className="font-sans italic text-[11px] fill-current font-bold bg-white px-1">Ur Settlement</text>
          <path d="M30,220 L150,220" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
          <text x="35" y="212" className="font-mono text-[9px] fill-current uppercase tracking-wider">Alluvial Flood Plains</text>
        </svg>
      );
    case 'ecosystem':
      return (
        <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto my-4 bg-amber-500/5 rounded-lg border border-amber-500/10 p-2" id="svg-figure-ecosystem">
          {/* Dynamic cyclical flow */}
          <circle cx="200" cy="120" r="75" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" strokeOpacity="0.3" />
          {/* Wolves node */}
          <g transform="translate(200, 45)">
            <rect x="-40" y="-14" width="80" height="28" rx="8" fill="currentColor" className="text-red-900/10 dark:text-red-500/20" />
            <rect x="-40" y="-14" width="80" height="28" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-600" />
            <text x="0" y="5" textAnchor="middle" className="text-xs font-bold fill-current">1. Wolves (L1)</text>
          </g>
          {/* Elk node */}
          <g transform="translate(300, 155)">
            <rect x="-40" y="-14" width="80" height="28" rx="8" fill="currentColor" className="text-amber-900/10 dark:text-amber-500/20" />
            <rect x="-40" y="-14" width="80" height="28" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-600" />
            <text x="0" y="5" textAnchor="middle" className="text-xs font-bold fill-current">2. Elk (L2)</text>
          </g>
          {/* Vegetation node */}
          <g transform="translate(100, 155)">
            <rect x="-40" y="-14" width="80" height="28" rx="8" fill="currentColor" className="text-emerald-950/10 dark:text-emerald-500/20" />
            <rect x="-40" y="-14" width="80" height="28" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600" />
            <text x="0" y="5" textAnchor="middle" className="text-xs font-bold fill-current">3. Willow (L3)</text>
          </g>
          {/* Intersecting Arrows */}
          <path d="M235,55 Q295,90 295,130" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500" markerEnd="url(#arrow)" />
          <path d="M260,165 Q195,200 140,165" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500" markerEnd="url(#arrow)" />
          <path d="M100,135 Q105,75 160,55" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-500" markerEnd="url(#arrow)" />
          {/* Informational overlay label */}
          <text x="200" y="125" textAnchor="middle" className="font-mono text-[9px] uppercase tracking-widest fill-current">Trophic Balance</text>
        </svg>
      );
    case 'math':
      return (
        <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto my-4 bg-amber-500/5 rounded-lg border border-amber-500/10 p-2" id="svg-figure-math">
          {/* Golden Spiral outline */}
          <rect x="10" y="10" width="340" height="210" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="220" y1="10" x2="220" y2="220" stroke="currentColor" strokeWidth="1.5" />
          <line x1="220" y1="140" x2="350" y2="140" stroke="currentColor" strokeWidth="1.5" />
          <line x1="300" y1="10" x2="300" y2="140" stroke="currentColor" strokeWidth="1.5" />
          <line x1="220" y1="60" x2="300" y2="60" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10,220 A210,210 0 0,1 220,10 A130,130 0 0,1 350,140 A80,80 0 0,1 300,60 A50,50 0 0,1 250,110" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-500" />
          <text x="110" y="120" className="font-serif italic text-2xl fill-current opacity-75">1.618</text>
          <text x="270" y="100" className="font-sans text-[10px] fill-current">Φ</text>
        </svg>
      );
    case 'music':
      return (
        <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto my-4 bg-amber-500/5 rounded-lg border border-amber-500/10 p-2" id="svg-figure-music">
          {/* Overlapping sine frequencies simulating harmony */}
          <path d="M 10,120 Q 55,40 100,120 T 190,120 T 280,120 T 370,120" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-600 animate-pulse" />
          <path d="M 10,120 Q 32.5,80 55,120 T 100,120 T 145,120 T 190,120 T 235,120 T 280,120 T 325,120 T 370,120" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" className="text-emerald-500" />
          {/* Frequency peaks indicators */}
          <circle cx="55" cy="40" r="4" fill="currentColor" className="text-amber-600" />
          <circle cx="145" cy="40" r="4" fill="currentColor" className="text-amber-600" />
          <circle cx="235" cy="40" r="4" fill="currentColor" className="text-amber-600" />
          <line x1="10" y1="120" x2="390" y2="120" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2" />
          <text x="200" y="210" textAnchor="middle" className="font-mono text-[9px] uppercase tracking-wider fill-current">Consonance Ratio (3:2 Perfect Fifth)</text>
        </svg>
      );
    case 'language':
      return (
        <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto my-4 bg-amber-500/5 rounded-lg border border-amber-500/10 p-2" id="svg-figure-language">
          {/* Semantic color categorization circles */}
          <circle cx="150" cy="110" r="60" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="250" cy="110" r="60" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          <text x="140" y="110" textAnchor="middle" className="font-serif italic text-sm fill-current font-bold">Absolute Space</text>
          <text x="140" y="130" textAnchor="middle" className="font-mono text-[9px] fill-current opacity-70">Eg: "North of arm"</text>
          <text x="260" y="110" textAnchor="middle" className="font-serif italic text-sm fill-current font-bold">Relative Space</text>
          <text x="260" y="130" textAnchor="middle" className="font-mono text-[9px] fill-current opacity-70">Eg: "To my left"</text>
          <text x="200" y="188" textAnchor="middle" className="font-mono text-[10px] uppercase tracking-wider fill-current text-amber-500 font-bold">Overlapping Cognitive Maps</text>
        </svg>
      );
    case 'fairness':
      return (
        <svg viewBox="0 0 400 240" className="w-full max-w-md mx-auto my-4 bg-amber-500/5 rounded-lg border border-amber-500/10 p-2" id="svg-figure-fairness">
          {/* Visualizing John Rawls' scales of Justice */}
          <line x1="200" y1="40" x2="200" y2="200" stroke="currentColor" strokeWidth="3" />
          <line x1="120" y1="120" x2="280" y2="120" stroke="currentColor" strokeWidth="3" />
          {/* Left Plate (Underprivileged guaranteed max) */}
          <g transform="translate(120, 120)">
            <line x1="0" y1="0" x2="0" y2="60" stroke="currentColor" strokeWidth="1.5" />
            <path d="M-30,60 L30,60 L0,80 Z" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-emerald-500/20" />
            <text x="0" y="105" textAnchor="middle" className="font-sans text-[10px] uppercase font-bold fill-current">Maximin Floor</text>
          </g>
          {/* Right Plate (Aggregate efficiency peak) */}
          <g transform="translate(280, 120)">
            <line x1="0" y1="0" x2="0" y2="60" stroke="currentColor" strokeWidth="1.5" />
            <path d="M-30,60 L30,60 L0,80 Z" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-amber-500/20" />
            <text x="0" y="105" textAnchor="middle" className="font-sans text-[10px] uppercase font-bold fill-current">Avg. Utilitarian</text>
          </g>
          <text x="200" y="25" textAnchor="middle" className="font-mono text-[10px] uppercase tracking-wider fill-current font-bold">Veil of Ignorance Calibration</text>
        </svg>
      );
    default:
      return null;
  }
}
