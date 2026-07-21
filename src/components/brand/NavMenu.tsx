import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, Phone, User, Utensils, MapPin, Info, HelpCircle, Mail, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const links: { to: string; label: string; icon: React.ReactNode }[] = [
  { to: "/plans", label: "Our Meals", icon: <Utensils className="size-5" /> },
  { to: "/help-me-choose", label: "Help Me Choose", icon: <Sparkles className="size-5" /> },
  { to: "/about", label: "About Chef Margaux", icon: <Info className="size-5" /> },
  { to: "/locations", label: "Pickup Locations", icon: <MapPin className="size-5" /> },
  { to: "/faq", label: "FAQ", icon: <HelpCircle className="size-5" /> },
  { to: "/contact", label: "Contact", icon: <Mail className="size-5" /> },
  { to: "/account", label: "My Account", icon: <User className="size-5" /> },
];

export function NavMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="inline-flex size-11 items-center justify-center rounded-full border-2 border-navy text-navy"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] max-w-sm bg-background p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-cream-deep">
          <SheetTitle className="font-display text-2xl text-navy text-left">Menu</SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.to}>
                <SheetClose asChild>
                  <Link
                    to={l.to as never}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 min-h-12 text-navy font-semibold hover:bg-cream-deep"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-gold-soft text-navy">
                      {l.icon}
                    </span>
                    <span className="text-base">{l.label}</span>
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-cream-deep p-4 space-y-3">
          <SheetClose asChild>
            <Link
              to="/plans"
              className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-5 text-primary-foreground font-semibold"
            >
              <ShoppingBag className="size-5" aria-hidden />
              Place an order
            </Link>
          </SheetClose>
          <a
            href="tel:7702853600"
            className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full border-2 border-navy px-5 text-navy font-semibold"
          >
            <Phone className="size-5" aria-hidden />
            (770) 285-3600
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
