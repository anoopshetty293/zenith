/**
 * glossary.ts
 * Plain-English definitions for every abbreviation/technical term shown
 * anywhere in the ZENITH UI. Used by both the inline <Term> tooltip and
 * the full <GlossaryPanel/>, so there is exactly one place to update a
 * definition.
 *
 * Keep each definition to 1–2 short sentences a non-specialist can read
 * in a few seconds — this is for "anyone looking at the screen", not a
 * textbook entry.
 */

export interface GlossaryEntry {
  term: string;
  short: string;
  plain: string;
  category: 'Signal & Link Quality' | 'Pointing & Tracking' | 'Orbital & Geometry' | 'Intelligence Layer' | 'General';
}

export const GLOSSARY: GlossaryEntry[] = [
  // ---- Signal & Link Quality ----
  {
    term: 'FSOC',
    short: 'Free Space Optical Communication',
    plain: 'Sending data as a laser beam through air or space instead of over radio waves or fibre cable.',
    category: 'General',
  },
  {
    term: 'SNR',
    short: 'Signal-to-Noise Ratio',
    plain: 'How much stronger the useful signal is compared to background noise, in decibels. Higher is better — think of it like a voice being easy to hear over background chatter.',
    category: 'Signal & Link Quality',
  },
  {
    term: 'BER',
    short: 'Bit Error Rate',
    plain: 'The fraction of received data bits that come out wrong. 1×10⁻⁹ means about one mistake per billion bits — a very reliable link.',
    category: 'Signal & Link Quality',
  },
  {
    term: 'dBm',
    short: 'Decibel-milliwatts',
    plain: 'A way of measuring signal power on a compressed scale, since real signal strengths span huge ranges. Higher (less negative) means a stronger signal.',
    category: 'Signal & Link Quality',
  },
  {
    term: 'dB',
    short: 'Decibel',
    plain: 'A ratio expressed on a logarithmic scale, used because signal gains and losses multiply — decibels let you just add and subtract them instead.',
    category: 'Signal & Link Quality',
  },
  {
    term: 'Link Margin',
    short: 'Link Margin',
    plain: 'How much spare signal strength is left above the minimum needed to work. A margin near zero means the link is one small disturbance away from failing.',
    category: 'Signal & Link Quality',
  },
  {
    term: 'Free-Space Loss',
    short: 'Free-Space Path Loss',
    plain: 'The natural weakening of a beam simply because it spreads out over distance — the same reason a flashlight looks dimmer the further away you shine it.',
    category: 'Signal & Link Quality',
  },
  {
    term: 'Atmospheric Attenuation',
    short: 'Atmospheric Loss',
    plain: 'Signal loss caused by fog, haze, rain or cloud scattering and absorbing the laser light on its way through the air.',
    category: 'Signal & Link Quality',
  },
  {
    term: 'Scintillation',
    short: 'Scintillation',
    plain: 'Rapid flickering of the received signal caused by pockets of warm and cool air bending the beam slightly as it travels — similar to how a road looks shimmery on a hot day.',
    category: 'Signal & Link Quality',
  },

  // ---- Pointing & Tracking ----
  {
    term: 'PAT',
    short: 'Pointing, Acquisition & Tracking',
    plain: "The control system that keeps the laser beam aimed precisely at the receiver, the way you'd keep a spotlight fixed on a moving performer.",
    category: 'Pointing & Tracking',
  },
  {
    term: 'Pointing Error',
    short: 'Pointing Error',
    plain: 'How far off-target the beam currently is, measured in microradians (µrad) — an extremely small angle, since the beam is so narrow that even a tiny miss matters.',
    category: 'Pointing & Tracking',
  },
  {
    term: 'µrad',
    short: 'Microradian',
    plain: 'A unit for very small angles. For comparison, 1 µrad is roughly the angle a coin subtends from a kilometre away.',
    category: 'Pointing & Tracking',
  },
  {
    term: 'Beacon',
    short: 'Beacon',
    plain: 'A wider, easy-to-see guide light sent by the far-end terminal, used as an aiming target — much like a lighthouse beam helps a ship find its way.',
    category: 'Pointing & Tracking',
  },
  {
    term: 'Beam Jitter',
    short: 'Beam / Beacon Jitter',
    plain: 'Small, fast wobbles in the beam or beacon position, usually caused by air turbulence or platform vibration.',
    category: 'Pointing & Tracking',
  },
  {
    term: 'PID Controller',
    short: 'PID Controller',
    plain: 'A standard feedback control method that corrects a system based on the current error, the accumulated past error, and how fast the error is changing — used here to keep the beam locked on target.',
    category: 'Pointing & Tracking',
  },
  {
    term: 'Tracking Lock',
    short: 'Lock / Locked',
    plain: 'The beam is accurately following its target. Losing lock means the aim has drifted too far off to maintain the link.',
    category: 'Pointing & Tracking',
  },

  // ---- Orbital & Geometry ----
  {
    term: 'LEO',
    short: 'Low Earth Orbit',
    plain: 'An orbit a few hundred kilometres above Earth — low enough that satellites move quickly across the sky and pass overhead in minutes.',
    category: 'Orbital & Geometry',
  },
  {
    term: 'Elevation Angle',
    short: 'Elevation Angle',
    plain: "How high a satellite appears above the horizon from a ground station's point of view. Too low, and the horizon or thick atmosphere blocks the view.",
    category: 'Orbital & Geometry',
  },
  {
    term: 'LOS',
    short: 'Line of Sight',
    plain: 'Whether the two ends of the link can physically "see" each other with nothing solid in the way.',
    category: 'Orbital & Geometry',
  },
  {
    term: 'Debris',
    short: 'Space Debris',
    plain: "Leftover junk in orbit — old satellite parts, fragments — that can pass through and block a beam's path.",
    category: 'Orbital & Geometry',
  },

  // ---- Intelligence Layer ----
  {
    term: 'Anomaly Detection',
    short: 'Anomaly Detection',
    plain: 'Noticing that something has drifted away from normal, healthy behaviour — the first step before figuring out why.',
    category: 'Intelligence Layer',
  },
  {
    term: 'Diagnosis',
    short: 'Diagnosis',
    plain: "The system's best guess at what is causing a problem, worked out purely from the symptoms it can observe — never told the answer in advance.",
    category: 'Intelligence Layer',
  },
  {
    term: 'Confidence Score',
    short: 'Confidence Score',
    plain: 'How strongly the evidence points to one cause versus the alternatives. It reflects how well the evidence fits a known pattern, not a scientific probability.',
    category: 'Intelligence Layer',
  },
  {
    term: 'Ground Truth',
    short: 'Ground Truth',
    plain: 'What actually happened — the real cause, kept hidden from the diagnosis engine until after it makes its guess, purely to check if it was right.',
    category: 'Intelligence Layer',
  },
  {
    term: 'Mitigation',
    short: 'Mitigation',
    plain: 'A recommended corrective action, such as switching to a backup route, made before the problem gets bad enough to break the link.',
    category: 'Intelligence Layer',
  },
  {
    term: 'Route Score',
    short: 'Route Score',
    plain: 'A single combined rating of how good a possible path is, based on signal strength, spare margin, distance, and how stable the aim is.',
    category: 'Intelligence Layer',
  },
  {
    term: 'Telemetry',
    short: 'Telemetry',
    plain: "Live measurements streamed from the system — the numbers and graphs that show the link's current health.",
    category: 'Intelligence Layer',
  },
];

export function findGlossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY.find(g => g.term.toLowerCase() === term.toLowerCase());
}
