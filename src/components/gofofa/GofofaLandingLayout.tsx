import { Link } from "@tanstack/react-router";
import { ChevronLeft, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { GofofaLink } from "@/components/gofofa/GofofaButton";
import { GofofaNavMenu } from "@/components/gofofa/GofofaNavMenu";
import { GofofaWordmark } from "@/components/gofofa/GofofaWordmark";
import { cn } from "@/lib/utils";

interface GofofaLandingLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  /** Wider max-width for landing page sections */
  wide?: boolean;
  className?: string;
}

export function GofofaLandingLayout({
  children,
  showBack,
  backTo = "/",
  backLabel = "Back",
  wide = false,
  className,
}: GofofaLandingLayoutProps) {
  return (
    <div className={cn("gofofa-app min-h-dvh flex flex-col bg-background", className)}>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          {showBack ? (
            <Link
              to={backTo}
              className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 font-semibold text-gofofa-black"
            >
              <ChevronLeft className="size-6" aria-hidden />
              <span className="text-base">{backLabel}</span>
            </Link>
          ) : (
            <GofofaWordmark to="/" size="sm" />
          )}

          <div className="flex items-center gap-2">
            <GofofaLink
              to="/signup"
              variant="primary"
              className="hidden min-h-11 w-auto px-4 text-sm sm:inline-flex"
            >
              Join GOFOFA
            </GofofaLink>
            <GofofaNavMenu />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className={cn("mx-auto px-4 py-6", wide ? "max-w-3xl" : "max-w-2xl")}>{children}</div>
      </main>

      <GofofaHelpFooter />
    </div>
  );
}

function GofofaHelpFooter() {
  return (
    <footer className="mt-8 border-t-2 border-border bg-secondary">
      <div className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center">
        <div>
          <GofofaWordmark to="/" size="sm" className="mb-2" />
          <p className="text-sm text-muted-foreground">
            Weekly meals from Table and Grace · Acworth · Canton · Woodstock
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <GofofaLink to="/signup" variant="primary" className="min-h-12 text-sm">
            Create your GOFOFA account
          </GofofaLink>
          <a
            href="tel:7702853600"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-gofofa-black px-5 font-semibold text-gofofa-black"
          >
            <Phone className="size-5" aria-hidden />
            Call (770) 285-3600
          </a>
        </div>
      </div>
    </footer>
  );
}
