import React from 'react';
import { Complex, MatchingStep } from '../types';
import { calcGamma, calcVSWR, calcReturnLoss, cMag, cPhaseDeg } from '../lib/smithMath';
import { Calculator, ArrowUpRight, ShieldCheck, Activity } from 'lucide-react';

interface CalculationsPanelProps {
  zLoad: Complex;
  z0: number;
  steps: MatchingStep[];
}

export const CalculationsPanel: React.FC<CalculationsPanelProps> = ({
  zLoad,
  z0,
  steps,
}) => {
  // Get final impedance after all steps
  let finalZNorm = { r: zLoad.r / z0, i: zLoad.i / z0 };
  for (const s of steps) {
    finalZNorm = s.impedanceAfter;
  }

  const finalZAbs = { r: finalZNorm.r * z0, i: finalZNorm.i * z0 };
  const gamma = calcGamma(finalZNorm);
  const gammaMag = cMag(gamma);
  const gammaPhase = cPhaseDeg(gamma);
  const vswr = calcVSWR(gammaMag);
  const returnLoss = calcReturnLoss(gammaMag);
  const qFactor = finalZNorm.r > 0 ? Math.abs(finalZNorm.i / finalZNorm.r) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center space-x-2 mb-4">
        <Calculator className="w-5 h-5 text-blue-600" />
        <h2 className="text-base font-semibold text-slate-800">RF Impedance & S-Parameter Metrics</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Impedance Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block mb-1">Final Impedance (Z)</span>
          <span className="text-lg font-bold font-mono text-slate-900">
            {finalZAbs.r.toFixed(1)} {finalZAbs.i >= 0 ? '+' : ''} {finalZAbs.i.toFixed(1)}j Ω
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Normalized: {finalZNorm.r.toFixed(2)} + {finalZNorm.i.toFixed(2)}j</span>
        </div>

        {/* Reflection Coefficient Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block mb-1">Reflection Coeff (Γ)</span>
          <span className="text-lg font-bold font-mono text-slate-900">
            {gammaMag.toFixed(3)} ∠{gammaPhase.toFixed(1)}°
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Magnitude & Phase</span>
        </div>

        {/* VSWR Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block mb-1">VSWR</span>
          <span className="text-lg font-bold font-mono text-emerald-600 flex items-center">
            {vswr.toFixed(2)}
            {vswr < 1.5 && <ShieldCheck className="w-4 h-4 ml-1.5 text-emerald-500" />}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Voltage Standing Wave Ratio</span>
        </div>

        {/* Return Loss Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-medium text-slate-500 block mb-1">Return Loss (S₁₁)</span>
          <span className="text-lg font-bold font-mono text-blue-600">
            {returnLoss.toFixed(1)} dB
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Quality Factor Q: {qFactor.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
