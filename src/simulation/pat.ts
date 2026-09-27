/**
 * Pointing, Acquisition and Tracking (PAT) simulation.
 *
 * The simulation deliberately separates two things that are often conflated:
 *  1) where the beacon actually is, and
 *  2) where the camera optical axis is pointing.
 *
 * This makes acquisition/re-acquisition visible: a stationary beacon can be
 * acquired by a moving gimbal, and a moving beacon can subsequently force the
 * gimbal to re-orient.
 */
import { PATState, TrackingStatus } from '../types/links';
import { DisturbanceEffect } from '../types/disturbances';
import { clamp } from './physics';

const KP = 0.11;
const KI = 0.003;
const KD = 0.018;
const LOCK_THRESHOLD = 0.02;
const DEGRADED_THRESHOLD = 0.15;
const LOST_THRESHOLD = 0.6;
const MAX_CORRECTION_PER_TICK = 0.045;
export const FOV_TO_URAD = 500;
/** How fast an operator-applied correctionBoost fades back to 0, per second. */
const CORRECTION_BOOST_DECAY_PER_S = 0.1;

export function createInitialPATState(): PATState {
  return {
    // Start with the beacon away from the optical axis so the acquisition
    // sequence is visible even before a disturbance is injected.
    beaconX: 0.28,
    beaconY: -0.16,
    cameraCenterX: -0.34,
    cameraCenterY: 0.22,
    pointingErrorUrad: 0,
    detectionConfidence: 1.0,
    trackingStatus: 'ACQUIRING',
    acquisitionTimeS: 0,
    correctionRateHz: 10,
    _integralX: 0,
    _integralY: 0,
    _prevErrorX: 0,
    _prevErrorY: 0,
    cameraAngleDeg: 0,
    gimbalRateDegS: 0,
    beaconVelocityUradS: 0,
    acquisitionMode: 'STATIC_BEACON',
    correctionBoost: 0,
  };
}

