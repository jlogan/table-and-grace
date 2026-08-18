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
  /** Wider max-width for landing page sections (desktop-friendly). */
  wide?: boolean;
  className?: string;
}

const contentMaxWidth = {
  default: "max-w-2xl",
  wide: "max-w-6xl",
} as const;

export function GofofaLandingLayout({
  children,
  showBack,
  backTo = "/",
  backLabel = "Back",
  wide = false,
  className,
}: GofofaLandingLayoutProps) {
  const maxW = wide ? contentMaxWidth.wide : contentMaxWidth.default;

  return (
    <div className={cn("gofofa-app min-h-dvh flex flex-col bg-background", className)}>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div
          className={cn("mx-auto flex items-center justify-between gap-3 px-4 py-3 lg:px-8", maxW)}
        >
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
              className="hidden min-h-11 w-auto px-5 text-sm sm:inline-flex"
            >
              Start your meal plan
            </GofofaLink>
            <GofofaNavMenu />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <GofofaHelpFooter wide={wide} />
    </div>
  );
}

/** Centers landing content at a readable max width. Use inside `<main>` for standard sections. */
export function GofofaLandingSection({
  children,
  wide = false,
  className,
  bleed = false,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
  /** Break out to full viewport width while keeping inner padding. */
  bleed?: boolean;
}) {
  const maxW = wide ? contentMaxWidth.wide : contentMaxWidth.default;

  if (bleed) {
    return (
      <div className={cn("w-full", className)}>
        <div className={cn("mx-auto px-4 py-6 lg:px-8", maxW)}>{children}</div>
      </div>
    );
  }

  return <div className={cn("mx-auto px-4 py-6 lg:px-8", maxW, className)}>{children}</div>;
}

function GofofaHelpFooter({ wide }: { wide?: boolean }) {
  const maxW = wide ? contentMaxWidth.wide : contentMaxWidth.default;

  return (
    <footer className="mt-4 border-t-2 border-border bg-secondary">
      <div
        className={cn(
          "mx-auto flex flex-col items-start justify-between gap-6 px-4 py-8 lg:px-8 sm:flex-row sm:items-center",
          maxW,
        )}
      >
        <div>
          <GofofaWordmark to="/" size="sm" className="mb-2" />
          <p className="text-sm text-muted-foreground">
            Weekly meals from Table and Grace · Acworth · Canton · Woodstock
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[16rem]">
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
