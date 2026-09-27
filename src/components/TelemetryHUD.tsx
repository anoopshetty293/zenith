import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ReadoutProps {
  label: string;
  value: string;
  dotClass?: string;
  style?: React.CSSProperties;
  delay: number;
}

function Readout({ label, value, dotClass, style, delay }: ReadoutProps) {
  return (
    <motion.div
      className="absolute rounded-md px-3 py-2 backdrop-blur-sm"
      style={{
        border: "1px solid var(--zen-line)",
        background: "rgba(10,14,24,0.55)",
        fontFamily: "var(--font-mono)",
        ...style,
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-medium tracking-[0.18em] text-[var(--zen-mute)]">
        {dotClass && <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />}
        {label}
      </div>
      <div className="mt-0.5 text-[12.5px] font-medium text-[var(--zen-ink)]">{value}</div>
    </motion.div>
  );
}

/**
 * Small aerospace-style telemetry readouts scattered around the
 * satellite scene. Demo values only — not live measurements. The SNR
 * figure drifts slightly on an interval to feel alive.
 */
export default function TelemetryHUD() {
  const [snr, setSnr] = useState(29.6);

  useEffect(() => {
    const id = setInterval(() => {
      setSnr((prev) => {
        const next = prev + (Math.random() - 0.5) * 0.6;
        return Math.round(Math.max(27, Math.min(32, next)) * 10) / 10;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Readout
        label="OPTICAL LINK"
        value="ACTIVE"
        dotClass="bg-[var(--zen-cyan)] zen-anim-pulse"
        style={{ top: "8%", right: "4%" }}
        delay={1.9}
      />
      <Readout
        label="WAVELENGTH"
        value="1064 nm"
        style={{ top: "20%", right: "0%" }}
        delay={2.05}
      />
      <Readout
        label="PAT STATUS"
        value="TRACKING"
        dotClass="bg-[var(--zen-violet)] zen-anim-pulse"
        style={{ top: "38%", left: "48%" }}
        delay={2.2}
      />
      <Readout
        label="SNR"
        value={`${snr.toFixed(1)} dB`}
        style={{ bottom: "30%", left: "2%" }}
        delay={2.35}
      />
      <Readout
        label="LINK"
        value="ESTABLISHED"
        dotClass="bg-[var(--zen-cyan)] zen-anim-pulse"
        style={{ bottom: "10%", left: "16%" }}
        delay={2.5}
      />
    </div>
  );
}
