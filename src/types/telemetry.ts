import { TrackingStatus } from './links';

// ─── Observable Telemetry (what D3 receives — no ground truth) ───────────────
export interface OrbitalTelemetry {
  distanceKm: number;
  elevationDeg: number | null;
  hasLOS: boolean;
  losWindowRemainingS: number;
  relativeVelocityKms: number;
}

export interface DebrisTelemetry {
  closestDebrisDistanceKm: number;
  predictedIntersection: boolean;
  etaToIntersectionS: number;
  intersectionDurationS: number;
}

export interface ObservableTelemetry {
  timestamp: number; // simulation time in seconds
  wallTime: number;  // Date.now()

  // PAT
  beaconX: number;
  beaconY: number;
  cameraCenterX: number;
  cameraCenterY: number;
  pointingErrorUrad: number;
  beaconJitterUrad: number;   // instantaneous jitter magnitude
  detectionConfidence: number;
  trackingStatus: TrackingStatus;

  // Communication link
  receivedPowerDbm: number;
  snrDb: number;
  berLog10: number;
  linkMarginDb: number;
  atmosphericLossDb: number;
  hasLOS: boolean;
  linkStatusRaw: string;

  // Network
  activeRouteNodeIds: string[];
  primaryRouteAvailable: boolean;
  alternateRouteAvailable: boolean;

  // Optional orbital (D2 only)
  orbital?: OrbitalTelemetry;

  // Optional debris (D2 only)
  debris?: DebrisTelemetry;
}

// ─── Ground Truth (NEVER sent to D3 intelligence engine) ─────────────────────
export interface GroundTruth {
  disturbanceType: string;       // e.g. 'TURBULENCE'
  disturbanceIntensity: number;  // 0–1
  actualCause: string;           // human-readable
  // What future state will look like if no action taken
  predictedFutureStatus: 'stable' | 'degrading' | 'critical';
  estimatedTimeToCriticalS: number;
}

// ─── Telemetry Sample (stored per tick) ──────────────────────────────────────
export interface TelemetrySample {
  observable: ObservableTelemetry;
  // groundTruth is stored internally but MUST NOT be passed to intelligence
  groundTruth: GroundTruth | null;
}

// ─── Derived statistics over a window ────────────────────────────────────────
export interface TelemetryStats {
  mean: number;
  std: number;
  trend: number;      // slope (unit/s)
  variance: number;
  min: number;
  max: number;
}
