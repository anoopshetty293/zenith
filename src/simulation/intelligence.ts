/**
 * intelligence.ts
 * The D3 intelligence engine.
 *
 * CRITICAL RULE: This module ONLY receives ObservableTelemetry.
 * It NEVER has access to GroundTruth or ActiveDisturbance.
 *
 * Pipeline:
 *  ObservableTelemetry[] → detectAnomaly → diagnose → predict → recommendMitigation
 */

import { ObservableTelemetry, TelemetryStats } from '../types/telemetry';
import {
  AnomalyEvent,
  AnomalySeverity,
  AffectedSubsystem,
  AnomalyEvidence,
  CauseHypothesis,
  Diagnosis,
  Prediction,
  MetricPrediction,
  TrendDirection,
  Mitigation,
  MitigationAction,
} from '../types/intelligence';
import { DisturbanceType, DISTURBANCE_CATALOG } from '../types/disturbances';
import { Route } from '../types/links';

// ─── Baseline thresholds (nominal operating parameters) ───────────────────────
const BASELINE_SNR_DB = 25;
const BASELINE_LINK_MARGIN_DB = 10;
const BASELINE_POINTING_ERROR_URAD = 8;
// Measured from the PAT model's own steady state with zero disturbances
// (tickPAT's detection-confidence formula is a function of the beacon's
// fixed rest offset from FOV centre, not of tracking lock quality — so even a
// fully LOCKED, undisturbed link settles at ~0.68, never ~1.0). Baselining
// this against a naive "should be near-perfect" assumption made every nominal
// session look like a permanent low-grade sensor anomaly.
const BASELINE_DETECTION_CONFIDENCE = 0.68;
const BASELINE_BER_LOG10 = -7;
const BASELINE_BEACON_JITTER_URAD = 3;

// Anomaly detection thresholds (deviation from baseline to trigger)
const ANOMALY_SNR_DELTA = 4;          // dB drop
const ANOMALY_POINTING_DELTA = 15;    // μrad increase
const ANOMALY_CONFIDENCE_DELTA = 0.2; // drop

// ─── Rolling statistics ───────────────────────────────────────────────────────
export function computeStats(values: number[]): TelemetryStats {
  if (values.length === 0) {
    return { mean: 0, std: 0, trend: 0, variance: 0, min: 0, max: 0 };
  }
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Linear regression slope for trend
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  const trend = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

  return { mean, std, trend, variance, min, max };
}

function extractWindow(history: ObservableTelemetry[], windowS: number): ObservableTelemetry[] {
  if (history.length === 0) return [];
  const latest = history[history.length - 1].timestamp;
  return history.filter(h => h.timestamp >= latest - windowS);
}

