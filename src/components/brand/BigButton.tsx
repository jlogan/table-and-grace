import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

type Variant = "primary" | "secondary" | "ghost" | "gold";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-primary-foreground hover:bg-navy-soft",
  secondary: "bg-cream-deep text-navy hover:brightness-95 border-2 border-navy",
  ghost: "bg-transparent text-navy border-2 border-navy hover:bg-cream-deep",
  gold: "bg-gold text-navy hover:brightness-95",
};

const base =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export const BigButton = forwardRef<HTMLButtonElement, BigButtonProps>(
  ({ variant = "primary", className = "", children, ...rest }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  ),
);
BigButton.displayName = "BigButton";

interface BigLinkProps {
  to: string;
  params?: Record<string, string>;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function BigLink({
  to,
  params,
  variant = "primary",
  children,
  className = "",
}: BigLinkProps) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
