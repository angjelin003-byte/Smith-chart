import React from 'react';
import { Complex, MatchingStep } from '../types';
import { calculateFrequencySweep } from '../lib/smithMath';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface FrequencySweepChartProps {
  zLoad: Complex;
  z0: number;
  frequency: number;
  steps: MatchingStep[];
}

export const FrequencySweepChart: React.FC<FrequencySweepChartProps> = ({
  zLoad,
  z0,
  frequency,
  steps,
}) => {
  // Sweep frequency from 50% to 150% of center frequency
  const fMin = frequency * 0.5;
  const fMax = frequency * 1.5;
  const sweepData = calculateFrequencySweep(
    { r: zLoad.r, i: zLoad.i },
    steps,
    fMin,
    fMax,
    50,
    z0
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-800">Frequency Sweep Response (S₁₁ & VSWR)</h2>
        </div>
        <span className="text-xs text-slate-500">
          Bandwidth: {(fMin / 1e9).toFixed(2)} GHz – {(fMax / 1e9).toFixed(2)} GHz
        </span>
      </div>

      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sweepData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="freqGHz"
              stroke="#64748b"
              fontSize={11}
              unit=" GHz"
              tickFormatter={(v) => v.toFixed(2)}
            />
            <YAxis
              yAxisId="left"
              stroke="#3b82f6"
              fontSize={11}
              domain={[-40, 0]}
              unit=" dB"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#10b981"
              fontSize={11}
              domain={[1, 10]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
              formatter={(value: any, name: any) => [
                typeof value === 'number' ? value.toFixed(2) : value,
                name === 'returnLoss' ? 'Return Loss (dB)' : 'VSWR',
              ]}
              labelFormatter={(label) => `Freq: ${Number(label).toFixed(3)} GHz`}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="returnLoss"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              name="Return Loss"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="vswr"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="VSWR"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
