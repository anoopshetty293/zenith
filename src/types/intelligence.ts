import { DisturbanceType } from './disturbances';
import { Route } from './links';

// ─── Anomaly ──────────────────────────────────────────────────────────────────
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AffectedSubsystem = 'PAT' | 'OPTICAL_LINK' | 'SENSOR' | 'ORBITAL' | 'DEBRIS' | 'MULTI';

export interface AnomalyEvidence {
  metric: string;
  observedValue: number;
  baselineValue: number;
  deviation: number;
  description: string;
}

export interface AnomalyEvent {
  detectedAtS: number;
  severity: AnomalySeverity;
  affectedSubsystem: AffectedSubsystem;
  evidence: AnomalyEvidence[];
  description: string;
}

// ─── Cause Hypothesis ─────────────────────────────────────────────────────────
export interface CauseHypothesis {
  type: DisturbanceType;
  label: string;
  confidence: number;       // 0–1
  matchScore: number;       // raw score before normalization
  supportingEvidence: string[];
  contradictingEvidence: string[];
}

// ─── Diagnosis ────────────────────────────────────────────────────────────────
export interface Diagnosis {
  mostLikelyCause: CauseHypothesis;
  alternatives: CauseHypothesis[];
  diagnosedAtS: number;
  allHypotheses: CauseHypothesis[];
  multiCause: boolean;    // true if multi-disturbance suspected
  confidence: number;     // overall confidence 0–1
}

// ─── Confidence History (for graph) ──────────────────────────────────────────
export interface ConfidenceHistoryPoint {
  timeS: number;
  hypotheses: Record<string, number>; // DisturbanceType → confidence
}

// ─── Prediction ──────────────────────────────────────────────────────────────
export type TrendDirection = 'improving' | 'stable' | 'degrading' | 'critical';

export interface MetricPrediction {
  currentValue: number;
  predictedValueIn10s: number;
  predictedValueIn30s: number;
  trend: TrendDirection;
  confidence: number;
}

export interface Prediction {
  snr: MetricPrediction;
  linkMargin: MetricPrediction;
  pointingError: MetricPrediction;
  detectionConfidence: MetricPrediction;
  predictedLinkStatus: 'stable' | 'degrading' | 'likely_interruption';
  estimatedTimeToCriticalS: number | null;
  trackingLossRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  predictedAtS: number;
}

// ─── Mitigation ───────────────────────────────────────────────────────────────
export type MitigationAction =
  | 'CONTINUE_TRACKING'
  | 'INCREASE_TRACKING_CORRECTION'
  | 'REACQUIRE_BEACON'
  | 'MAINTAIN_LINK'
  | 'SWITCH_ROUTE'
  | 'PREPARE_FOR_INTERRUPTION';

export interface Mitigation {
  primaryAction: MitigationAction;
  recommendedRoute: Route | null;
  reason: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';
  predictedImprovementDb: number | null;
  acceptedAt: number | null;   // sim time when user accepted
  rejectedAt: number | null;
}

// ─── Ground Truth Verification ────────────────────────────────────────────────
export interface GroundTruthVerification {
  diagnosedCause: string;
  actualCause: string;
  match: boolean;
  diagnosisConfidence: number;
  explanation: string;
  missedSignals?: string[];
  ambiguatingFactors?: string[];
}

// ─── Timeline Event ───────────────────────────────────────────────────────────
export type TimelineEventType =
  | 'NORMAL'
  | 'ANOMALY_DETECTED'
  | 'DIAGNOSIS_UPDATED'
  | 'PREDICTION_UPDATED'
  | 'MITIGATION_RECOMMENDED'
  | 'MITIGATION_ACCEPTED'
  | 'MITIGATION_REJECTED'
  | 'ROUTE_SWITCHED'
  | 'RECOVERY'
  | 'GROUND_TRUTH_REVEALED'
  | 'DISTURBANCE_INJECTED';

export interface TimelineEvent {
  id: string;
  timeS: number;
  wallTime: number;
  type: TimelineEventType;
  description: string;
  severity?: AnomalySeverity;
  /** DIAGNOSIS_UPDATED only: the cause type the model claimed at this moment. */
  diagnosedType?: DisturbanceType;
  /**
   * DIAGNOSIS_UPDATED only: whether that claim matched ground truth. Only
   * ever populated once the user has revealed ground truth THIS session
   * (retroactively for history, live for new diagnoses afterward) — never
   * computed or shown before that, so nothing about an unrevealed disturbance
   * leaks through this field.
   */
  verifiedMatch?: boolean;
}

// ─── Test Case ────────────────────────────────────────────────────────────────
export type TestCaseDashboard = 'D1' | 'D2';
export type TestCaseLinkType = 'GROUND_GROUND' | 'GROUND_SAT' | 'SAT_SAT';

export interface TestCase {
  id: string;
  name: string;
  dashboard: TestCaseDashboard;
  linkType: TestCaseLinkType;
  hiddenDisturbance: DisturbanceType;
  hiddenDisturbanceLabel: string;
  disturbanceIntensity: number;
  durationS: number;
  description: string;
  // Results (filled after completion)
  result?: TestCaseResult;
}

export interface TestCaseResult {
  anomalyDetected: boolean;
  detectionTimeS: number | null;
  diagnosedCause: string | null;
  diagnosisMatch: boolean | null;
  predictionMade: boolean;
  mitigationAccepted: boolean;
  recoveryTimeS: number | null;
  notes: string;
}

// ─── Simulation Run ───────────────────────────────────────────────────────────
export interface SimulationRun {
  id: string;
  startTime: number;  // Date.now()
  endTime: number | null;
  dashboard: TestCaseDashboard;
  linkType: TestCaseLinkType;
  testCaseId: string | null;
  disturbanceType: DisturbanceType | null;
  durationS: number;
  diagnosis: Diagnosis | null;
  verification: GroundTruthVerification | null;
  mitigation: Mitigation | null;
  result: TestCaseResult | null;
}
