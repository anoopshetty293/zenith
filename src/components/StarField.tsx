import { useMemo } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  delay: number;
  duration: number;
  opacity: number;
}

function makeStars(count: number, seed: number): Star[] {
  // small deterministic PRNG so the field doesn't reshuffle on re-render
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: 0.5 + rand() * 1.1,
    delay: rand() * 6,
    duration: 3 + rand() * 4,
    opacity: 0.25 + rand() * 0.5,
  }));
}

/**
 * Full-bleed background: deep radial gradients, a very faint technical
 * grid, and a sparse field of twinkling stars. Purely decorative and
 * pointer-events-none so it never interferes with content above it.
 */
export default function StarField() {
  const stars = useMemo(() => makeStars(110, 42), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 78% 22%, rgba(92,216,240,0.10), transparent 60%)," +
            "radial-gradient(ellipse 55% 45% at 15% 85%, rgba(167,139,250,0.07), transparent 60%)," +
            "linear-gradient(180deg, var(--zen-void) 0%, #070a12 55%, var(--zen-void) 100%)",
        }}
      />

      {/* fine technical grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(160,184,224,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(160,184,224,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 70% at 60% 30%, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 60% 30%, black 40%, transparent 85%)",
        }}
      />

      {/* stars */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            opacity: s.opacity,
            animation: `zen-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes zen-twinkle {
          0%, 100% { opacity: var(--tw-op, 0.3); transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
