export interface Complex {
  r: number; // Real part (Resistance or Conductance)
  i: number; // Imaginary part (Reactance or Susceptance)
}

export type ComponentType = 
  | 'SERIES_R' 
  | 'SERIES_L' 
  | 'SERIES_C' 
  | 'SHUNT_R' 
  | 'SHUNT_L' 
  | 'SHUNT_C' 
  | 'SERIES_STUB' 
  | 'SHUNT_STUB'
  | 'TRANSMISSION_LINE';

export interface MatchingStep {
  id: string;
  type: ComponentType;
  value: number; // Ohms, Henrys, Farads, or Degrees/Wavelengths
  unit: string;
  impedanceBefore: Complex;
  impedanceAfter: Complex;
  reflectionCoeff: Complex;
  vswr: number;
  returnLoss: number;
  description: string;
}

export interface PresetCircuit {
  name: string;
  category: string;
  description: string;
  zLoad: Complex; // Ohms
  frequency: number; // Hz (e.g., 1e9 for 1 GHz)
  z0: number; // Characteristic impedance (typically 50 ohms)
}

export interface FrequencySweepPoint {
  frequency: number; // Hz
  freqGHz: number;
  returnLoss: number; // dB
  vswr: number;
  gammaMag: number;
  gammaPhase: number; // degrees
}