export function tickPAT(
  state: PATState,
  distEffect: DisturbanceEffect,
  simTimeS: number,
  dtS: number,
  phase: number
): PATState {
  // Static beacon during nominal operation. Optical disturbances can move the
  // observed beacon, while camera offsets represent terminal/gimbal motion.
  const isMovingBeacon = distEffect.beaconJitterAmplitude > 0 || distEffect.beaconCoordinateNoise > 0;

  const baseX = 0.28;
  const baseY = -0.16;
  const beaconMotionX = isMovingBeacon
    ? distEffect.beaconJitterAmplitude * (
        Math.sin(phase * 4.2) + 0.35 * Math.sin(phase * 8.9)
      )
    : 0;
  const beaconMotionY = isMovingBeacon
    ? distEffect.beaconJitterAmplitude * (
        Math.cos(phase * 3.7) + 0.25 * Math.cos(phase * 10.7)
      )
    : 0;
  // An accepted INCREASE_TRACKING_CORRECTION mitigation represents better
  // filtering/compensation of exactly the disturbance inputs it targets
  // (coordinate noise, mechanical offset) — damping them directly always
  // helps, unlike naively cranking PID gain, which can overshoot and get
  // WORSE against a fast-oscillating disturbance like vibration/jitter.
  const boostDamp = 1 / (1 + state.correctionBoost);
  const newCorrectionBoost = Math.max(0, state.correctionBoost - dtS * CORRECTION_BOOST_DECAY_PER_S);

  const coordNoiseX = distEffect.beaconCoordinateNoise * (Math.random() - 0.5) * 2 * boostDamp;
  const coordNoiseY = distEffect.beaconCoordinateNoise * (Math.random() - 0.5) * 2 * boostDamp;

  const beaconX = clamp(baseX + beaconMotionX + coordNoiseX, -0.95, 0.95);
  const beaconY = clamp(baseY + beaconMotionY + coordNoiseY, -0.95, 0.95);

  const dxBeacon = beaconX - state.beaconX;
  const dyBeacon = beaconY - state.beaconY;
  const beaconVelocityUradS = Math.sqrt(dxBeacon ** 2 + dyBeacon ** 2) * FOV_TO_URAD / Math.max(dtS, 0.001);

  const distanceFactor = Math.max(0, 1 - Math.sqrt(beaconX ** 2 + beaconY ** 2));
  const newConfidence = clamp(
    distEffect.detectionConfidenceMult * distanceFactor,
    0,
    1
  );
  const trackingGain = newConfidence > 0.2 ? 1 : newConfidence / 0.2;

  const errorX = beaconX - state.cameraCenterX;
  const errorY = beaconY - state.cameraCenterY;
  const newIntegralX = state._integralX + errorX * dtS;
  const newIntegralY = state._integralY + errorY * dtS;
  const derivativeX = (errorX - state._prevErrorX) / Math.max(dtS, 0.001);
  const derivativeY = (errorY - state._prevErrorY) / Math.max(dtS, 0.001);

  let correctionX = (KP * errorX + KI * newIntegralX + KD * derivativeX) * trackingGain;
  let correctionY = (KP * errorY + KI * newIntegralY + KD * derivativeY) * trackingGain;
  correctionX = clamp(correctionX, -MAX_CORRECTION_PER_TICK, MAX_CORRECTION_PER_TICK);
  correctionY = clamp(correctionY, -MAX_CORRECTION_PER_TICK, MAX_CORRECTION_PER_TICK);

  const camOffsetX = distEffect.cameraCenterOffsetX * boostDamp;
  const camOffsetY = distEffect.cameraCenterOffsetY * boostDamp;
  const newCamX = clamp(state.cameraCenterX + correctionX + camOffsetX, -0.95, 0.95);
  const newCamY = clamp(state.cameraCenterY + correctionY + camOffsetY, -0.95, 0.95);

  const residualX = beaconX - newCamX;
  const residualY = beaconY - newCamY;
  const residualMag = Math.sqrt(residualX ** 2 + residualY ** 2);
  const pointingErrorUrad = residualMag * FOV_TO_URAD;

  let trackingStatus: TrackingStatus;
  if (newConfidence < 0.1 || residualMag > LOST_THRESHOLD) trackingStatus = 'LOST';
  else if (residualMag > DEGRADED_THRESHOLD || newConfidence < 0.4) trackingStatus = 'DEGRADED';
  else if (residualMag > LOCK_THRESHOLD) trackingStatus = 'ACQUIRING';
  else trackingStatus = 'LOCKED';

  const acqTime = trackingStatus === 'ACQUIRING' || trackingStatus === 'LOST'
    ? state.acquisitionTimeS + dtS
    : 0;

  const gimbalRateDegS = Math.atan2(
    newCamY - state.cameraCenterY,
    newCamX - state.cameraCenterX
  ) * 180 / Math.PI / Math.max(dtS, 0.001);
  const cameraAngleDeg = Math.atan2(residualY, residualX) * 180 / Math.PI;

  return {
    ...state,
    beaconX,
    beaconY,
    cameraCenterX: newCamX,
    cameraCenterY: newCamY,
    pointingErrorUrad,
    detectionConfidence: newConfidence,
    trackingStatus,
    acquisitionTimeS: acqTime,
    _integralX: clamp(newIntegralX, -0.5, 0.5),
    _integralY: clamp(newIntegralY, -0.5, 0.5),
    _prevErrorX: errorX,
    _prevErrorY: errorY,
    cameraAngleDeg,
    gimbalRateDegS: Math.abs(gimbalRateDegS),
    beaconVelocityUradS,
    acquisitionMode: isMovingBeacon ? 'MOVING_BEACON' : 'STATIC_BEACON',
    correctionBoost: newCorrectionBoost,
  };
}

export function computeBeaconJitter(prevX: number, prevY: number, currX: number, currY: number): number {
  return Math.sqrt((currX - prevX) ** 2 + (currY - prevY) ** 2) * FOV_TO_URAD;
}
