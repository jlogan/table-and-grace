import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

interface GofofaWordmarkProps {
  className?: string;
  /** When set, the wordmark links to this route. Omit or null for static text. */
  to?: string | null;
}

export function GofofaWordmark({ className, to = "/account" }: GofofaWordmarkProps) {
  const content = (
    <div className={cn("text-left", className)}>
      <p className="text-xl font-semibold tracking-tight text-foreground">GOFOFA</p>
      <p className="text-sm text-muted-foreground">Weekly meals from Table and Grace</p>
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
