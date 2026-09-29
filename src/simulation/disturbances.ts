/**
 * disturbances.ts
 * Computes the per-tick DisturbanceEffect for each disturbance type.
 * Each type produces a DISTINCT observable signature (different combinations
 * of jitter, attenuation, offset, confidence) so D3 can distinguish them.
 */

import { ActiveDisturbance, DisturbanceEffect, DisturbanceType } from '../types/disturbances';
import { clamp } from './physics';

export function createNullEffect(): DisturbanceEffect {
  return {
    additionalAttenuationDb: 0,
    beaconJitterAmplitude: 0,
    cameraCenterOffsetX: 0,
    cameraCenterOffsetY: 0,
    detectionConfidenceMult: 1,
    beaconCoordinateNoise: 0,
    losBlocked: false,
  };
}

/**
 * Compute the instantaneous disturbance effect for a given type, intensity, and phase.
 * Phase = simTimeS * frequency, gives sinusoidal variation over time.
 */
export function computeDisturbanceEffect(
  type: DisturbanceType,
  intensity: number, // 0–1
  phase: number,     // simTimeS * some_freq
  simTimeS: number
): DisturbanceEffect {
  const I = clamp(intensity, 0, 1);

  switch (type) {
    // ── TURBULENCE ─────────────────────────────────────────────────────────
    // Signature: beacon jitter ↑↑ (oscillating), attenuation moderate fluctuating,
    //            pointing error moderate, power fluctuating
    case 'TURBULENCE': {
      // Atmospheric turbulence creates bandwidth-limited beacon jitter
      // Use multi-frequency model (Kolmogorov spectrum approximation)
      const jitter =
        I * (0.08 * Math.sin(phase * 3.1) +
          0.05 * Math.sin(phase * 7.3 + 1.2) +
          0.03 * Math.sin(phase * 13.7 - 0.8));
      const atmFluc = I * (0.5 + 0.4 * Math.sin(phase * 2.3)) * 3.0; // dB, fluctuating
      return {
        additionalAttenuationDb: Math.max(0, atmFluc),
        beaconJitterAmplitude: Math.abs(jitter),
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: clamp(1 - I * 0.15, 0.7, 1),
        beaconCoordinateNoise: I * 0.03,
        losBlocked: false,
      };
    }

    // ── FOG ────────────────────────────────────────────────────────────────
    // Signature: received power ↓ steady, SNR ↓ steady, beacon stable, no jitter
    // Completely different from turbulence: monotonic attenuation, no jitter
    case 'FOG': {
      const fogAttenuation = I * 12.0; // up to 12 dB for dense fog
      return {
        additionalAttenuationDb: fogAttenuation,
        beaconJitterAmplitude: 0,       // key discriminator: no jitter
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: clamp(1 - I * 0.1, 0.8, 1),
        beaconCoordinateNoise: 0,       // coordinates clean
        losBlocked: I > 0.95,           // extreme fog
      };
    }

    // ── CAMERA_VIBRATION ───────────────────────────────────────────────────
    // Signature: camera centre oscillates periodically, beacon stable
    // Key discriminator: PERIODIC camera offset, not beacon jitter
    case 'CAMERA_VIBRATION': {
      const vibFreq = 4.0; // Hz (camera vibration frequency)
      const vibAmp = I * 0.12;
      const offsetX = vibAmp * Math.sin(simTimeS * 2 * Math.PI * vibFreq);
      const offsetY = vibAmp * 0.6 * Math.sin(simTimeS * 2 * Math.PI * vibFreq * 0.7 + 0.5);
      return {
        additionalAttenuationDb: 0,     // no atmospheric effect
        beaconJitterAmplitude: 0,       // beacon itself is stable
        cameraCenterOffsetX: offsetX,
        cameraCenterOffsetY: offsetY,
        detectionConfidenceMult: 1,     // detection confidence unchanged
        beaconCoordinateNoise: 0,
        losBlocked: false,
      };
    }

    // ── TERMINAL_JITTER ────────────────────────────────────────────────────
    // Signature: moderate pointing offset with some irregularity
    case 'TERMINAL_JITTER': {
      const j = I * 0.05;
      return {
        additionalAttenuationDb: 0,
        beaconJitterAmplitude: 0,
        cameraCenterOffsetX: j * (Math.sin(phase * 5.1) + 0.5 * Math.sin(phase * 9.3)),
        cameraCenterOffsetY: j * (Math.cos(phase * 4.7) + 0.5 * Math.cos(phase * 8.1)),
        detectionConfidenceMult: 1,
        beaconCoordinateNoise: I * 0.01,
        losBlocked: false,
      };
    }

    // ── POINTING_OFFSET ────────────────────────────────────────────────────
    // Signature: sudden large camera offset (step function), requires re-acquisition
    case 'POINTING_OFFSET': {
      // One-time large offset applied at disturbance start
      const magnitude = I * 0.45;
      return {
        additionalAttenuationDb: 0,
        beaconJitterAmplitude: 0,
        cameraCenterOffsetX: magnitude,
        cameraCenterOffsetY: magnitude * 0.6,
        detectionConfidenceMult: clamp(1 - I * 0.3, 0.5, 1),
        beaconCoordinateNoise: 0,
        losBlocked: false,
      };
    }

    // ── SENSOR_NOISE ───────────────────────────────────────────────────────
    // Signature: beacon coordinates noisy, detection confidence ↓
    //            but received power UNCHANGED (key discriminator vs fog/turbulence)
    case 'SENSOR_NOISE': {
      return {
        additionalAttenuationDb: 0,     // NO optical effect
        beaconJitterAmplitude: 0,       // NOT true jitter, just noisy coordinates
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: clamp(1 - I * 0.5, 0.3, 1),
        beaconCoordinateNoise: I * 0.15, // high coordinate noise
        losBlocked: false,
      };
    }

    // ── BEACON_INTENSITY_REDUCTION ─────────────────────────────────────────
    // Signature: power ↓, SNR ↓, coordinate noise mild, no jitter
    case 'BEACON_INTENSITY_REDUCTION': {
      return {
        additionalAttenuationDb: I * 8.0, // power reduction
        beaconJitterAmplitude: 0,
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: clamp(1 - I * 0.4, 0.4, 1),
        beaconCoordinateNoise: I * 0.04,
        losBlocked: false,
      };
    }

    // ── BEACON_LOSS ────────────────────────────────────────────────────────
    // Signature: detection confidence → 0, all metrics degrade severely
    case 'BEACON_LOSS':
    case 'BEACON_OCCLUSION': {
      return {
        additionalAttenuationDb: 25, // effectively kills the link
        beaconJitterAmplitude: 0.4,  // PAT thrashes without beacon
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: 0.02, // near-zero detection
        beaconCoordinateNoise: 0.5,
        losBlocked: false,
      };
    }

    // ── ATTITUDE_JITTER (satellite) ────────────────────────────────────────
    // Signature: periodic pointing error from satellite attitude oscillation
    //            Camera-side effect = periodic offset (different period from camera vib)
    case 'ATTITUDE_JITTER': {
      const attFreq = 0.5; // Hz (attitude control frequency)
      const amp = I * 0.14;
      const offsetX = amp * Math.sin(simTimeS * 2 * Math.PI * attFreq);
      const offsetY = amp * 0.8 * Math.sin(simTimeS * 2 * Math.PI * attFreq * 1.3 + 0.7);
      return {
        additionalAttenuationDb: 0,
        beaconJitterAmplitude: 0,
        cameraCenterOffsetX: offsetX,
        cameraCenterOffsetY: offsetY,
        detectionConfidenceMult: clamp(1 - I * 0.1, 0.85, 1),
        beaconCoordinateNoise: 0,
        losBlocked: false,
      };
    }

    // ── SPACECRAFT_VIBRATION ───────────────────────────────────────────────
    case 'SPACECRAFT_VIBRATION': {
      const vFreq = 2.0;
      const amp = I * 0.08;
      return {
        additionalAttenuationDb: 0,
        beaconJitterAmplitude: amp * Math.abs(Math.sin(simTimeS * 2 * Math.PI * vFreq)),
        cameraCenterOffsetX: amp * 0.5 * Math.sin(simTimeS * 2 * Math.PI * vFreq * 1.5),
        cameraCenterOffsetY: amp * 0.5 * Math.cos(simTimeS * 2 * Math.PI * vFreq * 1.1),
        detectionConfidenceMult: 1,
        beaconCoordinateNoise: I * 0.02,
        losBlocked: false,
      };
    }

    // ── SUDDEN_POINTING_OFFSET (satellite) ────────────────────────────────
    case 'SUDDEN_POINTING_OFFSET': {
      const magnitude = I * 0.5;
      return {
        additionalAttenuationDb: 0,
        beaconJitterAmplitude: 0,
        cameraCenterOffsetX: magnitude,
        cameraCenterOffsetY: -magnitude * 0.7,
        detectionConfidenceMult: clamp(1 - I * 0.4, 0.4, 1),
        beaconCoordinateNoise: 0,
        losBlocked: false,
      };
    }

    // ── DEBRIS_INTERFERENCE ────────────────────────────────────────────────
    // Signature: momentary power/SNR drop, NO jitter, NO pointing issue
    // (debris physically blocks or diffracts the beam path)
    case 'DEBRIS_INTERFERENCE': {
      return {
        additionalAttenuationDb: I * 18.0, // sudden optical blocking
        beaconJitterAmplitude: 0,           // beacon tracking not affected
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: clamp(1 - I * 0.3, 0.6, 1),
        beaconCoordinateNoise: 0,
        losBlocked: I > 0.8,
      };
    }

    // ── SCINTILLATION ──────────────────────────────────────────────────────
    case 'SCINTILLATION': {
      const scintAmplitude = I * 4.0;
      const scintAtten = scintAmplitude * (0.5 + 0.5 * Math.sin(phase * 5.7 + Math.sin(phase * 11.3)));
      return {
        additionalAttenuationDb: Math.max(0, scintAtten),
        beaconJitterAmplitude: I * 0.03,
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: clamp(1 - I * 0.1, 0.85, 1),
        beaconCoordinateNoise: I * 0.02,
        losBlocked: false,
      };
    }

    // ── CLOUD_OBSTRUCTION ─────────────────────────────────────────────────
    case 'CLOUD_OBSTRUCTION': {
      return {
        additionalAttenuationDb: I * 30.0, // severe blocking
        beaconJitterAmplitude: I * 0.05,
        cameraCenterOffsetX: 0,
        cameraCenterOffsetY: 0,
        detectionConfidenceMult: clamp(1 - I * 0.7, 0.1, 1),
        beaconCoordinateNoise: I * 0.1,
        losBlocked: I > 0.6,
      };
    }

    // ── MULTI_DISTURBANCE ─────────────────────────────────────────────────
    // (handled externally by combining two individual effects)
    case 'MULTI_DISTURBANCE':
      return createNullEffect();

    default:
      return createNullEffect();
  }
}

