import type { ReactNode } from "react";
import { motion } from "framer-motion";

export type CommunicationMode = "ground-ground" | "ground-space" | "space-space";

interface CommunicationModeCardProps {
  title: string;
  subtitle: string;
  description: string;
  mode: CommunicationMode;
  /** Small SVG/illustration rendered in the card's illustration area. */
  illustration: ReactNode;
  /** Optional selection handler — left unwired for now (visual-only stage). */
  onSelect?: (mode: CommunicationMode) => void;
  /** Reveal order for the page-load stagger. */
  index?: number;
}

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * A single communication-geometry option on the mode-selection screen.
 * Purely presentational: hover state lifts the card and brightens its
 * border and illustration. Selection is exposed via `onSelect`, wired
 * up by the parent screen; navigation lives at the page level, not here.
 */
export default function CommunicationModeCard({
  title,
  subtitle,
  description,
  mode,
  illustration,
  onSelect,
  index = 0,
}: CommunicationModeCardProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(mode)}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease }}
      whileHover={{ y: -6 }}
      whileTap={{ y: -2 }}
      className="group relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-xl p-6 text-left backdrop-blur-sm transition-[border-color,box-shadow] duration-400 focus-visible:outline-none sm:p-7"
      style={{
        background:
          "linear-gradient(180deg, rgba(17,23,42,0.55) 0%, rgba(13,18,32,0.55) 100%)",
        border: "1px solid var(--zen-line)",
      }}
    >
      {/* border glow + ambient wash on hover */}
      <span
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          boxShadow: "0 0 0 1px var(--zen-cyan-soft), 0 24px 48px -24px rgba(92,216,240,0.35)",
          background:
            "radial-gradient(ellipse 90% 60% at 50% 0%, rgba(92,216,240,0.08), transparent 70%)",
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-xl transition-[border-color] duration-400 group-hover:border-[var(--zen-cyan)]"
        style={{ border: "1px solid transparent" }}
      />

      {/* fine grid, very subtle */}
      <span
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(160,184,224,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(160,184,224,0.05) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 85%)",
        }}
      />

      {/* header */}
      <div className="relative z-10">
        <h3
          className="text-lg font-semibold tracking-tight text-[var(--zen-ink)] sm:text-xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h3>
        <p
          className="mt-1 text-[11px] font-medium tracking-[0.14em] text-[var(--zen-mute)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {subtitle.toUpperCase()}
        </p>
      </div>

      {/* illustration area */}
      <div className="relative z-10 my-5 flex flex-1 items-center justify-center [&_svg]:w-full [&_svg]:max-w-[220px]">
        {illustration}
      </div>

      {/* description */}
      <p className="relative z-10 text-[13px] leading-relaxed text-[var(--zen-mute)]">
        {description}
      </p>
    </motion.button>
  );
}