// ─── ANOMALY DETECTION ────────────────────────────────────────────────────────
export function detectAnomaly(history: ObservableTelemetry[]): AnomalyEvent | null {
  if (history.length < 5) return null;

  const window = extractWindow(history, 15); // 15-second window
  if (window.length < 3) return null;

  const snrValues = window.map(h => h.snrDb);
  const pointingValues = window.map(h => h.pointingErrorUrad);
  const confidenceValues = window.map(h => h.detectionConfidence);
  const berValues = window.map(h => h.berLog10);
  const powerValues = window.map(h => h.receivedPowerDbm);

  const snrStats = computeStats(snrValues);
  const pointingStats = computeStats(pointingValues);
  const confidenceStats = computeStats(confidenceValues);

  const evidence: AnomalyEvidence[] = [];
  let severity: AnomalySeverity = 'LOW';
  let subsystem: AffectedSubsystem = 'OPTICAL_LINK';

  // Check SNR degradation
  if (snrStats.mean < BASELINE_SNR_DB - ANOMALY_SNR_DELTA) {
    evidence.push({
      metric: 'SNR',
      observedValue: snrStats.mean,
      baselineValue: BASELINE_SNR_DB,
      deviation: BASELINE_SNR_DB - snrStats.mean,
      description: `SNR ${(BASELINE_SNR_DB - snrStats.mean).toFixed(1)} dB below baseline`,
    });
  }

  // Check pointing error increase
  if (pointingStats.mean > BASELINE_POINTING_ERROR_URAD + ANOMALY_POINTING_DELTA) {
    evidence.push({
      metric: 'Pointing Error',
      observedValue: pointingStats.mean,
      baselineValue: BASELINE_POINTING_ERROR_URAD,
      deviation: pointingStats.mean - BASELINE_POINTING_ERROR_URAD,
      description: `Pointing error ${(pointingStats.mean - BASELINE_POINTING_ERROR_URAD).toFixed(0)} μrad above baseline`,
    });
    subsystem = evidence.length > 1 ? 'MULTI' : 'PAT';
  }

  // Check detection confidence drop
  if (confidenceStats.mean < BASELINE_DETECTION_CONFIDENCE - ANOMALY_CONFIDENCE_DELTA) {
    evidence.push({
      metric: 'Detection Confidence',
      observedValue: confidenceStats.mean,
      baselineValue: BASELINE_DETECTION_CONFIDENCE,
      deviation: BASELINE_DETECTION_CONFIDENCE - confidenceStats.mean,
      description: `Detection confidence ${((BASELINE_DETECTION_CONFIDENCE - confidenceStats.mean) * 100).toFixed(0)}% below baseline`,
    });
    subsystem = evidence.some(e => e.metric === 'Pointing Error') ? 'MULTI' : 'SENSOR';
  }

  // Check SNR trend (degrading)
  if (snrStats.trend < -0.3) {
    evidence.push({
      metric: 'SNR Trend',
      observedValue: snrStats.trend,
      baselineValue: 0,
      deviation: Math.abs(snrStats.trend),
      description: `SNR declining at ${Math.abs(snrStats.trend).toFixed(2)} dB/s`,
    });
  }

  // Check beacon jitter increase
  const jitterValues = window.map(h => h.beaconJitterUrad);
  const jitterStats = computeStats(jitterValues);
  if (jitterStats.mean > BASELINE_BEACON_JITTER_URAD * 2.5) {
    evidence.push({
      metric: 'Beacon Jitter',
      observedValue: jitterStats.mean,
      baselineValue: BASELINE_BEACON_JITTER_URAD,
      deviation: jitterStats.mean - BASELINE_BEACON_JITTER_URAD,
      description: `Beacon jitter ${(jitterStats.mean).toFixed(1)} μrad (${(jitterStats.mean / BASELINE_BEACON_JITTER_URAD).toFixed(1)}× baseline)`,
    });
  }

  if (evidence.length === 0) return null;

  // Severity classification
  const snrDrop = BASELINE_SNR_DB - snrStats.mean;
  if (snrDrop > 12 || pointingStats.mean > 100 || confidenceStats.mean < 0.3) {
    severity = 'CRITICAL';
  } else if (snrDrop > 6 || pointingStats.mean > 50 || confidenceStats.mean < 0.6) {
    severity = 'HIGH';
  } else if (snrDrop > 3 || pointingStats.mean > 25) {
    severity = 'MEDIUM';
  }

  return {
    detectedAtS: history[history.length - 1].timestamp,
    severity,
    affectedSubsystem: subsystem,
    evidence,
    description: `${evidence.length} anomalous metric${evidence.length > 1 ? 's' : ''} detected`,
  };
}

