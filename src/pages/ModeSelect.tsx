import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StarField from "../components/StarField";
import ZenithLogo from "../components/ZenithLogo";
import CommunicationModeCard, { type CommunicationMode } from "../components/CommunicationModeCard";

const ease = [0.16, 1, 0.3, 1] as const;

/* ---------------------------------------------------------------------- */
/* Small shared glyphs for the card illustrations below.                  */
/* ---------------------------------------------------------------------- */

function GroundGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d="M -13 8 L 0 -12 L 13 8 Z"
        fill="var(--zen-panel-2)"
        stroke="var(--zen-mute)"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        className="transition-[stroke-opacity] duration-400 group-hover:stroke-opacity-100"
      />
      <line x1="-17" y1="8" x2="17" y2="8" stroke="var(--zen-mute)" strokeOpacity="0.5" strokeWidth="1.4" />
      <circle cy="-4" r="2.2" fill="var(--zen-cyan)" className="transition-opacity duration-400" />
    </g>
  );
}

function SatelliteGlyph({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotate})`}>
      <rect x="-7" y="-9" width="14" height="18" rx="2" fill="var(--zen-panel-2)" stroke="var(--zen-mute)" strokeOpacity="0.7" strokeWidth="1.25" />
      <rect x="-24" y="-6" width="14" height="12" fill="none" stroke="var(--zen-mute)" strokeOpacity="0.55" strokeWidth="1.1" />
      <rect x="10" y="-6" width="14" height="12" fill="none" stroke="var(--zen-mute)" strokeOpacity="0.55" strokeWidth="1.1" />
      <line x1="-7" y1="0" x2="-10" y2="0" stroke="var(--zen-mute)" strokeOpacity="0.55" strokeWidth="1.1" />
      <line x1="7" y1="0" x2="10" y2="0" stroke="var(--zen-mute)" strokeOpacity="0.55" strokeWidth="1.1" />
      <circle cx="0" cy="9" r="1.8" fill="var(--zen-cyan)" />
    </g>
  );
}

function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill="var(--zen-mute)"
      fontSize="7"
      letterSpacing="0.5"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </text>
  );
}

function Beam({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--zen-cyan)"
        strokeOpacity="0.14"
        strokeWidth="7"
        className="transition-[stroke-opacity] duration-400 group-hover:stroke-opacity-30"
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--zen-cyan)"
        strokeWidth="1.3"
        strokeOpacity="0.55"
        strokeDasharray="4 4"
        className="zen-anim-beam transition-[stroke-opacity] duration-400 group-hover:stroke-opacity-100"
      />
      <circle r="1.6" fill="var(--zen-ink)">
        <animateMotion dur="2.4s" repeatCount="indefinite" path={`M ${x1} ${y1} L ${x2} ${y2}`} />
      </circle>
    </g>
  );
}

/* ---------------------------------------------------------------------- */
/* Per-mode illustrations                                                  */
/* ---------------------------------------------------------------------- */

function GroundGroundIllustration() {
  return (
    <svg viewBox="0 0 220 90" fill="none" aria-hidden="true">
      <Beam x1={38} y1={-4 + 20} x2={182} y2={-4 + 20} />
      <GroundGlyph x={30} y={24} />
      <GroundGlyph x={190} y={24} />
      <Caption x={30} y={48}>GROUND TERMINAL</Caption>
      <Caption x={190} y={48}>GROUND TERMINAL</Caption>
    </svg>
  );
}

function GroundSpaceIllustration() {
  return (
    <svg viewBox="0 0 220 110" fill="none" aria-hidden="true">
      <Beam x1={166} y1={22} x2={54} y2={64} />
      <SatelliteGlyph x={172} y={16} rotate={35} />
      <GroundGlyph x={44} y={66} />
      <Caption x={44} y={90}>GROUND STATION</Caption>
    </svg>
  );
}

function SpaceSpaceIllustration() {
  return (
    <svg viewBox="0 0 220 90" fill="none" aria-hidden="true">
      <Beam x1={44} y1={28} x2={176} y2={28} />
      <SatelliteGlyph x={30} y={28} rotate={-90} />
      <SatelliteGlyph x={190} y={28} rotate={90} />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Screen                                                                   */
/* ---------------------------------------------------------------------- */

/**
 * Communication-mode selection screen. The three cards are selectable
 * (clicking one records the chosen mode), and a single page-level
 * "GET STARTED" button below the cards carries that selection to the
 * existing main simulation route.
 */
export default function ModeSelect() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<CommunicationMode | null>(null);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <StarField />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="absolute left-6 top-6 z-20 md:left-10 md:top-8"
      >
        <Link
          to="/"
          aria-label="Back to ZENITH home"
          className="inline-block rounded-sm opacity-90 transition-[filter,opacity,transform] duration-300 hover:scale-[1.02] hover:opacity-100 hover:[filter:drop-shadow(0_0_6px_var(--zen-cyan-soft))_brightness(1.1)] focus-visible:opacity-100"
        >
          <ZenithLogo size={24} withWordmark />
        </Link>
      </motion.div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] flex-col items-center px-6 py-20 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="mb-2"
        >
          <ZenithLogo size={30} withWordmark={false} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease }}
          className="mt-4 text-4xl font-semibold tracking-tight text-[var(--zen-ink)] sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ZENITH
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease }}
          className="mt-3 text-[13px] font-medium tracking-[0.22em] text-[var(--zen-cyan)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          SELECT COMMUNICATION MODE
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.26 }}
          className="mt-3 max-w-sm text-center text-sm text-[var(--zen-mute)]"
        >
          Choose the communication geometry for your FSOC simulation.
        </motion.p>

        <div className="mt-14 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <CommunicationModeCard
            index={0}
            mode="ground-ground"
            title="GROUND → GROUND"
            subtitle="Terrestrial Optical Link"
            description="Simulate an optical communication link between two terrestrial terminals."
            illustration={<GroundGroundIllustration />}
            onSelect={setSelectedMode}
          />
          <CommunicationModeCard
            index={1}
            mode="ground-space"
            title="GROUND → SPACE"
            subtitle="Ground-to-Satellite Link"
            description="Simulate an optical communication link between a ground terminal and a satellite."
            illustration={<GroundSpaceIllustration />}
            onSelect={setSelectedMode}
          />
          <CommunicationModeCard
            index={2}
            mode="space-space"
            title="SPACE → SPACE"
            subtitle="Inter-Satellite Optical Link"
            description="Simulate an optical communication link between two satellites."
            illustration={<SpaceSpaceIllustration />}
            onSelect={setSelectedMode}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease }}
          className="mt-10 flex w-full justify-end"
        >
          <button
            onClick={() => navigate("/dashboard", { state: { mode: selectedMode } })}
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-md px-6 py-3.5 text-sm font-semibold tracking-wide text-[var(--zen-void)] transition-transform duration-300 hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: "var(--zen-cyan)" }}
          >
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-white/40 transition-transform duration-700 group-hover:translate-x-full"
              style={{ mixBlendMode: "overlay" }}
            />
            <span className="relative">GET STARTED</span>
            <span className="relative transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">
              →
            </span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
