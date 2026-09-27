/**
 * orbital.ts
 * Simplified circular orbital mechanics for D2 satellite simulation.
 * Uses two-body problem approximation with circular orbits.
 */

import { Satellite, GroundStation, Debris } from '../types/nodes';
import { orbitalAngularVelocityRadS } from './physics';

const R_EARTH_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MIN_ELEVATION_DEG = 5; // minimum elevation for LOS

// Canvas dimensions (virtual, in km from Earth center)
// Earth is drawn as a circle of radius EARTH_RADIUS_CANVAS in the 2D view
export const EARTH_RADIUS_CANVAS = 80; // px
export const ORBITAL_CANVAS_SIZE = 500; // px total
export const SCALE_KM_PER_PX = R_EARTH_KM / EARTH_RADIUS_CANVAS;

/** Physical debris-beam clearance below which the optical path is considered hard-blocked. */
export const DEBRIS_BLOCK_KM = 20;
/** Wider zone used only for gradual disturbance/telemetry effects (unchanged from before). */
export const DEBRIS_INTERFERENCE_KM = 80;

/**
 * Advance satellite position by dtS seconds
 */
export function tickSatellite(sat: Satellite, dtS: number, speed: number): Satellite {
  const omega = orbitalAngularVelocityRadS(sat.altitudeKm);
  const newAnomaly = sat.trueAnomalyRad + omega * dtS * speed;
  return {
    ...sat,
    trueAnomalyRad: newAnomaly % (2 * Math.PI),
  };
}

/**
 * Advance debris position
 */
export function tickDebris(debris: Debris, dtS: number, speed: number): Debris {
  const newAnomaly = debris.trueAnomalyRad + debris.angularVelocityRadS * dtS * speed;
  return {
    ...debris,
    trueAnomalyRad: newAnomaly % (2 * Math.PI),
  };
}

/**
 * Get 2D canvas position for a satellite
 * Canvas centre = Earth centre
 * Scale: EARTH_RADIUS_CANVAS pixels = R_EARTH_KM km
 */
export function satCanvasPos(sat: Satellite): { x: number; y: number } {
  const orbitRadiusPx =
    EARTH_RADIUS_CANVAS * ((R_EARTH_KM + sat.altitudeKm) / R_EARTH_KM);
  return {
    x: orbitRadiusPx * Math.cos(sat.trueAnomalyRad),
    y: orbitRadiusPx * Math.sin(sat.trueAnomalyRad),
  };
}

/**
 * Get 2D canvas position for debris
 */
export function debrisCanvasPos(debris: Debris): { x: number; y: number } {
  const orbitRadiusPx =
    EARTH_RADIUS_CANVAS * ((R_EARTH_KM + debris.altitudeKm) / R_EARTH_KM);
  return {
    x: orbitRadiusPx * Math.cos(debris.trueAnomalyRad),
    y: orbitRadiusPx * Math.sin(debris.trueAnomalyRad),
  };
}

/**
 * Get canvas position of ground station (on Earth surface)
 */
export function groundStationCanvasPos(gs: GroundStation): { x: number; y: number } {
  const angleDeg = gs.lonDeg; // simplification: use longitude as orbital angle
  const angleRad = angleDeg * DEG_TO_RAD;
  return {
    x: EARTH_RADIUS_CANVAS * Math.cos(angleRad),
    y: EARTH_RADIUS_CANVAS * Math.sin(angleRad),
  };
}

/**
 * Calculate distance between ground station and satellite (km)
 * Uses law of cosines with elevation calculation
 */
export function groundSatDistanceKm(gs: GroundStation, sat: Satellite): number {
  const gsAngle = gs.lonDeg * DEG_TO_RAD;
  const satAngle = sat.trueAnomalyRad;
  const angleDiff = satAngle - gsAngle;

  const R = R_EARTH_KM;
  const h = sat.altitudeKm;

  // Law of cosines: d² = R² + (R+h)² - 2R(R+h)cos(Δθ)
  const d2 = R * R + (R + h) * (R + h) - 2 * R * (R + h) * Math.cos(angleDiff);
  return Math.sqrt(Math.max(0, d2));
}

/**
 * Calculate elevation angle from ground station to satellite (degrees)
 */
export function elevationAngleDeg(gs: GroundStation, sat: Satellite): number {
  const gsAngle = gs.lonDeg * DEG_TO_RAD;
  const satAngle = sat.trueAnomalyRad;
  const angleDiff = satAngle - gsAngle;

  const R = R_EARTH_KM;
  const h = sat.altitudeKm;

  const d = groundSatDistanceKm(gs, sat);
  if (d <= 0) return 90;

  // sin(el) = ((R+h)*cos(angleDiff) - R) / d
  const sinEl = ((R + h) * Math.cos(angleDiff) - R) / d;
  return Math.asin(clampSin(sinEl)) * RAD_TO_DEG;
}

