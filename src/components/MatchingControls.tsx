import React, { useState } from 'react';
import { ComponentType, MatchingStep, Complex } from '../types';
import { Plus, Trash2, Wand2, ArrowRight } from 'lucide-react';
import { applyComponent, calcGamma, calcVSWR, calcReturnLoss, cMag, calculateLSectionMatch } from '../lib/smithMath';

interface MatchingControlsProps {
  zLoad: Complex;
  z0: number;
  frequency: number;
  steps: MatchingStep[];
  onAddStep: (step: MatchingStep) => void;
  onRemoveStep: (index: number) => void;
  onClearSteps: () => void;
  onSetZLoad: (z: Complex) => void;
}

export const MatchingControls: React.FC<MatchingControlsProps> = ({
  zLoad,
  z0,
  frequency,
  steps,
  onAddStep,
  onRemoveStep,
  onClearSteps,
  onSetZLoad,
}) => {
  const [componentType, setComponentType] = useState<ComponentType>('SERIES_L');
  const [valInput, setValInput] = useState<string>('15'); // 15 nH, pF, or ohms

  // Get current impedance before adding next step
  const getCurrentImpedance = (): Complex => {
    let z = { r: zLoad.r / z0, i: zLoad.i / z0 };
    for (const s of steps) {
      z = s.impedanceAfter;
    }
    return z;
  };

  const handleAddComponent = () => {
    const numVal = parseFloat(valInput);
    if (isNaN(numVal) || numVal <= 0) return;

    // Convert input value to SI base units for calculation
    let actualValue = numVal;
    let unitStr = 'Ω';

    if (componentType === 'SERIES_L' || componentType === 'SHUNT_L') {
      actualValue = numVal * 1e-9; // nH to H
      unitStr = 'nH';
    } else if (componentType === 'SERIES_C' || componentType === 'SHUNT_C') {
      actualValue = numVal * 1e-12; // pF to F
      unitStr = 'pF';
    } else if (componentType === 'TRANSMISSION_LINE') {
      actualValue = numVal; // wavelengths (e.g. 0.125)
      unitStr = 'λ';
    } else {
      unitStr = 'Ω';
    }

    const zBefore = getCurrentImpedance();
    const zAfter = applyComponent(zBefore, componentType, actualValue, frequency, z0);
    const gamma = calcGamma(zAfter);
    const gammaMag = cMag(gamma);
    const vswr = calcVSWR(gammaMag);
    const returnLoss = calcReturnLoss(gammaMag);

    const newStep: MatchingStep = {
      id: Math.random().toString(36).substring(2, 9),
      type: componentType,
      value: actualValue,
      unit: unitStr,
      impedanceBefore: zBefore,
      impedanceAfter: zAfter,
      reflectionCoeff: gamma,
      vswr,
      returnLoss,
      description: `${componentType.replace('_', ' ')}: ${numVal} ${unitStr}`,
    };

    onAddStep(newStep);
  };

  const handleAutoMatch = () => {
    const currentZAbs = {
      r: getCurrentImpedance().r * z0,
      i: getCurrentImpedance().i * z0,
    };
    const match = calculateLSectionMatch(currentZAbs, z0, frequency);
    if (!match) return;

    // Add component 1
    const zBefore1 = getCurrentImpedance();
    const zAfter1 = applyComponent(zBefore1, match.component1.type, match.component1.value, frequency, z0);
    const g1 = calcGamma(zAfter1);
    const step1: MatchingStep = {
      id: Math.random().toString(36).substring(2, 9),
      type: match.component1.type,
      value: match.component1.value,
      unit: match.component1.type.includes('L') ? 'H' : 'F',
      impedanceBefore: zBefore1,
      impedanceAfter: zAfter1,
      reflectionCoeff: g1,
      vswr: calcVSWR(cMag(g1)),
      returnLoss: calcReturnLoss(cMag(g1)),
      description: `Auto ${match.component1.label}`,
    };
    onAddStep(step1);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Matching Network Builder</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAutoMatch}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto L-Match</span>
            </button>
            {steps.length > 0 && (
              <button
                onClick={onClearSteps}
                className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Add Component Form */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Component Type</label>
              <select
                value={componentType}
                onChange={(e) => {
                  const t = e.target.value as ComponentType;
                  setComponentType(t);
                  if (t.includes('L')) setValInput('15');
                  else if (t.includes('C')) setValInput('4.7');
                  else if (t.includes('R')) setValInput('50');
                  else if (t === 'TRANSMISSION_LINE') setValInput('0.125');
                }}
                className="w-full bg-white text-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="SERIES_L">Series Inductor (L)</option>
                <option value="SERIES_C">Series Capacitor (C)</option>
                <option value="SERIES_R">Series Resistor (R)</option>
                <option value="SHUNT_L">Shunt Inductor (L)</option>
                <option value="SHUNT_C">Shunt Capacitor (C)</option>
                <option value="SHUNT_R">Shunt Resistor (R)</option>
                <option value="TRANSMISSION_LINE">Transmission Line Stub (λ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Value ({componentType.includes('L') ? 'nH' : componentType.includes('C') ? 'pF' : componentType === 'TRANSMISSION_LINE' ? 'Wavelengths (λ)' : 'Ω'})
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={valInput}
                  onChange={(e) => setValInput(e.target.value)}
                  step="0.1"
                  className="w-full bg-white text-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddComponent}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Matching Circuit Steps</h3>
          {steps.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
              No components added yet. Add components above to build your matching network.
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 transition text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-800">{step.description}</span>
                      <div className="text-[11px] text-slate-500">
                        VSWR: <span className="text-slate-700 font-medium">{step.vswr.toFixed(2)}</span> | S₁₁:{' '}
                        <span className="text-slate-700 font-medium">{step.returnLoss.toFixed(1)} dB</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveStep(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
