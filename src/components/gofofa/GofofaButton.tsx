import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-gofofa-green text-white hover:bg-[#3d4d2a]",
  secondary: "bg-gofofa-red text-white hover:bg-[#8e0e17]",
  outline: "bg-transparent text-gofofa-black border-2 border-gofofa-black hover:bg-gofofa-cream",
  ghost: "bg-transparent text-gofofa-black border-2 border-gofofa-gray hover:bg-secondary",
};

const base =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed";

interface GofofaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export const GofofaButton = forwardRef<HTMLButtonElement, GofofaButtonProps>(
  ({ variant = "primary", className, children, ...rest }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  ),
);
GofofaButton.displayName = "GofofaButton";

interface GofofaLinkProps {
  to: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function GofofaLink({ to, variant = "primary", children, className }: GofofaLinkProps) {
  return (
    <Link to={to as never} className={cn(base, variants[variant], className)}>
      {children}
    </Link>
  );
}

interface GofofaAnchorProps {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function GofofaAnchor({ href, variant = "ghost", children, className }: GofofaAnchorProps) {
  return (
    <a href={href} className={cn(base, variants[variant], className)}>
      {children}
    </a>
  );
}
