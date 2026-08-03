import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import patternAsset from "@/assets/table-and-grace-pattern.png.asset.json";

interface PatternPanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Tile size in px. Larger = more airy. */
  size?: number;
  /** 0..1 opacity of the pattern layer. */
  opacity?: number;
}

/**
 * Cream panel with the brand's floral tile from the brand kit
 * as a repeating background.
 */
export function PatternPanel({
  children,
  size = 180,
  opacity = 0.9,
  className = "",
  style,
  ...rest
}: PatternPanelProps) {
  const bg: CSSProperties = {
    backgroundColor: "var(--cream)",
    backgroundImage: `url("${patternAsset.url}")`,
    backgroundSize: `${size}px ${size}px`,
    backgroundRepeat: "repeat",
    opacity,
  };

  return (
    <div className={`relative isolate ${className}`} style={style} {...rest}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={bg} />
      {children}
    </div>
  );
}
