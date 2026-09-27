import { Wavelength, NodeEntity } from './nodes';

// ─── PAT State ────────────────────────────────────────────────────────────────
export type TrackingStatus = 'LOCKED' | 'ACQUIRING' | 'DEGRADED' | 'LOST';

export interface PATState {
  // Beacon position in FOV (pixels, canvas coords -1 to 1 normalized)
  beaconX: number;
  beaconY: number;
  // Camera/optical-axis centre
  cameraCenterX: number;
  cameraCenterY: number;
  // Derived
  pointingErrorUrad: number;
  detectionConfidence: number; // 0–1
  trackingStatus: TrackingStatus;
  acquisitionTimeS: number;
  correctionRateHz: number;
  // PID integrator state (internal)
  _integralX: number;
  _integralY: number;
  _prevErrorX: number;
  _prevErrorY: number;
  // Visual/control telemetry for the optical gimbal.
  cameraAngleDeg: number;
  gimbalRateDegS: number;
  beaconVelocityUradS: number;
  acquisitionMode: 'STATIC_BEACON' | 'MOVING_BEACON';
  /** Operator-applied pointing-gain boost from accepting INCREASE_TRACKING_CORRECTION (0 = none). Decays back to 0 on its own. */
  correctionBoost: number;
}

// ─── Link Status ─────────────────────────────────────────────────────────────
export type LinkStatus = 'CONNECTED' | 'DEGRADED' | 'CRITICAL' | 'DISCONNECTED' | 'ESTABLISHING';

export interface Link {
  id: string;
  nodeAId: string;
  nodeBId: string;
  selectedWavelength: Wavelength | null;
  compatibleWavelengths: Wavelength[];
  status: LinkStatus;
  distanceKm: number;
  hasLOS: boolean;
  receivedPowerDbm: number;
  snrDb: number;
  berLog10: number;       // log10(BER), e.g. -6 means 1e-6
  linkMarginDb: number;
  freeSpaceLossDb: number;
  atmosphericLossDb: number;
  pointingLossDb: number;
  elevationDeg: number | null; // for Ground↔Sat links
}

// ─── Route ────────────────────────────────────────────────────────────────────
export type RouteStatus = 'ACTIVE' | 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'EVALUATING';

export interface RouteHop {
  fromId: string;
  toId: string;
  linkId: string;
  /** D2 only: this hop is currently obstructed by a debris object in its beam path. */
  blocked?: boolean;
  blockReason?: string;
}

export interface RouteAnalysis {
  wavelengthCompatible: boolean;
  hasLOS: boolean;
  snrAcceptable: boolean;
  linkMarginAcceptable: boolean;
  patStable: boolean;
  debrisFree: boolean;
  predictedStability: 'stable' | 'degrading' | 'unstable';
  score: number;
  /** Human-readable reasons used by Dashboard 2 adaptive routing. */
  reasons?: string[];
}

export interface Route {
  id: string;
  hops: RouteHop[];
  nodeIds: string[];       // ordered node IDs
  status: RouteStatus;
  totalDistanceKm: number;
  worstSnrDb: number;
  worstLinkMarginDb: number;
  analysis: RouteAnalysis;
  isPrimary: boolean;
  /** D2 only: this path was explicitly chosen node-by-node by the operator, not auto-suggested. */
  isManual?: boolean;
  /** Per-hop link budgets, in path order (ground routes). */
  hopLinks?: Link[];
}

// Why the active route last changed (drives the topology banner + timeline).
export type RouteChangeReason = 'AUTO' | 'MANUAL' | 'FALLBACK' | 'REVERT' | 'MITIGATION';

export interface RouteChange {
  id: number;
  atS: number;
  reason: RouteChangeReason;
  from: string[];
  to: string[];
}

// ─── Node with resolved entity ─────────────────────────────────────────────
export interface ResolvedRoute {
  route: Route;
  nodes: NodeEntity[];
}
