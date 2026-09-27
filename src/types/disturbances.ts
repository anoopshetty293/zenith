// ─── Disturbance Categories ──────────────────────────────────────────────────
export type DisturbanceCategory = 'atmospheric' | 'mechanical' | 'optical' | 'space' | 'debris';

// ─── Disturbance Types ────────────────────────────────────────────────────────
export type DisturbanceType =
  // Atmospheric
  | 'TURBULENCE'
  | 'FOG'
  | 'CLOUD_OBSTRUCTION'
  | 'SCINTILLATION'
  // Mechanical
  | 'CAMERA_VIBRATION'
  | 'TERMINAL_JITTER'
  | 'POINTING_OFFSET'
  // Optical/Sensor
  | 'SENSOR_NOISE'
  | 'BEACON_INTENSITY_REDUCTION'
  | 'BEACON_LOSS'
  | 'BEACON_OCCLUSION'
  // Space
  | 'ATTITUDE_JITTER'
  | 'SPACECRAFT_VIBRATION'
  | 'SUDDEN_POINTING_OFFSET'
  // Debris
  | 'DEBRIS_INTERFERENCE'
  // Multi
  | 'MULTI_DISTURBANCE';

// ─── Disturbance Definition ───────────────────────────────────────────────────
export interface DisturbanceDefinition {
  type: DisturbanceType;
  label: string;
  category: DisturbanceCategory;
  description: string;
  appliesToD1: boolean;
  appliesToD2: boolean;
  hasIntensityControl: boolean;
  // Which physical effects this disturbance drives (for signature matching)
  signature: DisturbanceSignature;
}

// ─── Disturbance Signature (what D3 must infer FROM) ─────────────────────────
export interface DisturbanceSignature {
  // Expected effect magnitudes (0=none, 1=moderate, 2=strong, 3=dominant)
  beaconJitterEffect: number;
  atmosphericAttenuationEffect: number;
  pointingOffsetEffect: number;
  pointingJitterEffect: number;   // oscillating vs steady
  detectionDegradation: number;
  powerFluctuationEffect: number;
  coordinateNoiseEffect: number;
  isPeriodicPointing: boolean;    // camera vibration creates periodic offset
  isSuddenOnset: boolean;         // vs gradual
  affectsAtmosphere: boolean;
  affectsPointing: boolean;
  affectsOptical: boolean;
}

// ─── Active Disturbance Instance ─────────────────────────────────────────────
export interface ActiveDisturbance {
  id: string;
  type: DisturbanceType;
  intensity: number;   // 0–1
  startTimeS: number;
  // Computed effect applied each tick
  effect: DisturbanceEffect;
  /**
   * Hop(s) — node id pairs — this disturbance actually targets, captured at
   * injection time from whatever route was carrying traffic then (usually
   * the configured source↔destination corridor, but a relay hop if you'd
   * already rerouted). Frozen at injection so rerouting away from a hop
   * resolves that specific disturbance instead of it silently following you.
   */
  targetHops: Array<[string, string]>;
}

// ─── Disturbance Effect (applied per tick) ───────────────────────────────────
export interface DisturbanceEffect {
  // Additional attenuation (dB)
  additionalAttenuationDb: number;
  // Jitter added to beacon position (normalized FOV units)
  beaconJitterAmplitude: number;
  // Offset to camera centre (normalized FOV units)
  cameraCenterOffsetX: number;
  cameraCenterOffsetY: number;
  // Multiplier on detection confidence (0–1 range)
  detectionConfidenceMult: number;
  // Additional noise on beacon coordinates
  beaconCoordinateNoise: number;
  // Whether LOS is blocked
  losBlocked: boolean;
}

