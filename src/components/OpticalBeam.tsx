interface OpticalBeamProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  id: string;
}

/**
 * The FSOC downlink itself: a soft-glow cyan beam between the
 * satellite's optical terminal and a ground terminal, with a few
 * particles travelling along it to suggest an active data stream, and
 * a small ground terminal marker with pulsing reception rings.
 */
export default function OpticalBeam({ x1, y1, x2, y2, id }: OpticalBeamProps) {
  const pathId = `zen-beam-path-${id}`;
  const glowId = `zen-beam-glow-${id}`;

  return (
    <g aria-hidden="true">
      <defs>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`zen-beam-grad-${id}`} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--zen-cyan)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--zen-cyan)" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <path
        id={pathId}
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        fill="none"
        stroke="transparent"
      />

      {/* soft outer glow */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--zen-cyan)"
        strokeOpacity="0.12"
        strokeWidth="7"
        filter={`url(#${glowId})`}
      />

      {/* core beam line, gently pulsing */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`url(#zen-beam-grad-${id})`}
        strokeWidth="1.4"
        className="zen-anim-pulse"
      />

      {/* travelling particles */}
      {[0, 1, 2].map((i) => (
        <circle key={i} r="1.8" fill="var(--zen-ink)">
          <animateMotion
            dur="3.2s"
            begin={`${i * -1.05}s`}
            repeatCount="indefinite"
            keyPoints="0;1"
            keyTimes="0;1"
            calcMode="linear"
            path={`M ${x1} ${y1} L ${x2} ${y2}`}
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.1;0.85;1"
            dur="3.2s"
            begin={`${i * -1.05}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* ground terminal */}
      <g transform={`translate(${x2}, ${y2})`}>
        <circle r="16" fill="none" stroke="var(--zen-cyan)" strokeOpacity="0.3" strokeWidth="1">
          <animate attributeName="r" values="6;20" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <path d="M -9 6 L 0 -7 L 9 6 Z" fill="var(--zen-panel-2)" stroke="var(--zen-line-strong)" strokeWidth="1" />
        <circle cy="-2" r="2" fill="var(--zen-cyan)" />
      </g>
    </g>
  );
}
