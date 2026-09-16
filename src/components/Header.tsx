import React from 'react';
import { Activity, Sparkles, FileSpreadsheet, Settings2, RefreshCw } from 'lucide-react';
import { PresetCircuit } from '../types';

interface HeaderProps {
  appName: string;
  frequency: number;
  setFrequency: (f: number) => void;
  z0: number;
  setZ0: (z: number) => void;
  onSelectPreset: (preset: PresetCircuit) => void;
  onOpenSheets: () => void;
  onReset: () => void;
}

const PRESETS: PresetCircuit[] = [
  {
    name: 'Inductive Load (25 + j50 Ω)',
    category: 'Inductive',
    description: 'Typical high-frequency inductive load at 1 GHz',
    zLoad: { r: 25, i: 50 },
    frequency: 1e9,
    z0: 50,
  },
  {
    name: 'Capacitive Load (75 - j30 Ω)',
    category: 'Capacitive',
    description: 'Capacitive patch antenna impedance',
    zLoad: { r: 75, i: -30 },
    frequency: 2.4e9,
    z0: 50,
  },
  {
    name: 'Resistive Mismatch (120 + j0 Ω)',
    category: 'Resistive',
    description: 'High resistance load mismatch',
    zLoad: { r: 120, i: 0 },
    frequency: 915e6,
    z0: 50,
  },
  {
    name: 'Complex Low Impedance (15 - j40 Ω)',
    category: 'Complex',
    description: 'Power amplifier output impedance',
    zLoad: { r: 15, i: -40 },
    frequency: 800e6,
    z0: 50,
  },
];

export const Header: React.FC<HeaderProps> = ({
  appName,
  frequency,
  setFrequency,
  z0,
  setZ0,
  onSelectPreset,
  onOpenSheets,
  onReset,
}) => {
  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">{appName}</h1>
            <p className="text-xs text-slate-400">Interactive RF Impedance Matching & Smith Chart Suite</p>
          </div>
        </div>

        {/* Global Controls: Freq, Z0, Presets */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Frequency Control */}
          <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-2">
            <label className="text-xs text-slate-400 font-medium">Freq:</label>
            <input
              type="number"
              value={frequency / 1e9}
              onChange={(e) => setFrequency(Math.max(0.01, parseFloat(e.target.value) || 1) * 1e9)}
              step="0.1"
              min="0.01"
              max="100"
              className="w-16 bg-slate-900 text-white text-sm px-1.5 py-0.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-400">GHz</span>
          </div>

          {/* Z0 Control */}
          <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-2">
            <label className="text-xs text-slate-400 font-medium">Z₀:</label>
            <input
              type="number"
              value={z0}
              onChange={(e) => setZ0(Math.max(10, parseFloat(e.target.value) || 50))}
              step="5"
              min="10"
              max="200"
              className="w-14 bg-slate-900 text-white text-sm px-1.5 py-0.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-400">Ω</span>
          </div>

          {/* Presets Dropdown */}
          <select
            onChange={(e) => {
              const preset = PRESETS[parseInt(e.target.value)];
              if (preset) onSelectPreset(preset);
            }}
            defaultValue=""
            className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="" disabled>Load Preset...</option>
            {PRESETS.map((p, idx) => (
              <option key={idx} value={idx}>{p.name}</option>
            ))}
          </select>

          {/* Action Buttons */}
          <button
            onClick={onReset}
            title="Reset Matching Network"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSheets}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Sheets</span>
          </button>
        </div>
      </div>
    </header>
  );
};
