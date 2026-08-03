import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

interface GofofaWordmarkProps {
  className?: string;
  /** When set, the wordmark links to this route. Omit or null for static text. */
  to?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: {
    brand: "text-lg tracking-[0.15em]",
    tagline: "text-xs",
    sub: "text-[0.65rem]",
  },
  md: {
    brand: "text-2xl tracking-[0.2em]",
    tagline: "text-sm",
    sub: "text-xs",
  },
  lg: {
    brand: "text-4xl sm:text-5xl tracking-[0.22em]",
    tagline: "text-base sm:text-lg",
    sub: "text-sm",
  },
} as const;

export function GofofaWordmark({ className, to = "/", size = "md" }: GofofaWordmarkProps) {
  const styles = sizeStyles[size];

  const content = (
    <div className={cn("text-left", className)}>
      <p
        className={cn(
          "font-[family-name:var(--font-gofofa-display)] font-normal uppercase text-foreground",
          styles.brand,
        )}
      >
        GO<span className="text-gofofa-red">·</span>FO
        <span className="text-gofofa-red">·</span>FA
      </p>
      <p className={cn("mt-0.5 font-medium text-muted-foreground", styles.tagline)}>
        Weekly meals from Table and Grace
      </p>
      {size === "lg" ? (
        <p
          className={cn(
            "mt-2 font-semibold uppercase tracking-[0.12em] text-gofofa-green",
            styles.sub,
          )}
        >
          Good food. Made right. Made for you.
        </p>
      ) : null}
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    );
  }

  return content;
}
