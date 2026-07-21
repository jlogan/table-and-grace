import { Link } from "@tanstack/react-router";
import { ChevronLeft, Phone, User } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface PageLayoutProps {
  children: ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  showAccount?: boolean;
}

export function PageLayout({
  children,
  showBack,
  backTo = "/",
  backLabel = "Back",
  showAccount = true,
}: PageLayoutProps) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between gap-3">
          {showBack ? (
            <Link
              to={backTo}
              className="inline-flex min-h-11 items-center gap-1 px-2 -ml-2 rounded-full text-navy font-semibold"
            >
              <ChevronLeft className="size-6" aria-hidden />
              <span className="text-base">{backLabel}</span>
            </Link>
          ) : (
            <Link to="/" aria-label="Table and Grace home" className="py-1">
              <Logo size="sm" />
            </Link>
          )}
          {showAccount && (
            <Link
              to="/account"
              aria-label="My account"
              className="inline-flex size-11 items-center justify-center rounded-full border-2 border-navy text-navy"
            >
              <User className="size-5" />
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
      </main>

      <HelpFooter />
    </div>
  );
}

export function HelpFooter() {
  return (
    <footer className="mt-8 border-t-2 border-cream-deep bg-secondary">
      <div className="mx-auto max-w-2xl px-4 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">Need help ordering?</p>
          <p className="text-sm text-muted-foreground">We're happy to take your order by phone.</p>
        </div>
        <a
          href="tel:7702853600"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-5 text-primary-foreground font-semibold w-full sm:w-auto justify-center"
        >
          <Phone className="size-5" aria-hidden />
          Call (770) 285-3600
        </a>
      </div>
      <div className="mx-auto max-w-2xl px-4 pb-5 text-xs text-muted-foreground italic font-display">
        good cookin' is love you can taste
      </div>
    </footer>
  );
}
