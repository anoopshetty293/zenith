/**
 * physics.ts
 * Link budget and optical communication physics models.
 * All dB calculations follow standard RF/optical link budget conventions.
 */

const SPEED_OF_LIGHT = 3e8; // m/s
const K_BOLTZMANN = 1.38e-23; // J/K
const REFERENCE_TEMP_K = 290; // K
const BANDWIDTH_HZ = 1e9; // 1 GHz typical FSO bandwidth

/**
 * Free-space optical path loss (dB)
 * FSL = 20*log10(4*π*d/λ)
 */
export function freeSpaceLossDb(distanceKm: number, wavelengthNm: number): number {
  const d = distanceKm * 1000; // convert to meters
  const lambda = wavelengthNm * 1e-9; // convert to meters
  return 20 * Math.log10((4 * Math.PI * d) / lambda);
}

/**
 * Pointing loss due to misalignment (dB)
 * Lp = -10*log10(exp(-G_T * theta^2))
 * Simplified: Lp ≈ (theta/theta_3dB)^2 * 4.343 dB
 */
export function pointingLossDb(
  pointingErrorUrad: number,
  beamDivergenceUrad: number
): number {
  if (beamDivergenceUrad <= 0) return 0;
  const ratio = pointingErrorUrad / beamDivergenceUrad;
  return Math.min(ratio * ratio * 4.343, 30); // clamp at 30 dB
}

/**
 * Thermal noise floor (dBm)
 */
export function thermalNoiseFloorDbm(): number {
  const noisePowerW = K_BOLTZMANN * REFERENCE_TEMP_K * BANDWIDTH_HZ;
  return 10 * Math.log10(noisePowerW) + 30; // convert to dBm
}

/**
 * Received optical power (dBm)
 * Prx = Ptx + Gtx + Grx - FSL - Latm - Lpointing - Lmisc
 */
export function receivedPowerDbm(params: {
  txPowerDbm: number;
  txGainDb: number;
  rxGainDb: number;
  freeSpaceLossDb: number;
  atmosphericLossDb: number;
  pointingLossDb: number;
  miscLossDb: number;
}): number {
  return (
    params.txPowerDbm +
    params.txGainDb +
    params.rxGainDb -
    params.freeSpaceLossDb -
    params.atmosphericLossDb -
    params.pointingLossDb -
    params.miscLossDb
  );
}

/**
 * Aperture gain (dBi) for a circular aperture telescope
 * G = 10*log10(eta * (π*D/λ)^2)
 * where eta=0.6 efficiency, D=aperture diameter
 */
export function apertureGainDb(apertureDiamM: number, wavelengthNm: number): number {
  const lambda = wavelengthNm * 1e-9;
  const eta = 0.6;
  return 10 * Math.log10(eta * Math.pow((Math.PI * apertureDiamM) / lambda, 2));
}

/**
 * SNR (dB)
 */
export function snrDb(receivedPowerDbm: number, noiseFloorDbm: number): number {
  return receivedPowerDbm - noiseFloorDbm;
}

/**
 * BER for OOK modulation (common in FSO)
 * BER ≈ 0.5 * erfc(sqrt(SNR_linear / 4))
 * Returns log10(BER)
 */
export function berLog10(snrDb: number): number {
  const snrLinear = Math.pow(10, snrDb / 10);
  const ber = 0.5 * erfc(Math.sqrt(snrLinear / 4));
  if (ber <= 0) return -15; // numerical floor
  return Math.max(Math.log10(ber), -15);
}

/**
 * Link margin (dB)
 * How far above receiver sensitivity
 */
export function linkMarginDb(receivedPowerDbm: number, rxSensitivityDbm: number): number {
  return receivedPowerDbm - rxSensitivityDbm;
}

/**
 * Complementary error function approximation
 */
export function erfc(x: number): number {
  // Abramowitz & Stegun approximation
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 +
      t * (-0.284496736 +
        t * (1.421413741 +
          t * (-1.453152027 + t * 1.061405429))));
  return poly * Math.exp(-(x * x));
}

/**
 * Atmospheric attenuation model
 * Uses Beer-Lambert law: L = alpha * d
 * alpha depends on weather condition
 * Returns attenuation in dB/km
 */
export function atmosphericAttenuationDbPerKm(
  visibility: 'clear' | 'haze' | 'light_fog' | 'dense_fog',
  wavelengthNm: number
): number {
  // Kruse model: alpha = (3.912/V) * (lambda/550)^(-q)
  // V = visibility in km, q = particle size exponent
  const visibilityKm = { clear: 50, haze: 4, light_fog: 1, dense_fog: 0.2 }[visibility];
  const q = visibilityKm > 50 ? 1.6 : visibilityKm > 6 ? 1.3 : 0.585 * Math.pow(visibilityKm, 1 / 3);
  const alpha = (3.912 / visibilityKm) * Math.pow(wavelengthNm / 550, -q);
  return alpha * 4.343; // convert from natural to dB
}

/**
 * Full link budget calculation
 */
export function computeLinkBudget(params: {
  distanceKm: number;
  wavelengthNm: number;
  txPowerDbm: number;
  txApertureDiamM: number;
  rxApertureDiamM: number;
  rxSensitivityDbm: number;
  atmosphericLossDb: number;
  pointingErrorUrad: number;
  beamDivergenceUrad: number;
}) {
  const fsl = freeSpaceLossDb(params.distanceKm, params.wavelengthNm);
  const gtx = apertureGainDb(params.txApertureDiamM, params.wavelengthNm);
  const grx = apertureGainDb(params.rxApertureDiamM, params.wavelengthNm);
  const lpoint = pointingLossDb(params.pointingErrorUrad, params.beamDivergenceUrad);
  const miscLoss = 2.0; // connector, optics, implementation margin (dB)

  const prx = receivedPowerDbm({
    txPowerDbm: params.txPowerDbm,
    txGainDb: gtx,
    rxGainDb: grx,
    freeSpaceLossDb: fsl,
    atmosphericLossDb: params.atmosphericLossDb,
    pointingLossDb: lpoint,
    miscLossDb: miscLoss,
  });

  const noise = thermalNoiseFloorDbm();
  const snr = snrDb(prx, noise);
  const ber = berLog10(snr);
  const margin = linkMarginDb(prx, params.rxSensitivityDbm);

  return {
    freeSpaceLossDb: fsl,
    txGainDb: gtx,
    rxGainDb: grx,
    pointingLossDb: lpoint,
    receivedPowerDbm: prx,
    noiseFloorDbm: noise,
    snrDb: snr,
    berLog10: ber,
    linkMarginDb: margin,
  };
}

/**
 * Calculate distance between two 2D canvas positions
 * Assumes positions are in km
 */
export function distanceKm(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

/**
 * Angular velocity for a circular orbit
 * ω = sqrt(GM / r³)
 */
export function orbitalAngularVelocityRadS(altitudeKm: number): number {
  const GM = 3.986e14; // m³/s²
  const R_EARTH = 6371e3; // m
  const r = R_EARTH + altitudeKm * 1000;
  return Math.sqrt(GM / Math.pow(r, 3));
}

/**
 * Clamp value to range
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

