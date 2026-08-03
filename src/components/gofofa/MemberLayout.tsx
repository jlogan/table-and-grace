import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { GofofaWordmark } from "@/components/gofofa/GofofaWordmark";
import { cn } from "@/lib/utils";

interface MemberLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  /** Hide wordmark link target on auth pages. */
  wordmarkTo?: string | null | undefined;
  className?: string;
}

export function MemberLayout({
  children,
  showBack,
  backTo = "/",
  backLabel = "Back",
  wordmarkTo = "/account",
  className,
}: MemberLayoutProps) {
  return (
    <div className={cn("member-app min-h-dvh bg-background flex flex-col", className)}>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-4">
          {showBack ? (
            <Link
              to={backTo}
              className="inline-flex min-h-11 min-w-11 items-center gap-1 rounded-md px-2 -ml-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-5" aria-hidden />
              <span>{backLabel}</span>
            </Link>
          ) : (
            <GofofaWordmark to={wordmarkTo === undefined ? "/account" : wordmarkTo} />
          )}
          {!showBack ? null : (
            <GofofaWordmark
              to={wordmarkTo === undefined ? "/account" : wordmarkTo}
              className="text-right [&_p:first-child]:text-lg"
            />
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-lg px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