// ─── DIAGNOSIS ────────────────────────────────────────────────────────────────
export function diagnose(history: ObservableTelemetry[]): Diagnosis | null {
  if (history.length < 8) return null;

  const window = extractWindow(history, 20);
  if (window.length < 5) return null;

  // Extract telemetry statistics
  const snrStats = computeStats(window.map(h => h.snrDb));
  const pointingStats = computeStats(window.map(h => h.pointingErrorUrad));
  const confidenceStats = computeStats(window.map(h => h.detectionConfidence));
  const jitterStats = computeStats(window.map(h => h.beaconJitterUrad));
  const powerStats = computeStats(window.map(h => h.receivedPowerDbm));
  const berStats = computeStats(window.map(h => h.berLog10));
  const atmStats = computeStats(window.map(h => h.atmosphericLossDb));

  const hasOrbital = window.some(h => h.orbital != null);
  const hasDebris = window.some(h => h.debris != null);

  // Derived features for pattern matching
  const snrDrop = BASELINE_SNR_DB - snrStats.mean;
  const snrFluctuation = snrStats.std;
  const pointingIncrease = pointingStats.mean - BASELINE_POINTING_ERROR_URAD;
  const confidenceDrop = BASELINE_DETECTION_CONFIDENCE - confidenceStats.mean;
  const jitterIncrease = jitterStats.mean - BASELINE_BEACON_JITTER_URAD;
  const atmIncrease = atmStats.mean - 0.5; // baseline ~0.5 dB
  const powerDrop = -powerStats.trend * 10; // positive = dropping
  const isPeriodicPointing = detectPeriodicSignal(window.map(h => h.pointingErrorUrad));

  // Score each hypothesis
  const hypotheses: CauseHypothesis[] = [];

  // ── Turbulence ──────────────────────────────────────────────────────────
  {
    let score = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    // Turbulence: beacon jitter ↑, atm ↑ (fluctuating), SNR fluctuating (not steady drop)
    if (jitterIncrease > 5) { score += 30; supporting.push('Beacon jitter elevated'); }
    if (snrFluctuation > 1.5) { score += 25; supporting.push('SNR fluctuating (not steady)'); }
    if (atmIncrease > 0.5) { score += 20; supporting.push('Atmospheric loss elevated'); }
    if (confidenceDrop < 0.1) { score += 10; supporting.push('Detection confidence relatively stable'); }
    if (isPeriodicPointing) { score -= 15; contradicting.push('Periodic pointing pattern (not turbulence)'); }
    if (confidenceDrop > 0.3) { score -= 10; contradicting.push('High confidence drop (atypical for turbulence)'); }
    if (atmIncrease > 5 && snrFluctuation < 0.5) { score -= 20; contradicting.push('Steady attenuation (fog more likely)'); }

    hypotheses.push({
      type: 'TURBULENCE',
      label: 'Atmospheric Turbulence',
      confidence: 0,
      matchScore: Math.max(0, score),
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
    });
  }

  // ── Fog ─────────────────────────────────────────────────────────────────
  {
    let score = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    // Fog: steady power/SNR drop, no jitter, no pointing issue
    if (snrDrop > 3 && snrFluctuation < 1.0) { score += 35; supporting.push('Steady SNR reduction without fluctuation'); }
    if (atmIncrease > 2) { score += 30; supporting.push('Atmospheric loss significantly elevated'); }
    if (jitterIncrease < 3) { score += 20; supporting.push('Beacon jitter not elevated'); }
    if (pointingIncrease < 10) { score += 15; supporting.push('Pointing error stable'); }
    if (jitterIncrease > 5) { score -= 25; contradicting.push('Beacon jitter elevated (not fog)'); }
    if (isPeriodicPointing) { score -= 20; contradicting.push('Periodic pointing (mechanical cause)'); }
    if (confidenceDrop > 0.3) { score -= 5; contradicting.push('High confidence drop (unexpected for fog)'); }

    hypotheses.push({
      type: 'FOG',
      label: 'Fog / Atmospheric Attenuation',
      confidence: 0,
      matchScore: Math.max(0, score),
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
    });
  }

  // ── Camera Vibration ─────────────────────────────────────────────────────
  {
    let score = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    // Camera vibration: periodic pointing, stable beacon, no atmospheric effect
    if (isPeriodicPointing) { score += 40; supporting.push('Periodic pointing error pattern detected'); }
    if (pointingIncrease > 15) { score += 25; supporting.push('Significant pointing error increase'); }
    if (jitterIncrease < 4) { score += 20; supporting.push('Beacon jitter not elevated (camera-side issue)'); }
    if (atmIncrease < 1) { score += 15; supporting.push('No atmospheric attenuation increase'); }
    if (confidenceDrop < 0.1) { score += 10; supporting.push('Detection confidence unaffected'); }
    if (atmIncrease > 2) { score -= 25; contradicting.push('Atmospheric loss elevated (atmospheric cause)'); }
    if (jitterIncrease > 8) { score -= 15; contradicting.push('High beacon jitter (source-side disturbance)'); }

    hypotheses.push({
      type: 'CAMERA_VIBRATION',
      label: 'Camera / Terminal Vibration',
      confidence: 0,
      matchScore: Math.max(0, score),
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
    });
  }

  // ── Sensor Noise ─────────────────────────────────────────────────────────
  {
    let score = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    // Sensor noise: confidence ↓, coordinate noise, but power/SNR STABLE
    if (confidenceDrop > 0.2) { score += 35; supporting.push('Detection confidence significantly reduced'); }
    if (snrDrop < 2) { score += 30; supporting.push('SNR relatively stable (optical path not affected)'); }
    if (atmIncrease < 0.5) { score += 20; supporting.push('No atmospheric attenuation change'); }
    if (jitterStats.std > jitterStats.mean * 0.5) { score += 15; supporting.push('High beacon coordinate variability'); }
    if (snrDrop > 5) { score -= 20; contradicting.push('Significant SNR drop (not just sensor noise)'); }
    if (atmIncrease > 2) { score -= 25; contradicting.push('Atmospheric loss elevated (atmospheric cause)'); }
    if (jitterIncrease > 8) { score -= 10; contradicting.push('High beacon jitter (source disturbance)'); }

    hypotheses.push({
      type: 'SENSOR_NOISE',
      label: 'Sensor / Detector Noise',
      confidence: 0,
      matchScore: Math.max(0, score),
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
    });
  }

  // ── Beacon Loss ──────────────────────────────────────────────────────────
  {
    let score = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    if (confidenceStats.mean < 0.3) { score += 40; supporting.push('Detection confidence critically low'); }
    if (snrDrop > 10) { score += 25; supporting.push('Severe SNR degradation'); }
    if (pointingIncrease > 30) { score += 20; supporting.push('Large pointing error (tracking lost)'); }
    if (window[window.length - 1]?.trackingStatus === 'LOST') { score += 15; supporting.push('Tracking status: LOST'); }
    if (confidenceStats.mean > 0.5) { score -= 30; contradicting.push('Confidence not critically low'); }

    hypotheses.push({
      type: 'BEACON_LOSS',
      label: 'Beacon Loss / Occlusion',
      confidence: 0,
      matchScore: Math.max(0, score),
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
    });
  }

  // ── Attitude Jitter (space only) ─────────────────────────────────────────
  if (hasOrbital) {
    let score = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    if (isPeriodicPointing) { score += 35; supporting.push('Periodic pointing pattern (spacecraft attitude)'); }
    if (pointingIncrease > 20) { score += 25; supporting.push('Elevated pointing error'); }
    if (atmIncrease < 0.5) { score += 15; supporting.push('No atmospheric contribution'); }
    if (jitterIncrease < 5) { score += 10; supporting.push('Beacon stable (spacecraft-side disturbance)'); }
    if (atmIncrease > 2) { score -= 20; contradicting.push('Atmospheric loss elevated'); }

    hypotheses.push({
      type: 'ATTITUDE_JITTER',
      label: 'Spacecraft Attitude Jitter',
      confidence: 0,
      matchScore: Math.max(0, score),
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
    });
  }

  // ── Debris Interference (space only) ─────────────────────────────────────
  if (hasDebris) {
    let score = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    const debrisClose = window.some(h => h.debris && h.debris.closestDebrisDistanceKm < 100);
    const suddenPowerDrop = powerStats.trend < -0.5;

    if (debrisClose) { score += 40; supporting.push('Debris proximity detected in telemetry'); }
    if (suddenPowerDrop) { score += 30; supporting.push('Sudden received power reduction'); }
    if (jitterIncrease < 3) { score += 20; supporting.push('Beacon jitter stable (path-blocking not tracking)'); }
    if (pointingIncrease < 10) { score += 15; supporting.push('Pointing error stable'); }
    if (!debrisClose) { score -= 30; contradicting.push('No debris proximity in telemetry'); }
    if (jitterIncrease > 8) { score -= 15; contradicting.push('High jitter not consistent with debris'); }

    hypotheses.push({
      type: 'DEBRIS_INTERFERENCE',
      label: 'Debris Path Interference',
      confidence: 0,
      matchScore: Math.max(0, score),
      supportingEvidence: supporting,
      contradictingEvidence: contradicting,
    });
  }

  // ── Normalize to confidence scores ────────────────────────────────────────
  const totalScore = hypotheses.reduce((sum, h) => sum + h.matchScore, 0);
  const normalized = hypotheses.map(h => ({
    ...h,
    confidence: totalScore > 0 ? h.matchScore / totalScore : 0,
  }));

  const sorted = [...normalized].sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0];

  // Multi-cause detection: if top two are close in confidence
  const multiCause = sorted.length >= 2 &&
    sorted[1].confidence > 0.25 &&
    sorted[0].confidence < 0.65;

  return {
    mostLikelyCause: top,
    alternatives: sorted.slice(1, 4),
    allHypotheses: sorted,
    diagnosedAtS: history[history.length - 1].timestamp,
    multiCause,
    confidence: top.confidence,
  };
}