// ─── Multi-disturbance ────────────────────────────────────────────────────────
export interface MultiDisturbance {
  primary: ActiveDisturbance;
  secondary: ActiveDisturbance;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────
export const DISTURBANCE_CATALOG: DisturbanceDefinition[] = [
  {
    type: 'TURBULENCE',
    label: 'Atmospheric Turbulence',
    category: 'atmospheric',
    description: 'Thermal gradients cause beacon position jitter and received power fluctuations.',
    appliesToD1: true,
    appliesToD2: true,
    hasIntensityControl: true,
    signature: {
      beaconJitterEffect: 2,
      atmosphericAttenuationEffect: 1,
      pointingOffsetEffect: 1,
      pointingJitterEffect: 2,
      detectionDegradation: 0,
      powerFluctuationEffect: 2,
      coordinateNoiseEffect: 1,
      isPeriodicPointing: false,
      isSuddenOnset: false,
      affectsAtmosphere: true,
      affectsPointing: true,
      affectsOptical: false,
    },
  },
  {
    type: 'FOG',
    label: 'Fog / Mist Attenuation',
    category: 'atmospheric',
    description: 'Dense fog increases atmospheric attenuation, reducing received power and SNR steadily.',
    appliesToD1: true,
    appliesToD2: true,
    hasIntensityControl: true,
    signature: {
      beaconJitterEffect: 0,
      atmosphericAttenuationEffect: 3,
      pointingOffsetEffect: 0,
      pointingJitterEffect: 0,
      detectionDegradation: 0,
      powerFluctuationEffect: 0,
      coordinateNoiseEffect: 0,
      isPeriodicPointing: false,
      isSuddenOnset: false,
      affectsAtmosphere: true,
      affectsPointing: false,
      affectsOptical: false,
    },
  },
  {
    type: 'CAMERA_VIBRATION',
    label: 'Camera / Terminal Vibration',
    category: 'mechanical',
    description: 'Mechanical vibration oscillates the optical axis with a characteristic periodic pattern.',
    appliesToD1: true,
    appliesToD2: false,
    hasIntensityControl: true,
    signature: {
      beaconJitterEffect: 0,
      atmosphericAttenuationEffect: 0,
      pointingOffsetEffect: 2,
      pointingJitterEffect: 1,
      detectionDegradation: 0,
      powerFluctuationEffect: 1,
      coordinateNoiseEffect: 0,
      isPeriodicPointing: true,
      isSuddenOnset: false,
      affectsAtmosphere: false,
      affectsPointing: true,
      affectsOptical: false,
    },
  },
  {
    type: 'POINTING_OFFSET',
    label: 'Sudden Pointing Offset',
    category: 'mechanical',
    description: 'Sudden terminal displacement causes abrupt pointing error requiring re-acquisition.',
    appliesToD1: true,
    appliesToD2: false,
    hasIntensityControl: true,
    signature: {
      beaconJitterEffect: 0,
      atmosphericAttenuationEffect: 0,
      pointingOffsetEffect: 3,
      pointingJitterEffect: 0,
      detectionDegradation: 1,
      powerFluctuationEffect: 2,
      coordinateNoiseEffect: 0,
      isPeriodicPointing: false,
      isSuddenOnset: true,
      affectsAtmosphere: false,
      affectsPointing: true,
      affectsOptical: false,
    },
  },
  {
    type: 'SENSOR_NOISE',
    label: 'Sensor Noise',
    category: 'optical',
    description: 'Detector noise corrupts beacon coordinates without affecting optical power.',
    appliesToD1: true,
    appliesToD2: true,
    hasIntensityControl: true,
    signature: {
      beaconJitterEffect: 1,
      atmosphericAttenuationEffect: 0,
      pointingOffsetEffect: 0,
      pointingJitterEffect: 1,
      detectionDegradation: 2,
      powerFluctuationEffect: 0,
      coordinateNoiseEffect: 3,
      isPeriodicPointing: false,
      isSuddenOnset: false,
      affectsAtmosphere: false,
      affectsPointing: false,
      affectsOptical: true,
    },
  },
  {
    type: 'BEACON_LOSS',
    label: 'Beacon Loss / Occlusion',
    category: 'optical',
    description: 'Beacon becomes undetectable. Detection confidence drops to near zero, tracking is lost.',
    appliesToD1: true,
    appliesToD2: true,
    hasIntensityControl: false,
    signature: {
      beaconJitterEffect: 3,
      atmosphericAttenuationEffect: 0,
      pointingOffsetEffect: 3,
      pointingJitterEffect: 2,
      detectionDegradation: 3,
      powerFluctuationEffect: 3,
      coordinateNoiseEffect: 3,
      isPeriodicPointing: false,
      isSuddenOnset: true,
      affectsAtmosphere: false,
      affectsPointing: true,
      affectsOptical: true,
    },
  },
  {
    type: 'ATTITUDE_JITTER',
    label: 'Spacecraft Attitude Jitter',
    category: 'space',
    description: 'Satellite attitude control disturbance causes oscillating pointing error.',
    appliesToD1: false,
    appliesToD2: true,
    hasIntensityControl: true,
    signature: {
      beaconJitterEffect: 0,
      atmosphericAttenuationEffect: 0,
      pointingOffsetEffect: 3,
      pointingJitterEffect: 2,
      detectionDegradation: 0,
      powerFluctuationEffect: 2,
      coordinateNoiseEffect: 0,
      isPeriodicPointing: true,
      isSuddenOnset: false,
      affectsAtmosphere: false,
      affectsPointing: true,
      affectsOptical: false,
    },
  },
  {
    type: 'DEBRIS_INTERFERENCE',
    label: 'Debris Path Interference',
    category: 'debris',
    description: 'Space debris crosses the optical communication path, causing sudden power/SNR drops.',
    appliesToD1: false,
    appliesToD2: true,
    hasIntensityControl: false,
    signature: {
      beaconJitterEffect: 0,
      atmosphericAttenuationEffect: 0,
      pointingOffsetEffect: 0,
      pointingJitterEffect: 0,
      detectionDegradation: 1,
      powerFluctuationEffect: 3,
      coordinateNoiseEffect: 0,
      isPeriodicPointing: false,
      isSuddenOnset: true,
      affectsAtmosphere: false,
      affectsPointing: false,
      affectsOptical: true,
    },
  },
  {
    type: 'BEACON_INTENSITY_REDUCTION',
    label: 'Beacon Intensity Reduction',
    category: 'optical',
    description: 'Beacon transmit power is reduced, degrading detection confidence and SNR.',
    appliesToD1: true,
    appliesToD2: true,
    hasIntensityControl: true,
    signature: {
      beaconJitterEffect: 0,
      atmosphericAttenuationEffect: 0,
      pointingOffsetEffect: 0,
      pointingJitterEffect: 0,
      detectionDegradation: 2,
      powerFluctuationEffect: 2,
      coordinateNoiseEffect: 1,
      isPeriodicPointing: false,
      isSuddenOnset: false,
      affectsAtmosphere: false,
      affectsPointing: false,
      affectsOptical: true,
    },
  },
];
