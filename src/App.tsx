/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Complex } from './types';
import { zToScreen, screenToZ, calcGamma, calcVSWR, calcReturnLoss, cMag, cPhaseDeg, applyComponent } from './lib/smithMath';
import { FileSpreadsheet, RotateCcw, Activity, Sliders } from 'lucide-react';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';

export default function App() {
  const [frequency, setFrequency] = useState<number>(1e9); // 1 GHz
  const [z0, setZ0] = useState<number>(50); // 50 ohms
  const [zLoad, setZLoad] = useState<Complex>({ r: 25, i: 50 }); // Load R and X
  
  // Component matching sliders
  const [seriesL, setSeriesL] = useState<number>(0); // nH
  const [seriesC, setSeriesC] = useState<number>(0); // pF
  const [tLineLen, setTLineLen] = useState<number>(0); // wavelengths (0 to 0.5)

  const [isSheetsOpen, setIsSheetsOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const size = 560;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 240;

  // Step-by-step impedance calculation through sliders
  let currentZNorm = { r: zLoad.r / z0, i: zLoad.i / z0 };
  const loadScreen = zToScreen(currentZNorm, cx, cy, radius);

  const points: { z: Complex; label: string; color: string }[] = [];
  points.push({ z: currentZNorm, label: 'Load', color: '#06b6d4' });

  // Apply Series L if > 0
  if (seriesL > 0) {
    currentZNorm = applyComponent(currentZNorm, 'SERIES_L', seriesL * 1e-9, frequency, z0);
    points.push({ z: currentZNorm, label: `+ ${seriesL} nH`, color: '#3b82f6' });
  }

  // Apply Series C if > 0
  if (seriesC > 0) {
    currentZNorm = applyComponent(currentZNorm, 'SERIES_C', seriesC * 1e-12, frequency, z0);
    points.push({ z: currentZNorm, label: `+ ${seriesC} pF`, color: '#8b5cf6' });
  }

  // Apply T-Line if > 0
  if (tLineLen > 0) {
    currentZNorm = applyComponent(currentZNorm, 'TRANSMISSION_LINE', tLineLen, frequency, z0);
    points.push({ z: currentZNorm, label: `+ ${tLineLen} λ`, color: '#10b981' });
  }

  const finalScreen = zToScreen(currentZNorm, cx, cy, radius);
  const gamma = calcGamma(currentZNorm);
  const gammaMag = cMag(gamma);
  const gammaPhase = cPhaseDeg(gamma);
  const vswr = calcVSWR(gammaMag);
  const returnLoss = calcReturnLoss(gammaMag);

  // SVG pointer interaction on Smith Chart
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const clickedZNorm = screenToZ(mouseX, mouseY, cx, cy, radius);
    const newR = Math.max(0.1, clickedZNorm.r * z0);
    const newI = clickedZNorm.i * z0;
    setZLoad({ r: parseFloat(newR.toFixed(1)), i: parseFloat(newI.toFixed(1)) });
  };

  const rValues = [0.2, 0.5, 1.0, 2.0, 5.0];
  const xValues = [0.2, 0.5, 1.0, 2.0, 5.0, -0.2, -0.5, -1.0, -2.0, -5.0];
  const vswrValues = [1.5, 2.0, 3.0, 5.0];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-cyan-500 p-2 rounded-xl shadow-lg shadow-cyan-500/20 text-slate-950 flex items-center justify-center">
            <Activity className="w-5 h-5 font-bold" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Interactive Smith Chart & Matching Studio</h1>
            <p className="text-xs text-slate-400">Real-time RF Impedance & Sliding Component Controls</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setZLoad({ r: 25, i: 50 });
              setZ0(50);
              setFrequency(1e9);
              setSeriesL(0);
              setSeriesC(0);
              setTLineLen(0);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => setIsSheetsOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Google Sheets Calculator</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Smith Chart Canvas */}
        <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800 rounded-2xl p-6 flex flex-col items-center shadow-xl backdrop-blur">
          <div className="w-full flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Smith Chart Impedance Plane
            </span>
            <span className="text-xs text-cyan-400 font-mono">Click chart to set Load Z</span>
          </div>

          <div className="relative cursor-crosshair">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size} ${size}`}
              className="w-full max-w-[500px] aspect-square"
              onClick={handleCanvasClick}
            >
              {/* Outer boundary circle */}
              <circle cx={cx} cy={cy} r={radius} fill="#090d16" stroke="#334155" strokeWidth="2.5" />

              {/* Constant Resistance (R) Circles */}
              {rValues.map((r) => {
                const circleCx = cx + radius * (r / (1 + r));
                const circleCy = cy;
                const circleR = radius / (1 + r);
                return (
                  <circle
                    key={`r-${r}`}
                    cx={circleCx}
                    cy={circleCy}
                    r={circleR}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Constant Reactance (X) Arcs */}
              {xValues.map((x) => {
                const arcCx = cx + radius;
                const arcCy = cy - radius / x;
                const arcR = radius / Math.abs(x);
                return (
                  <circle
                    key={`x-${x}`}
                    cx={arcCx}
                    cy={arcCy}
                    r={arcR}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Center horizontal axis line */}
              <line x1={cx - radius} y1={cy} x2={cx + radius} y2={cy} stroke="#475569" strokeWidth="1.5" />

              {/* Constant VSWR circles */}
              {vswrValues.map((vVal) => {
                const gMag = (vVal - 1) / (vVal + 1);
                return (
                  <circle
                    key={`vswr-${vVal}`}
                    cx={cx}
                    cy={cy}
                    r={radius * gMag}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Center Match point (50 ohm / Z0) */}
              <circle cx={cx} cy={cy} r={4} fill="#64748b" />

              {/* Trajectory Polyline */}
              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points
                    .map((p) => {
                      const scr = zToScreen(p.z, cx, cy, radius);
                      return `${scr.x},${scr.y}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Point Markers */}
              {points.map((pt, idx) => {
                const scr = zToScreen(pt.z, cx, cy, radius);
                const isLast = idx === points.length - 1;
                return (
                  <g key={idx}>
                    <circle
                      cx={scr.x}
                      cy={scr.y}
                      r={isLast ? 7 : 5}
                      fill={pt.color}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={scr.x + 10}
                      y={scr.y - 8}
                      fill={isLast ? '#38bdf8' : '#94a3b8'}
                      fontSize="11"
                      fontWeight="bold"
                      className="font-mono"
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right: Sliders & Real-Time Calculations Panel */}
        <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800 rounded-2xl p-6 flex flex-col space-y-5 shadow-xl backdrop-blur">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-3 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Impedance & Component Sliding Controls
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Load Resistance Slider */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Load Resistance (R)</span>
                <span className="font-mono text-cyan-400 font-bold">{zLoad.r.toFixed(1)} Ω</span>
              </div>
              <input
                type="range"
                min="1"
                max="250"
                step="1"
                value={zLoad.r}
                onChange={(e) => setZLoad((prev) => ({ ...prev, r: parseFloat(e.target.value) }))}
                className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Load Reactance Slider */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Load Reactance (X)</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {zLoad.i >= 0 ? '+' : ''}
                  {zLoad.i.toFixed(1)}j Ω
                </span>
              </div>
              <input
                type="range"
                min="-200"
                max="200"
                step="1"
                value={zLoad.i}
                onChange={(e) => setZLoad((prev) => ({ ...prev, i: parseFloat(e.target.value) }))}
                className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Characteristic Impedance Z0 Slider */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Characteristic Z₀</span>
                <span className="font-mono text-emerald-400 font-bold">{z0} Ω</span>
              </div>
              <input
                type="range"
                min="20"
                max="150"
                step="5"
                value={z0}
                onChange={(e) => setZ0(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Frequency Slider */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Frequency (f)</span>
                <span className="font-mono text-indigo-400 font-bold">{(frequency / 1e9).toFixed(2)} GHz</span>
              </div>
              <input
                type="range"
                min="0.1e9"
                max="10e9"
                step="0.1e9"
                value={frequency}
                onChange={(e) => setFrequency(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Series Inductor Slider */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Series Inductor (L)</span>
                <span className="font-mono text-blue-400 font-bold">{seriesL} nH</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={seriesL}
                onChange={(e) => setSeriesL(parseFloat(e.target.value))}
                className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Series Capacitor Slider */}
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Series Capacitor (C)</span>
                <span className="font-mono text-purple-400 font-bold">{seriesC} pF</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={seriesC}
                onChange={(e) => setSeriesC(parseFloat(e.target.value))}
                className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Transmission Line Length Slider */}
          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Transmission Line Length (d)</span>
              <span className="font-mono text-emerald-400 font-bold">{tLineLen.toFixed(3)} λ</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.005"
              value={tLineLen}
              onChange={(e) => setTLineLen(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Real-time Calculations Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Final Output Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Final Impedance (Z)</span>
                <span className="font-mono text-white font-bold">
                  {(currentZNorm.r * z0).toFixed(1)} {(currentZNorm.i * z0) >= 0 ? '+' : ''} {(currentZNorm.i * z0).toFixed(1)}j Ω
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Reflection Coeff (Γ)</span>
                <span className="font-mono text-amber-400 font-bold">
                  {gammaMag.toFixed(3)} ∠{gammaPhase.toFixed(1)}°
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">VSWR</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">{vswr.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Return Loss (S₁₁)</span>
                <span className="font-mono text-cyan-400 font-bold text-sm">{returnLoss.toFixed(1)} dB</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Google Sheets Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsOpen}
        onClose={() => setIsSheetsOpen(false)}
        zLoad={zLoad}
        z0={z0}
        frequency={frequency}
        steps={[]}
      />
    </div>
  );
}
