interface ZenithLogoProps {
  /** Pixel height of the mark. Width scales proportionally. */
  size?: number;
  /** Show the "ZENITH" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Show the small "FSOC VIRTUAL TESTBED" subtitle under the wordmark. */
  withSubtitle?: boolean;
  className?: string;
}

/**
 * ZENITH mark: a geometric "Z" built as a folded optical beam path,
 * with a terminal node at each vertex and a thin orbital arc over the
 * top-right corner. Pure SVG so it stays sharp at any resolution.
 */
export default function ZenithLogo({
  size = 28,
  withWordmark = true,
  withSubtitle = false,
  className = "",
}: ZenithLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* orbital arc, upper right */}
        <path
          d="M24 6C29.6 6.9 34 11.8 34 17.7"
          stroke="var(--zen-violet)"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.75"
        />
        <circle cx="34" cy="17.7" r="1.1" fill="var(--zen-violet)" />

        {/* folded beam path forming the Z */}
        <path
          d="M9 11H29L11 29H31"
          stroke="var(--zen-cyan)"
          strokeWidth="2.25"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* terminal nodes at each vertex of the beam path */}
        <circle cx="9" cy="11" r="1.8" fill="var(--zen-ink)" />
        <circle cx="29" cy="11" r="1.8" fill="var(--zen-cyan)" />
        <circle cx="11" cy="29" r="1.8" fill="var(--zen-cyan)" />
        <circle cx="31" cy="29" r="1.8" fill="var(--zen-ink)" />
      </svg>

      {withWordmark && (
        <div className="leading-none">
          <div
            className="font-semibold tracking-[0.04em] text-[var(--zen-ink)]"
            style={{ fontFamily: "var(--font-display)", fontSize: size * 0.62 }}
          >
            ZENITH
          </div>
          {withSubtitle && (
            <div
              className="mt-1 text-[10px] font-medium tracking-[0.22em] text-[var(--zen-mute)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              FSOC VIRTUAL TESTBED
            </div>
          )}
        </div>
      )}
    </div>
  );
}
