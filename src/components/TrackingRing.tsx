interface TrackingRingProps {
  cx: number;
  cy: number;
  /** outer radius of the reticle */
  r?: number;
}

/**
 * Optical pointing/acquisition/tracking reticle centred on the
 * satellite's optical terminal: a slowly rotating dashed ring, a
 * fixed crosshair, and four corner acquisition brackets. Suggests
 * SEARCH -> ACQUIRE -> TRACK without reading as a weapon sight.
 */
export default function TrackingRing({ cx, cy, r = 46 }: TrackingRingProps) {
  const b = r + 16; // bracket radius
  const bl = 10; // bracket arm length

  return (
    <g aria-hidden="true">
      {/* outer dashed rotating ring */}
      <g className="zen-anim-rotate-slow" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--zen-cyan)"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
      </g>

      {/* inner fine ring, counter-rotating */}
      <g className="zen-anim-rotate-slow-rev" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.62}
          fill="none"
          stroke="var(--zen-violet)"
          strokeOpacity="0.4"
          strokeWidth="1"
          strokeDasharray="1 5"
        />
      </g>

      {/* crosshair */}
      <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="var(--zen-cyan)" strokeOpacity="0.6" strokeWidth="1" />
      <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="var(--zen-cyan)" strokeOpacity="0.6" strokeWidth="1" />

      {/* four acquisition corner brackets */}
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sy], i) => {
        const x = cx + sx * b;
        const y = cy + sy * b;
        return (
          <path
            key={i}
            d={`M ${x - sx * bl} ${y} L ${x} ${y} L ${x} ${y - sy * bl}`}
            fill="none"
            stroke="var(--zen-ink)"
            strokeOpacity="0.35"
            strokeWidth="1.25"
          />
        );
      })}
    </g>
  );
}