// ─── PREDICTION ───────────────────────────────────────────────────────────────
export function predict(history: ObservableTelemetry[]): Prediction | null {
  if (history.length < 6) return null;

  const window20 = extractWindow(history, 20);
  if (window20.length < 4) return null;

  const snrPred = predictMetric(window20.map(h => h.snrDb), 'higher_better', 10, 15);
  const marginPred = predictMetric(window20.map(h => h.linkMarginDb), 'higher_better', 3, 8);
  const pointPred = predictMetric(window20.map(h => h.pointingErrorUrad), 'lower_better', 30, 80);
  const confPred = predictMetric(window20.map(h => h.detectionConfidence), 'higher_better', 0.5, 0.3);

  // Predict link status
  const snrTrend = snrPred.trend;
  const marginTrend = marginPred.trend;

  let predictedLinkStatus: Prediction['predictedLinkStatus'] = 'stable';
  if (snrTrend === 'critical' || marginTrend === 'critical') {
    predictedLinkStatus = 'likely_interruption';
  } else if (snrTrend === 'degrading' || marginTrend === 'degrading') {
    predictedLinkStatus = 'degrading';
  }

  // Estimate time to critical
  let estimatedTimeToCriticalS: number | null = null;
  const snrStats = computeStats(window20.map(h => h.snrDb));
  if (snrStats.trend < -0.1) {
    const timeToMinSnr = (snrStats.mean - 10) / Math.abs(snrStats.trend);
    estimatedTimeToCriticalS = Math.max(0, timeToMinSnr);
  }

  // Tracking loss risk
  const avgConf = confPred.currentValue;
  const trackingLossRisk: Prediction['trackingLossRisk'] =
    avgConf < 0.3 ? 'HIGH' :
    avgConf < 0.6 ? 'MEDIUM' : 'LOW';

  return {
    snr: snrPred,
    linkMargin: marginPred,
    pointingError: pointPred,
    detectionConfidence: confPred,
    predictedLinkStatus,
    estimatedTimeToCriticalS,
    trackingLossRisk,
    predictedAtS: history[history.length - 1].timestamp,
  };
}

