import React, { useState, useRef } from 'react';
import { Complex, MatchingStep } from '../types';
import { zToScreen, screenToZ, calcGamma, calcVSWR, calcReturnLoss, cMag, cPhaseDeg } from '../lib/smithMath';

interface SmithChartCanvasProps {
  zLoad: Complex;
  z0: number;
  steps: MatchingStep[];
  onSetZLoad: (z: Complex) => void;
}

export const SmithChartCanvas: React.FC<SmithChartCanvasProps> = ({
  zLoad,
  z0,
  steps,
  onSetZLoad,
}) => {
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; z: Complex; gamma: Complex; vswr: number; rl: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 230;

  // Compute all impedance points along the matching trajectory
  const points: { z: Complex; label: string; color: string }[] = [];
  let currentZNorm = { r: zLoad.r / z0, i: zLoad.i / z0 };
  points.push({ z: currentZNorm, label: 'Load (Zₛ)', color: '#ef4444' });

  for (let idx = 0; idx < steps.length; idx++) {
    currentZNorm = steps[idx].impedanceAfter;
    const isLast = idx === steps.length - 1;
    points.push({
      z: currentZNorm,
      label: `Step ${idx + 1}: ${steps[idx].type}`,
      color: isLast ? '#3b82f6' : '#8b5cf6',
    });
  }

  // Handle canvas click to set new load impedance
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const zNorm = screenToZ(mouseX, mouseY, cx, cy, radius);
    onSetZLoad({
      r: Math.max(0.1, zNorm.r * z0),
      i: zNorm.i * z0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const zNorm = screenToZ(mouseX, mouseY, cx, cy, radius);
    const gamma = calcGamma(zNorm);
    const gammaMag = cMag(gamma);
    const vswr = calcVSWR(gammaMag);
    const rl = calcReturnLoss(gammaMag);

    setHoverCoord({
      x: mouseX,
      y: mouseY,
      z: { r: zNorm.r * z0, i: zNorm.i * z0 },
      gamma,
      vswr,
      rl,
    });
  };

  // Generate SVG paths for Constant R circles & Constant X arcs
  const rValues = [0.2, 0.5, 1.0, 2.0, 5.0];
  const xValues = [0.2, 0.5, 1.0, 2.0, 5.0, -0.2, -0.5, -1.0, -2.0, -5.0];
  const vswrValues = [1.5, 2.0, 3.0, 5.0];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-800">Smith Chart Impedance Plane</h2>
        <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Click chart to set Load Z
        </span>
      </div>

      <div className="relative cursor-crosshair">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[500px] aspect-square select-none"
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCoord(null)}
        >
          {/* Background outer circle */}
          <circle cx={cx} cy={cy} r={radius} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />

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
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}

          {/* Constant Reactance (X) Arcs */}
          {xValues.map((x) => {
            const arcCx = cx + radius;
            const arcCy = cy - radius / x;
            const arcR = radius / Math.abs(x);
            // Clip arc inside unit circle using SVG path
            // For simplicity, draw circle with dash or standard clip
            return (
              <circle
                key={`x-${x}`}
                cx={arcCx}
                cy={arcCy}
                r={arcR}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            );
          })}

          {/* Fundamental Axis Line (R=0 to R=infinity along X=0) */}
          <line x1={cx - radius} y1={cy} x2={cx + radius} y2={cy} stroke="#94a3b8" strokeWidth="1.5" />

          {/* Constant VSWR Circles */}
          {vswrValues.map((vswrVal) => {
            // Gamma magnitude for VSWR: (VSWR - 1) / (VSWR + 1)
            const gMag = (vswrVal - 1) / (vswrVal + 1);
            const vswrRadius = radius * gMag;
            return (
              <circle
                key={`vswr-${vswrVal}`}
                cx={cx}
                cy={cy}
                r={vswrRadius}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Trajectory Polyline connecting matching steps */}
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

          {/* Step Points */}
          {points.map((pt, idx) => {
            const scr = zToScreen(pt.z, cx, cy, radius);
            return (
              <g key={idx}>
                <circle
                  cx={scr.x}
                  cy={scr.y}
                  r={idx === 0 ? 6 : 5}
                  fill={pt.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="shadow-md transition-all duration-200 hover:scale-125"
                />
                <text
                  x={scr.x + 10}
                  y={scr.y - 8}
                  fill="#1e293b"
                  fontSize="10"
                  fontWeight="600"
                  className="pointer-events-none drop-shadow-sm"
                >
                  {idx === 0 ? 'Load' : `S${idx}`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Readout Floating Card */}
        {hoverCoord && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/95 backdrop-blur text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-slate-700 pointer-events-none grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="text-slate-400">Z:</span>{' '}
              <span className="font-mono text-cyan-400">
                {hoverCoord.z.r.toFixed(1)} {hoverCoord.z.i >= 0 ? '+' : ''} {hoverCoord.z.i.toFixed(1)}j Ω
              </span>
            </div>
            <div>
              <span className="text-slate-400">VSWR:</span>{' '}
              <span className="font-mono text-emerald-400">{hoverCoord.vswr.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400">Γ:</span>{' '}
              <span className="font-mono text-amber-400">
                {cMag(hoverCoord.gamma).toFixed(3)} ∠{cPhaseDeg(hoverCoord.gamma).toFixed(1)}°
              </span>
            </div>
            <div>
              <span className="text-slate-400">S₁₁:</span>{' '}
              <span className="font-mono text-purple-400">{hoverCoord.rl.toFixed(1)} dB</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
