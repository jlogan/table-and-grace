import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

interface PatternPanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Tile size in px. Larger = more airy. */
  size?: number;
  /** 0..1 opacity of the pattern layer. */
  opacity?: number;
}

/**
 * Cream panel with a subtle repeating gold floral-inspired tile.
 * Rendered with CSS gradients — no image assets.
 */
export function PatternPanel({
  children,
  size = 140,
  opacity = 0.9,
  className = "",
  style,
  ...rest
}: PatternPanelProps) {
  const tile = `${size}px ${size}px`;
  const bg: CSSProperties = {
    backgroundColor: "var(--cream)",
    backgroundImage: [
      "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--gold-soft) 14%, transparent) 0, transparent 55%)",
      "radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--gold) 16%, transparent) 2px, transparent 2px)",
      "radial-gradient(circle at 82% 28%, color-mix(in srgb, var(--gold) 12%, transparent) 1.5px, transparent 1.5px)",
      "radial-gradient(circle at 72% 78%, color-mix(in srgb, var(--gold-soft) 14%, transparent) 2.5px, transparent 2.5px)",
      "radial-gradient(circle at 28% 76%, color-mix(in srgb, var(--gold) 10%, transparent) 1.5px, transparent 1.5px)",
      "radial-gradient(circle at 50% 8%, color-mix(in srgb, var(--gold-soft) 10%, transparent) 3px, transparent 3px)",
    ].join(", "),
    backgroundSize: tile,
    backgroundRepeat: "repeat",
    opacity,
  };

  return (
    <div className={`relative isolate ${className}`} style={style} {...rest}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={bg}
      />
      {children}
    </div>
  );
}
