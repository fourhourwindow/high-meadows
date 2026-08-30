interface LogoMarkProps {
  /** "primary" for light backgrounds (header), "reversed" for dark
   * backgrounds (footer), "seal" for the emblem alone (small spaces). */
  variant?: "primary" | "reversed" | "seal";
  className?: string;
}

/**
 * The site's logo: three nested contour-line arcs (echoing the hero and
 * section-divider motif in ContourMap) with a small gold point marking the
 * house, paired with a wordmark lockup. Colors come from the same CSS
 * custom properties as the rest of the site (see styles/global.css), so
 * the mark stays in sync if the palette ever changes.
 */
export function LogoMark({ variant = "primary", className }: LogoMarkProps) {
  if (variant === "seal") {
    return (
      <svg
        className={className}
        viewBox="0 0 64 64"
        role="img"
        aria-label="High Meadows"
      >
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="var(--color-vine-dark)"
          strokeWidth="1.5"
        />
        <path
          d="M14,40 Q32,28 50,40"
          fill="none"
          stroke="var(--color-oak)"
          strokeWidth="1.5"
          opacity="0.5"
        />
        <path
          d="M17,34 Q32,22 47,34"
          fill="none"
          stroke="var(--color-vine)"
          strokeWidth="1.5"
          opacity="0.75"
        />
        <path
          d="M21,28 Q32,18 43,28"
          fill="none"
          stroke="var(--color-vine-dark)"
          strokeWidth="1.5"
        />
        <circle cx="32" cy="18" r="2.2" fill="var(--color-gold)" />
      </svg>
    );
  }

  const wordmarkColor =
    variant === "reversed" ? "var(--color-stone)" : "var(--color-vine-dark)";
  const arc1Color = variant === "reversed" ? "var(--color-gold)" : "var(--color-oak)";
  const arc2Color = variant === "reversed" ? "var(--color-stone)" : "var(--color-vine)";
  const arc3Color = variant === "reversed" ? "var(--color-stone)" : "var(--color-vine-dark)";
  const arc2Opacity = variant === "reversed" ? 0.6 : 0.75;
  const arc3Opacity = variant === "reversed" ? 0.95 : 1;

  return (
    <svg
      className={className}
      viewBox="0 0 260 60"
      role="img"
      aria-label="High Meadows — Scottsville, Virginia"
    >
      <path
        d="M6,38 Q28,26 50,38"
        fill="none"
        stroke={arc1Color}
        strokeWidth="1.5"
        opacity="0.5"
      />
      <path
        d="M9,33 Q28,20 47,33"
        fill="none"
        stroke={arc2Color}
        strokeWidth="1.5"
        opacity={arc2Opacity}
      />
      <path
        d="M13,28 Q28,16 43,28"
        fill="none"
        stroke={arc3Color}
        strokeWidth="1.5"
        opacity={arc3Opacity}
      />
      <circle cx="28" cy="16" r="2" fill="var(--color-gold)" />

      <text
        x="60"
        y="30"
        fontFamily="var(--font-display)"
        fontWeight="600"
        fontSize="20"
        letterSpacing="0.5"
        fill={wordmarkColor}
      >
        High Meadows
      </text>
      <text
        x="60"
        y="45"
        fontFamily="var(--font-mono)"
        fontSize="8"
        letterSpacing="1"
        fill="var(--color-gold)"
      >
        SCOTTSVILLE, VIRGINIA
      </text>
    </svg>
  );
}
