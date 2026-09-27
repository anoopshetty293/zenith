import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import SatelliteScene from "./SatelliteScene";
import TelemetryHUD from "./TelemetryHUD";

const ease = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative mx-auto grid min-h-[92vh] max-w-[1400px] grid-cols-1 items-center gap-10 px-6 pt-28 pb-16 md:px-10 lg:grid-cols-[47%_53%] lg:gap-4 lg:pt-16">
      {/* LEFT: copy */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-xl"
      >
        <motion.div
          variants={item}
          className="mb-5 text-[11px] font-medium tracking-[0.24em] text-[var(--zen-cyan)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          FREE-SPACE OPTICAL COMMUNICATION
        </motion.div>

        <motion.h1
          variants={item}
          className="text-[15vw] font-semibold leading-[0.95] tracking-tight text-[var(--zen-ink)] sm:text-7xl lg:text-8xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ZENITH
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-4 text-xl font-medium text-[var(--zen-mute)] sm:text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Virtual FSOC Testbed
        </motion.p>

        <motion.p
          variants={item}
          className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--zen-mute)]"
        >
          Simulate optical links, precision pointing, acquisition and
          tracking, environmental disturbances, and real-time communication
          telemetry in one virtual test environment.
        </motion.p>

        <motion.div variants={item} className="mt-9 flex flex-col items-start gap-3">
          <button
            onClick={() => navigate("/mode-select")}
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
          <span className="text-[13px] text-[var(--zen-mute-2)]">
            Explore the virtual testbed
          </span>
        </motion.div>
      </motion.div>

      {/* RIGHT: satellite visualization */}
      <div className="relative -mx-6 h-[62vh] min-h-[420px] md:-mx-10 lg:mx-0 lg:h-[78vh]">
        <SatelliteScene />
        <TelemetryHUD />
      </div>
    </section>
  );
}
