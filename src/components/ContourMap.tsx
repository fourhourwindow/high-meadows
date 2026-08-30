interface ContourMapProps {
  /** "hero" shows the full illustrated map with house/cottage markers. "divider" is a thin repeating line motif for section breaks. */
  variant?: "hero" | "divider";
  className?: string;
}

/**
 * The site's signature visual: abstracted topographic contour lines standing
 * in for the 13-acre property, with the main house and cottage marked on
 * the hero version. Reused (thinner, cropped) as a section divider
 * elsewhere, so the land itself — not a stock photo — is the visual thread
 * running through the site.
 */
export function ContourMap({ variant = "hero", className }: ContourMapProps) {
  if (variant === "divider") {
    return (
      <svg
        className={className}
        viewBox="0 0 1200 48"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,24 C150,4 300,44 450,24 C600,4 750,44 900,24 C1050,4 1150,34 1200,20"
          fill="none"
          stroke="var(--color-oak)"
          strokeWidth="1"
          opacity="0.35"
        />
        <path
          d="M0,32 C160,14 320,40 480,30 C640,20 800,40 960,28 C1080,20 1150,30 1200,26"
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="1"
          opacity="0.4"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 800 600"
      role="img"
      aria-label="Illustrated contour map of the 13-acre property, marking the main house and cottage"
    >
      {/* Concentric-ish contour rings suggesting rolling Virginia hills */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={contourPath(i)}
          fill="none"
          stroke={i % 2 === 0 ? "var(--color-vine)" : "var(--color-oak)"}
          strokeWidth="1.25"
          opacity={0.25 + i * 0.06}
        />
      ))}

      {/* Main house marker */}
      <g transform="translate(430,270)">
        <rect x="-14" y="-10" width="28" height="20" fill="var(--color-wine)" />
        <path d="M-16,-10 L0,-22 L16,-10 Z" fill="var(--color-wine)" />
        <text
          x="0"
          y="36"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="13"
          fill="var(--color-ink)"
        >
          Main House
        </text>
      </g>

      {/* Cottage marker */}
      <g transform="translate(560,360)">
        <rect x="-9" y="-7" width="18" height="14" fill="var(--color-gold)" />
        <path d="M-10,-7 L0,-15 L10,-7 Z" fill="var(--color-gold)" />
        <text
          x="0"
          y="28"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="13"
          fill="var(--color-ink)"
        >
          Cottage
        </text>
      </g>
    </svg>
  );
}

/** Generates a wandering hill-contour path, offset per ring index. */
function contourPath(i: number): string {
  const yBase = 120 + i * 55;
  const amp = 40 - i * 3;
  return `M20,${yBase} C150,${yBase - amp} 300,${yBase + amp} 450,${yBase - amp * 0.6} C600,${
    yBase - amp * 1.4
  } 700,${yBase + amp * 0.5} 780,${yBase - amp * 0.3}`;
}
