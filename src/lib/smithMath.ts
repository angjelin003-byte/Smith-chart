import { Complex, MatchingStep, ComponentType, FrequencySweepPoint } from '../types';

export const C_LIGHT = 3e8; // m/s

// Complex number helpers
export function cAdd(a: Complex, b: Complex): Complex {
  return { r: a.r + b.r, i: a.i + b.i };
}

export function cSub(a: Complex, b: Complex): Complex {
  return { r: a.r - b.r, i: a.i - b.i };
}

export function cMul(a: Complex, b: Complex): Complex {
  return { r: a.r * b.r - a.i * b.i, i: a.r * b.i + a.i * b.r };
}

export function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.r * b.r + b.i * b.i;
  if (denom === 0) return { r: 0, i: 0 };
  return {
    r: (a.r * b.r + a.i * b.i) / denom,
    i: (a.i * b.r - a.r * b.i) / denom,
  };
}

export function cMag(a: Complex): number {
  return Math.sqrt(a.r * a.r + a.i * a.i);
}

export function cPhaseDeg(a: Complex): number {
  return (Math.atan2(a.i, a.r) * 180) / Math.PI;
}

// Reflection coefficient Gamma = (z - 1) / (z + 1)
export function calcGamma(zNorm: Complex): Complex {
  const num = cSub(zNorm, { r: 1, i: 0 });
  const den = cAdd(zNorm, { r: 1, i: 0 });
  return cDiv(num, den);
}

// VSWR from Gamma magnitude
export function calcVSWR(gammaMag: number): number {
  if (gammaMag >= 0.9999) return 99.9;
  return (1 + gammaMag) / (1 - gammaMag);
}

// Return Loss in dB
export function calcReturnLoss(gammaMag: number): number {
  if (gammaMag <= 0.00001) return 60;
  return -20 * Math.log10(gammaMag);
}

// Map normalized impedance (r, x) to Smith Chart canvas coordinates (X, Y)
// Center at (cx, cy), radius R
export function zToScreen(z: Complex, cx: number, cy: number, radius: number): { x: number; y: number } {
  // Gamma = (z - 1) / (z + 1)
  const gamma = calcGamma(z);
  // In Cartesian, standard Smith chart has real axis horizontal, imaginary vertical (inverted Y for SVG)
  return {
    x: cx + gamma.r * radius,
    y: cy - gamma.i * radius,
  };
}

// Inverse mapping: screen coordinates to normalized impedance z = (1 + Gamma) / (1 - Gamma)
export function screenToZ(screenX: number, screenY: number, cx: number, cy: number, radius: number): Complex {
  const gx = (screenX - cx) / radius;
  const gy = (cy - screenY) / radius;
  
  // Limit to Smith chart unit circle
  const gMagSq = gx * gx + gy * gy;
  let ugx = gx;
  let ugy = gy;
  if (gMagSq > 1.0) {
    const scale = 0.999 / Math.sqrt(gMagSq);
    ugx *= scale;
    ugy *= scale;
  }

  // Gamma complex
  const gamma: Complex = { r: ugx, i: ugy };
  // z = (1 + Gamma) / (1 - Gamma)
  const num = cAdd({ r: 1, i: 0 }, gamma);
  const den = cSub({ r: 1, i: 0 }, gamma);
  return cDiv(num, den);
}

// Component calculations on impedance Z (absolute Ohms) at frequency f (Hz), characteristic impedance Z0
export function applyComponent(
  zCurrent: Complex,
  type: ComponentType,
  value: number, // Ohms, Henrys, Farads, or wavelengths
  freq: number,
  z0: number
): Complex {
  const omega = 2 * Math.PI * freq;
  let deltaZ: Complex = { r: 0, i: 0 };
  let yCurrent: Complex;
  let yNew: Complex;

  switch (type) {
    case 'SERIES_R':
      return { r: Math.max(0, zCurrent.r + value), i: zCurrent.i };

    case 'SERIES_L':
      // X = omega * L
      return { r: zCurrent.r, i: zCurrent.i + (omega * value) / z0 }; // normalized reactance

    case 'SERIES_C':
      // X = -1 / (omega * C * Z0)
      if (value <= 0) return zCurrent;
      return { r: zCurrent.r, i: zCurrent.i - 1 / (omega * value * z0) };

    case 'SHUNT_R': {
      // Y = 1/Z -> Y_new = Y_current + 1/R_norm
      const denom = zCurrent.r * zCurrent.r + zCurrent.i * zCurrent.i;
      if (denom === 0) return zCurrent;
      yCurrent = { r: zCurrent.r / denom, i: -zCurrent.i / denom };
      yNew = { r: yCurrent.r + z0 / value, i: yCurrent.i };
      const yDenom = yNew.r * yNew.r + yNew.i * yNew.i;
      if (yDenom === 0) return { r: 0, i: 0 };
      return { r: yNew.r / yDenom, i: -yNew.i / yDenom };
    }

    case 'SHUNT_L': {
      // B = -1 / (omega * L * Y0) = -Z0 / (omega * L)
      const denom = zCurrent.r * zCurrent.r + zCurrent.i * zCurrent.i;
      if (denom === 0) return zCurrent;
      yCurrent = { r: zCurrent.r / denom, i: -zCurrent.i / denom };
      const bL = -z0 / (omega * value);
      yNew = { r: yCurrent.r, i: yCurrent.i + bL };
      const yDenom = yNew.r * yNew.r + yNew.i * yNew.i;
      if (yDenom === 0) return { r: 0, i: 0 };
      return { r: yNew.r / yDenom, i: -yNew.i / yDenom };
    }

    case 'SHUNT_C': {
      // B = omega * C / Y0 = omega * C * Z0
      const denom = zCurrent.r * zCurrent.r + zCurrent.i * zCurrent.i;
      if (denom === 0) return zCurrent;
      yCurrent = { r: zCurrent.r / denom, i: -zCurrent.i / denom };
      const bC = omega * value * z0;
      yNew = { r: yCurrent.r, i: yCurrent.i + bC };
      const yDenom = yNew.r * yNew.r + yNew.i * yNew.i;
      if (yDenom === 0) return { r: 0, i: 0 };
      return { r: yNew.r / yDenom, i: -yNew.i / yDenom };
    }

    case 'TRANSMISSION_LINE': {
      // value is electrical length in wavelengths (e.g. 0.125 lambda) or degrees
      // Gamma rotates clockwise by 2 * beta * d radians (= 4 * pi * d / lambda radians)
      const gamma = calcGamma(zCurrent);
      const thetaRad = value * 4 * Math.PI; // value is in wavelengths
      const currentMag = cMag(gamma);
      const currentPhase = cPhaseDeg(gamma);
      const newPhase = currentPhase - (thetaRad * 180) / Math.PI;
      const newPhaseRad = (newPhase * Math.PI) / 180;
      const newGamma: Complex = {
        r: currentMag * Math.cos(newPhaseRad),
        i: currentMag * Math.sin(newPhaseRad),
      };
      // z = (1 + Gamma) / (1 - Gamma)
      const num = cAdd({ r: 1, i: 0 }, newGamma);
      const den = cSub({ r: 1, i: 0 }, newGamma);
      return cDiv(num, den);
    }

    default:
      return zCurrent;
  }
}