/**
 * Combine two disturbance effects (for multi-disturbance scenarios)
 */
export function combineEffects(a: DisturbanceEffect, b: DisturbanceEffect): DisturbanceEffect {
  return {
    additionalAttenuationDb: a.additionalAttenuationDb + b.additionalAttenuationDb,
    beaconJitterAmplitude: a.beaconJitterAmplitude + b.beaconJitterAmplitude,
    cameraCenterOffsetX: a.cameraCenterOffsetX + b.cameraCenterOffsetX,
    cameraCenterOffsetY: a.cameraCenterOffsetY + b.cameraCenterOffsetY,
    detectionConfidenceMult: a.detectionConfidenceMult * b.detectionConfidenceMult,
    beaconCoordinateNoise: a.beaconCoordinateNoise + b.beaconCoordinateNoise,
    losBlocked: a.losBlocked || b.losBlocked,
  };
}

/**
 * Create an ActiveDisturbance instance
 */
export function createActiveDisturbance(
  type: DisturbanceType,
  intensity: number,
  startTimeS: number,
  phase: number,
  simTimeS: number,
  targetHops: Array<[string, string]>
): ActiveDisturbance {
  return {
    id: `dist_${Date.now()}`,
    type,
    intensity,
    startTimeS,
    effect: computeDisturbanceEffect(type, intensity, phase, simTimeS),
    targetHops,
  };
}

/**
 * Dashboard 2's Ground↔Space and Space↔Space links are independent, live
 * simulations — a disturbance injected on one must never appear "active" (or
 * be clearable) from the other's controls. A disturbance belongs to
 * ground↔space if any of its target hops touches a ground-station id;
 * otherwise it's a pure satellite↔satellite hop and belongs to space↔space.
 */
export function disturbanceBelongsToD2Mode(
  dist: ActiveDisturbance,
  groundStationIds: ReadonlySet<string>,
  linkType: 'ground_sat' | 'sat_sat'
): boolean {
  const touchesGround = dist.targetHops.some(([a, b]) => groundStationIds.has(a) || groundStationIds.has(b));
  return linkType === 'ground_sat' ? touchesGround : !touchesGround;
}