function predictMetric(
  values: number[],
  direction: 'higher_better' | 'lower_better',
  warnThreshold: number,
  critThreshold: number
): MetricPrediction {
  const stats = computeStats(values);
  const current = values[values.length - 1] ?? stats.mean;

  // Linear extrapolation
  const pred10s = current + stats.trend * 10;
  const pred30s = current + stats.trend * 30;

  let trend: TrendDirection;
  const isBad = direction === 'higher_better'
    ? (v: number) => v < critThreshold
    : (v: number) => v > critThreshold;
  const isWarn = direction === 'higher_better'
    ? (v: number) => v < warnThreshold
    : (v: number) => v > warnThreshold;

  if (isBad(current) || isBad(pred10s)) {
    trend = 'critical';
  } else if (isWarn(pred10s) || (direction === 'higher_better' ? stats.trend < -0.2 : stats.trend > 0.2)) {
    trend = 'degrading';
  } else if (Math.abs(stats.trend) < 0.05) {
    trend = 'stable';
  } else {
    trend = direction === 'higher_better'
      ? (stats.trend > 0 ? 'improving' : 'degrading')
      : (stats.trend < 0 ? 'improving' : 'degrading');
  }

  return {
    currentValue: current,
    predictedValueIn10s: pred10s,
    predictedValueIn30s: pred30s,
    trend,
    confidence: Math.min(0.9, values.length / 20),
  };
}

