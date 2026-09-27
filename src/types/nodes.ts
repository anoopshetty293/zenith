// ─── Wavelengths ─────────────────────────────────────────────────────────────
export type Wavelength = 850 | 1064 | 1550; // nm
export const ALL_WAVELENGTHS: Wavelength[] = [850, 1064, 1550];

export function wavelengthIntersection(a: Wavelength[], b: Wavelength[]): Wavelength[] {
  return a.filter(w => b.includes(w));
}

// ─── Node Base ────────────────────────────────────────────────────────────────
export interface NodeBase {
  id: string;
  name: string;
  supportedWavelengths: Wavelength[];
  txPowerDbm: number;       // dBm
  rxSensitivityDbm: number; // dBm (minimum detectable)
  maxRangeKm: number;
  hasPAT: boolean;
  beamDivergenceUrad: number; // μrad half-angle
}

// ─── Ground Station ───────────────────────────────────────────────────────────
export interface GroundStation extends NodeBase {
  type: 'ground';
  // 2D canvas position for D1 visualization (0–1 normalized)
  x: number;
  y: number;
  // Geographic for D2
  latDeg: number;
  lonDeg: number;
  // Optional terrestrial mobility model used by the virtual testbed.
  vx?: number;
  vy?: number;
  motionPhase?: number;
  // Stable "home" position the terminal moves around. Without it a moving
  // node would slowly drift away from where it was placed.
  homeX?: number;
  homeY?: number;
}

// ─── Satellite ────────────────────────────────────────────────────────────────
export interface Satellite extends NodeBase {
  type: 'satellite';
  altitudeKm: number;
  inclinationDeg: number;
  // current true anomaly (radians, progresses with simulation)
  trueAnomalyRad: number;
  // RAAN for multi-sat scenarios
  raanDeg: number;
  // Derived: current 2D position in canvas coords (set by orbital engine)
  canvasX: number;
  canvasY: number;
}

// ─── Debris ──────────────────────────────────────────────────────────────────
export type DebrisRiskLevel = 'low' | 'medium' | 'high';

export interface Debris {
  id: string;
  name: string;
  altitudeKm: number;
  // angle around orbit (radians)
  trueAnomalyRad: number;
  angularVelocityRadS: number; // rad/s (debris orbit velocity)
  sizeM: number;               // cross-section diameter in meters
  riskLevel: DebrisRiskLevel;
  // Derived
  canvasX: number;
  canvasY: number;
  // distance from optical comm path (set by engine)
  distanceFromPathKm: number;
  predictedIntersection: boolean;
  etaToIntersectionS: number;
  intersectionDurationS: number;
}

export type NodeEntity = GroundStation | Satellite;
