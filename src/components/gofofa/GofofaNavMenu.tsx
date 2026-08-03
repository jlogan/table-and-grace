import { Link } from "@tanstack/react-router";
import { HelpCircle, Info, LogIn, Mail, Menu, Phone, UserPlus } from "lucide-react";
import { useState } from "react";

import { GofofaLink } from "@/components/gofofa/GofofaButton";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links: { to: string; label: string; icon: React.ReactNode }[] = [
  { to: "/about", label: "About Chef Margaux", icon: <Info className="size-5" /> },
  { to: "/faq", label: "FAQ", icon: <HelpCircle className="size-5" /> },
  { to: "/contact", label: "Contact", icon: <Mail className="size-5" /> },
  { to: "/login", label: "Log in", icon: <LogIn className="size-5" /> },
];

export function GofofaNavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="inline-flex size-11 items-center justify-center rounded-full border-2 border-gofofa-black text-gofofa-black"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[88vw] max-w-sm flex-col bg-background p-0">
        <SheetHeader className="border-b border-border px-5 pb-3 pt-5">
          <SheetTitle className="text-left font-[family-name:var(--font-gofofa-display)] text-2xl uppercase tracking-wide text-gofofa-black">
            Menu
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.to}>
                <SheetClose asChild>
                  <Link
                    to={l.to as never}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 font-semibold text-gofofa-black hover:bg-secondary"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-gofofa-green text-white">
                      {l.icon}
                    </span>
                    <span className="text-base">{l.label}</span>
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3 border-t border-border p-4">
          <SheetClose asChild>
            <GofofaLink to="/signup" variant="primary" className="w-full">
              <UserPlus className="size-5" aria-hidden />
              Start your meal plan
            </GofofaLink>
          </SheetClose>
          <a
            href="tel:7702853600"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-gofofa-black px-5 font-semibold text-gofofa-black"
          >
            <Phone className="size-5" aria-hidden />
            (770) 285-3600
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
