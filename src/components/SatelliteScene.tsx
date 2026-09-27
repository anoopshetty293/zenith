import { motion } from "framer-motion";
import OpticalBeam from "./OpticalBeam";
import TrackingRing from "./TrackingRing";

const SAT = { x: 430, y: 195 }; // satellite bus centre
const TERMINAL = { x: SAT.x - 6, y: SAT.y + 78 }; // optical gimbal, beam origin
const GROUND = { x: 128, y: 540 }; // ground terminal

/**
 * The hero's right-hand visualization: a satellite with an active
 * FSOC downlink to a ground terminal, a PAT tracking reticle on its
 * optical gimbal, and the curve of the Earth's limb below. Built as
 * one SVG so every piece shares a coordinate space.
 */
export default function SatelliteScene() {
  return (
    <motion.svg
      viewBox="0 0 640 640"
      className="h-full w-full"
      role="img"
      aria-label="Animated illustration of a satellite maintaining a free-space optical communication link with a ground terminal"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <defs>
        <radialGradient id="zen-earth-glow" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#1a3a52" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#0d2436" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0d2436" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="zen-panel-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16233a" />
          <stop offset="100%" stopColor="#0b1424" />
        </linearGradient>
      </defs>

      {/* Earth limb, bottom of frame */}
      <g opacity="0.85">
        <ellipse cx="120" cy="760" rx="520" ry="220" fill="url(#zen-earth-glow)" />
        <path
          d="M -40 620 Q 260 500 700 620"
          fill="none"
          stroke="var(--zen-cyan)"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />
      </g>

      {/* beam + ground terminal (drawn first, beneath satellite) */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.5 }}
      >
        <OpticalBeam id="downlink" x1={TERMINAL.x} y1={TERMINAL.y} x2={GROUND.x} y2={GROUND.y} />
      </motion.g>

      {/* satellite group: gentle continuous float */}
      <g className="zen-anim-float" style={{ transformOrigin: `${SAT.x}px ${SAT.y}px` }}>
        {/* solar panels */}
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${SAT.x + side * 66}, ${SAT.y - 8})`}>
            <rect
              x={side === -1 ? -108 : -2}
              y="-38"
              width="106"
              height="76"
              rx="2"
              fill="url(#zen-panel-grad)"
              stroke="var(--zen-line-strong)"
              strokeWidth="1"
            />
            {/* panel cell grid */}
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={`v${i}`}
                x1={(side === -1 ? -108 : -2) + (i * 106) / 5}
                y1="-38"
                x2={(side === -1 ? -108 : -2) + (i * 106) / 5}
                y2="38"
                stroke="var(--zen-line)"
                strokeWidth="0.75"
              />
            ))}
            <line
              x1={side === -1 ? -108 : -2}
              y1="0"
              x2={side === -1 ? -2 : 104}
              y2="0"
              stroke="var(--zen-line)"
              strokeWidth="0.75"
            />
            {/* strut to bus */}
            <line
              x1={side === -1 ? -2 : -2}
              y1="0"
              x2={side === -1 ? -22 : 18}
              y2="0"
              stroke="var(--zen-line-strong)"
              strokeWidth="2"
              transform={side === -1 ? "translate(0,0)" : undefined}
            />
          </g>
        ))}

        {/* connecting struts (bus to panels) */}
        <line x1={SAT.x - 30} y1={SAT.y - 8} x2={SAT.x - 20} y2={SAT.y - 8} stroke="var(--zen-line-strong)" strokeWidth="2" />
        <line x1={SAT.x + 30} y1={SAT.y - 8} x2={SAT.x + 40} y2={SAT.y - 8} stroke="var(--zen-line-strong)" strokeWidth="2" />

        {/* satellite bus body */}
        <rect
          x={SAT.x - 30}
          y={SAT.y - 46}
          width="60"
          height="88"
          rx="5"
          fill="url(#zen-panel-grad)"
          stroke="var(--zen-line-strong)"
          strokeWidth="1.25"
        />
        {/* body detailing */}
        <line x1={SAT.x - 30} y1={SAT.y - 14} x2={SAT.x + 30} y2={SAT.y - 14} stroke="var(--zen-line)" strokeWidth="0.75" />
        <line x1={SAT.x - 30} y1={SAT.y + 14} x2={SAT.x + 30} y2={SAT.y + 14} stroke="var(--zen-line)" strokeWidth="0.75" />
        <rect x={SAT.x - 20} y={SAT.y - 40} width="14" height="10" rx="1.5" fill="none" stroke="var(--zen-cyan)" strokeOpacity="0.4" strokeWidth="0.75" />

        {/* running lights */}
        <circle cx={SAT.x - 30} cy={SAT.y - 40} r="1.6" fill="var(--zen-violet)" className="zen-anim-pulse" />
        <circle cx={SAT.x + 30} cy={SAT.y - 40} r="1.6" fill="var(--zen-cyan)" className="zen-anim-pulse" />

        {/* antenna, top of bus */}
        <line x1={SAT.x} y1={SAT.y - 46} x2={SAT.x} y2={SAT.y - 78} stroke="var(--zen-line-strong)" strokeWidth="1.5" />
        <circle cx={SAT.x} cy={SAT.y - 80} r="2.4" fill="none" stroke="var(--zen-ink)" strokeOpacity="0.5" strokeWidth="1" />

        {/* optical gimbal / terminal, bottom of bus, and its tracking reticle */}
        <line x1={SAT.x - 6} y1={SAT.y + 42} x2={TERMINAL.x} y2={TERMINAL.y - 20} stroke="var(--zen-line-strong)" strokeWidth="2" />
        <circle cx={TERMINAL.x} cy={TERMINAL.y} r="10" fill="var(--zen-panel-2)" stroke="var(--zen-cyan)" strokeOpacity="0.55" strokeWidth="1.25" />
        <circle cx={TERMINAL.x} cy={TERMINAL.y} r="3.2" fill="var(--zen-cyan)" />

        <TrackingRing cx={TERMINAL.x} cy={TERMINAL.y} r={44} />
      </g>
    </motion.svg>
  );
}
