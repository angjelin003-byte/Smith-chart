import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, X, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Complex, MatchingStep } from '../types';
import { calcGamma, calcVSWR, calcReturnLoss, cMag, cPhaseDeg } from '../lib/smithMath';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  zLoad: Complex;
  z0: number;
  frequency: number;
  steps: MatchingStep[];
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  zLoad,
  z0,
  frequency,
  steps,
}) => {
  const [loading, setLoading] = useState(false);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Google Identity Services script if not already present
    if (!document.getElementById('gsi-script')) {
      const script = document.createElement('script');
      script.id = 'gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  if (!isOpen) return null;

  const handleExport = async (isTemplate: boolean = false) => {
    setLoading(true);
    setError(null);
    setSuccessUrl(null);

    try {
      // Request access token via Google Identity Services
      const client = (window as any).google?.accounts.oauth2.initTokenClient({
        client_id: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '', // AI Studio injects credentials or uses default
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setError(`OAuth Error: ${tokenResponse.error}`);
            setLoading(false);
            return;
          }

          const accessToken = tokenResponse.access_token;
          const endpoint = isTemplate ? '/api/sheets/create-template' : '/api/sheets/export';

          const bodyData = isTemplate
            ? { z0, rLoad: zLoad.r, xLoad: zLoad.i }
            : {
                title: `Smith Chart Report - ${(frequency / 1e9).toFixed(2)}GHz - ${new Date().toISOString().slice(0, 10)}`,
                dataRows: [
                  ["System Parameter", "Value", "Unit"],
                  ["Characteristic Impedance (Z₀)", z0, "Ω"],
                  ["Frequency (f)", frequency / 1e9, "GHz"],
                  ["Initial Load Impedance (Z_L)", `${zLoad.r.toFixed(2)} + j${zLoad.i.toFixed(2)}`, "Ω"],
                  [],
                  ["Matching Steps Breakdown"],
                  ["Step", "Component", "Value", "Normalized Impedance (r + jx)", "VSWR", "Return Loss (dB)"],
                  ...steps.map((s, idx) => [
                    idx + 1,
                    s.type,
                    s.description,
                    `${s.impedanceAfter.r.toFixed(2)} + j${s.impedanceAfter.i.toFixed(2)}`,
                    s.vswr.toFixed(2),
                    `${s.returnLoss.toFixed(1)} dB`,
                  ]),
                ],
              };

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(bodyData),
          });

          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Failed to communicate with Google Sheets API');
          }

          setSuccessUrl(data.spreadsheetUrl);
          setLoading(false);
        },
      });

      if (client) {
        client.requestAccessToken();
      } else {
        throw new Error('Google Identity Services client failed to initialize.');
      }
    } catch (err: any) {
      setError(err.message || 'Export failed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-800">Export to Google Sheets</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          Create a live interactive Smith Chart calculation spreadsheet with pre-built Google Sheets formulas for impedance normalization, reflection coefficient, VSWR, and Return Loss, or export your current matching steps.
        </p>

        {successUrl ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-3">
            <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
            <div className="text-xs font-semibold text-emerald-900">Spreadsheet Created Successfully!</div>
            <a
              href={successUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <span>Open Google Sheet Calculator</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {error && <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">{error}</div>}
            
            <button
              onClick={() => handleExport(true)}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl text-xs shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Generating...' : '📊 Create Live Google Sheets Calculator'}</span>
            </button>

            <button
              onClick={() => handleExport(false)}
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl text-xs shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Exporting...' : '📄 Export Current Matching Report'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