// ─── MITIGATION ───────────────────────────────────────────────────────────────
export function recommendMitigation(
  prediction: Prediction | null,
  diagnosis: Diagnosis | null,
  alternateRoutes: Route[]
): Mitigation | null {
  if (!prediction && !diagnosis) return null;

  const cause = diagnosis?.mostLikelyCause?.type;
  const linkStatus = prediction?.predictedLinkStatus ?? 'stable';
  const trackingRisk = prediction?.trackingLossRisk ?? 'LOW';

  let primaryAction: MitigationAction = 'CONTINUE_TRACKING';
  let reason = 'Link operating within acceptable parameters.';
  let urgency: Mitigation['urgency'] = 'LOW';
  let recommendedRoute: Route | null = null;

  // Determine action based on diagnosis + prediction
  if (cause === 'BEACON_LOSS' || trackingRisk === 'HIGH') {
    primaryAction = 'REACQUIRE_BEACON';
    reason = 'Beacon detection confidence critically low. Re-acquisition sequence recommended.';
    urgency = 'IMMEDIATE';
  } else if (
    linkStatus === 'likely_interruption' ||
    (prediction?.estimatedTimeToCriticalS && prediction.estimatedTimeToCriticalS < 30)
  ) {
    if (alternateRoutes.length > 0 && alternateRoutes[0].analysis.score > 0.4) {
      primaryAction = 'SWITCH_ROUTE';
      recommendedRoute = alternateRoutes[0];
      const eta = prediction?.estimatedTimeToCriticalS;
      reason = `Primary link predicted unavailable in ${eta ? eta.toFixed(0) + 's' : 'soon'}. Alternate route available with score ${(alternateRoutes[0].analysis.score * 100).toFixed(0)}%.`;
      urgency = 'HIGH';
    } else {
      primaryAction = 'PREPARE_FOR_INTERRUPTION';
      reason = 'Link interruption predicted. No suitable alternate route available. Prepare for downtime.';
      urgency = 'HIGH';
    }
  } else if (cause === 'CAMERA_VIBRATION' || cause === 'ATTITUDE_JITTER') {
    primaryAction = 'INCREASE_TRACKING_CORRECTION';
    reason = `${cause === 'CAMERA_VIBRATION' ? 'Camera vibration' : 'Attitude jitter'} causing tracking degradation. Increasing tracking correction gain recommended.`;
    urgency = 'MEDIUM';
  } else if (cause === 'SENSOR_NOISE') {
    primaryAction = 'INCREASE_TRACKING_CORRECTION';
    reason = 'Sensor noise degrading beacon detection. Increasing filter bandwidth may improve tracking stability.';
    urgency = 'MEDIUM';
  } else if (linkStatus === 'degrading') {
    if (alternateRoutes.length > 0 && alternateRoutes[0].analysis.score > 0.5) {
      primaryAction = 'SWITCH_ROUTE';
      recommendedRoute = alternateRoutes[0];
      reason = 'Link quality degrading. Pre-emptive route switch recommended before critical failure.';
      urgency = 'MEDIUM';
    } else {
      primaryAction = 'MAINTAIN_LINK';
      reason = 'Link degrading but within acceptable thresholds. Continue monitoring.';
      urgency = 'LOW';
    }
  } else {
    primaryAction = 'CONTINUE_TRACKING';
    reason = 'Link stable. No action required.';
    urgency = 'LOW';
  }

  return {
    primaryAction,
    recommendedRoute,
    reason,
    urgency,
    predictedImprovementDb: recommendedRoute
      ? recommendedRoute.worstSnrDb - (prediction?.snr.currentValue ?? 0)
      : null,
    acceptedAt: null,
    rejectedAt: null,
  };
}

// ─── Utility: Detect periodic signal ─────────────────────────────────────────
/**
 * Simple periodicity detection using autocorrelation.
 * Returns true if the signal has a dominant periodic component.
 */
function detectPeriodicSignal(values: number[]): boolean {
  if (values.length < 10) return false;

  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const centered = values.map(v => v - mean);

  // Autocorrelation at lag 1..n/3
  const maxLag = Math.floor(n / 3);
  let maxCorr = 0;

  for (let lag = 2; lag <= maxLag; lag++) {
    let corr = 0;
    let norm = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += centered[i] * centered[i + lag];
      norm += centered[i] * centered[i];
    }
    if (norm > 0) {
      const r = corr / norm;
      if (r > maxCorr) maxCorr = r;
    }
  }

  return maxCorr > 0.4; // threshold for periodic detection
}
