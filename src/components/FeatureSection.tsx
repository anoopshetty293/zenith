import { motion } from "framer-motion";

interface Card {
  tag: string;
  title: string;
  description: string;
  points: string[];
}

const CARDS: Card[] = [
  {
    tag: "01",
    title: "Ground FSOC",
    description: "Ground-to-ground optical communication simulation.",
    points: ["Link establishment", "Wavelength compatibility", "PAT", "Beacon acquisition", "Tracking"],
  },
  {
    tag: "02",
    title: "Space Environment",
    description: "Satellite and space-environment simulation, coming next.",
    points: ["Satellite scenarios", "Environmental effects", "Orbital context", "Space-object scenarios"],
  },
  {
    tag: "03",
    title: "Live Telemetry",
    description: "Real-time observability into every active link.",
    points: ["Pointing error", "SNR", "Received power", "BER", "Link status", "Tracking status"],
  },
  {
    tag: "04",
    title: "Analytics",
    description: "Telemetry analysis and anomaly investigation.",
    points: ["Event detection", "Trend analysis", "Disturbance analysis", "System performance"],
  },
];

export default function FeatureSection() {
  return (
    <section id="scenarios" className="relative mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14 max-w-2xl"
      >
        <h2
          className="text-3xl font-semibold leading-tight text-[var(--zen-ink)] sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          One virtual testbed, multiple mission scenarios
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--zen-mute)]">
          Each scenario isolates a different part of the optical link
          lifecycle, from first acquisition to long-term performance
          analysis.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg sm:grid-cols-2" style={{ background: "var(--zen-line)" }}>
        {CARDS.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="group relative p-7 transition-colors duration-300 hover:bg-[var(--zen-panel-2)] sm:p-9"
            style={{ background: "var(--zen-panel)" }}
          >
            <div
              className="mb-8 text-[11px] font-medium tracking-[0.2em] text-[var(--zen-mute-2)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {c.tag}
            </div>
            <h3
              className="text-xl font-semibold text-[var(--zen-ink)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {c.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--zen-mute)]">{c.description}</p>
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
              {c.points.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-1.5 text-[12.5px] text-[var(--zen-mute)]"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--zen-cyan)] opacity-60" />
                  {p}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