function clampSin(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Check if ground station has LOS to satellite
 */
export function hasGroundSatLOS(gs: GroundStation, sat: Satellite): boolean {
  return elevationAngleDeg(gs, sat) >= MIN_ELEVATION_DEG;
}

/**
 * Distance between two satellites (km)
 */
export function satSatDistanceKm(satA: Satellite, satB: Satellite): number {
  const posA = satCanvasPos(satA);
  const posB = satCanvasPos(satB);
  const scaleKmPerPx = R_EARTH_KM / EARTH_RADIUS_CANVAS;
  return Math.sqrt((posA.x - posB.x) ** 2 + (posA.y - posB.y) ** 2) * scaleKmPerPx;
}

/**
 * Predict time until LOS is lost (seconds)
 * Uses linear extrapolation of elevation angle
 */
export function predictLOSWindowS(
  gs: GroundStation,
  sat: Satellite,
  speed: number
): number {
  const omega = orbitalAngularVelocityRadS(sat.altitudeKm);
  const dElevDt = computeElevationRateDegS(gs, sat, omega, speed);

  const currentEl = elevationAngleDeg(gs, sat);

  if (!hasGroundSatLOS(gs, sat)) return 0;
  if (dElevDt >= 0) return 999; // elevation increasing, LOS not immediately at risk

  // Time until elevation reaches MIN_ELEVATION_DEG
  const timeS = (currentEl - MIN_ELEVATION_DEG) / Math.abs(dElevDt);
  return Math.max(0, timeS);
}

/**
 * Compute rate of change of elevation angle (deg/s)
 */
function computeElevationRateDegS(
  gs: GroundStation,
  sat: Satellite,
  omega: number,
  speed: number
): number {
  const dtS = 1.0;
  const satFuture: Satellite = {
    ...sat,
    trueAnomalyRad: sat.trueAnomalyRad + omega * dtS * speed,
  };
  const elNow = elevationAngleDeg(gs, sat);
  const elFuture = elevationAngleDeg(gs, satFuture);
  return (elFuture - elNow) / dtS;
}

/**
 * Relative velocity between ground station and satellite (km/s)
 */
export function groundSatRelativeVelocityKms(gs: GroundStation, sat: Satellite): number {
  const omega = orbitalAngularVelocityRadS(sat.altitudeKm);
  const r = R_EARTH_KM + sat.altitudeKm;
  const satVelocityKms = r * omega / 1000; // convert m/s to km/s... wait r is in km
  // r in km, omega in rad/s => velocity in km/s = r_km * omega
  const satVelocityKmsCorrect = (R_EARTH_KM + sat.altitudeKm) * omega; // km/s (small for LEO check)
  // Actually orbit radius in km * omega rad/s = km/s ✓
  return satVelocityKmsCorrect;
}

/**
 * Check if debris approaches the optical comm path.
 * Optical path = line segment from gsPos to satPos (in canvas coords).
 * Returns closest approach distance in km.
 */
export function debrisToPathDistanceKm(
  debris: Debris,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  scaleKmPerPx: number
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Infinity;

  const dPos = debrisCanvasPos(debris);
  const t = Math.max(0, Math.min(1, ((dPos.x - fromX) * dx + (dPos.y - fromY) * dy) / len2));
  const closestX = fromX + t * dx;
  const closestY = fromY + t * dy;
  const distPx = Math.sqrt((dPos.x - closestX) ** 2 + (dPos.y - closestY) ** 2);
  return distPx * scaleKmPerPx;
}

/**
 * Logical (non-visual) canvas position of any D2 node — ground station or
 * satellite — in the same Earth-centred coordinate frame used for distance
 * and debris-proximity math. Decoupled from how OrbitalCanvas actually draws.
 */
export function nodeLogicalPos(n: GroundStation | Satellite): { x: number; y: number } {
  return n.type === 'ground' ? groundStationCanvasPos(n) : satCanvasPos(n);
}

/**
 * Closest debris object to a given hop's line-of-sight segment, and its
 * clearance in km. Used to decide whether a specific hop (not just the
 * primary corridor) is physically obstructed by debris right now.
 */
export function closestDebrisToSegment(
  debrisList: Debris[],
  from: { x: number; y: number },
  to: { x: number; y: number }
): { debris: Debris | null; distanceKm: number } {
  let best: Debris | null = null;
  let bestDist = Infinity;
  for (const d of debrisList) {
    const dist = debrisToPathDistanceKm(d, from.x, from.y, to.x, to.y, SCALE_KM_PER_PX);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return { debris: best, distanceKm: bestDist };
}

/**
 * Predict when debris will reach minimum distance to path (ETA in seconds)
 */
export function predictDebrisEtaS(
  debris: Debris,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  scaleKmPerPx: number,
  speed: number
): number {
  const INTERFERENCE_THRESHOLD_KM = 50; // within 50 km = potential interference
  let minDist = Infinity;
  let etaS = Infinity;

  for (let t = 0; t <= 300; t += 1) {
    const futureDebris = {
      ...debris,
      trueAnomalyRad: debris.trueAnomalyRad + debris.angularVelocityRadS * t * speed,
    };
    const d = debrisToPathDistanceKm(futureDebris, fromX, fromY, toX, toY, scaleKmPerPx);
    if (d < minDist) {
      minDist = d;
      if (d < INTERFERENCE_THRESHOLD_KM) {
        etaS = t;
        break;
      }
    }
  }

  return etaS;
}