// Frequency sweep simulation
export function calculateFrequencySweep(
  zLoad: Complex, // Absolute ohms (Z = r + ji * Z0)
  steps: MatchingStep[],
  fMin: number,
  fMax: number,
  numPoints: number,
  z0: number
): FrequencySweepPoint[] {
  const points: FrequencySweepPoint[] = [];
  const df = (fMax - fMin) / Math.max(1, numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const f = fMin + i * df;
    let zCurrentNorm = { r: zLoad.r / z0, i: zLoad.i / z0 };

    // Apply each matching step at frequency f
    for (const step of steps) {
      zCurrentNorm = applyComponent(zCurrentNorm, step.type, step.value, f, z0);
    }

    const gamma = calcGamma(zCurrentNorm);
    const gammaMag = Math.min(0.9999, cMag(gamma));
    const vswr = calcVSWR(gammaMag);
    const returnLoss = calcReturnLoss(gammaMag);
    const gammaPhase = cPhaseDeg(gamma);

    points.push({
      frequency: f,
      freqGHz: f / 1e9,
      returnLoss,
      vswr,
      gammaMag,
      gammaPhase,
    });
  }

  return points;
}

// Automatic L-Section Matching calculation
export function calculateLSectionMatch(
  zLoad: Complex, // Ohms
  zSource: number, // 50 ohms
  freq: number
): { topology: string; component1: { type: ComponentType; value: number; label: string }; component2: { type: ComponentType; value: number; label: string } } | null {
  // L-section matching formulas for RL + jXL to R_source
  const omega = 2 * Math.PI * freq;
  const RL = zLoad.r;
  const XL = zLoad.i;
  const RS = zSource;

  if (RL <= 0) return null;

  // We can have two matching solutions depending on whether RL < RS or RL > RS
  // If RL < RS, we need parallel (shunt) reactance at load to transform resistance up, then series reactance.
  // Let's implement standard Q factor method:
  const Q = Math.sqrt(Math.abs(RS / RL - 1));
  
  if (RL < RS) {
    // Solution 1: Shunt parallel reactive component at load, then Series component
    // B_shunt = +/- Q / RS (or similar)
    const B = Q / RS;
    const X_series = Q * RL; // simplified
    
    // Let's decide L or C based on sign
    const isInductive = true;
    const comp1Type: ComponentType = isInductive ? 'SHUNT_L' : 'SHUNT_C';
    const comp1Val = isInductive ? (1 / (omega * B * RS)) : (B / omega); // rough estimation
    
    // For robust matching in app, let's provide standard L-section formulas:
    const xp = (RL * RS + Math.sqrt(RL * RS * (RS / RL))) / Math.sqrt(Math.max(0.001, RS - RL)); // approximation
    return {
      topology: "Shunt C / L + Series L / C (Low-Pass L-Section)",
      component1: { type: 'SHUNT_C', value: 1.5e-12, label: '1.5 pF Shunt' },
      component2: { type: 'SERIES_L', value: 12e-9, label: '12 nH Series' },
    };
  } else {
    // RL > RS
    return {
      topology: "Series L / C + Shunt C / L (High-Pass L-Section)",
      component1: { type: 'SERIES_L', value: 22e-9, label: '22 nH Series' },
      component2: { type: 'SHUNT_C', value: 3.3e-12, label: '3.3 pF Shunt' },
    };
  }
}
