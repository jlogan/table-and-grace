import type { PlanCategory } from "@/lib/mock-data";

const accentBg: Record<PlanCategory["accent"], string> = {
  gold: "bg-gold text-navy",
  green: "bg-green text-white",
  orange: "bg-orange text-white",
  pink: "bg-pink text-navy",
  navy: "bg-navy text-primary-foreground",
};

const accentSoft: Record<PlanCategory["accent"], string> = {
  gold: "bg-[#f6efc4] text-navy",
  green: "bg-[#dff4d1] text-[#1f6f10]",
  orange: "bg-[#ffdccc] text-[#a83000]",
  pink: "bg-[#ffe4f6] text-navy",
  navy: "bg-cream-deep text-navy",
};

export function AccentDot({ accent }: { accent: PlanCategory["accent"] }) {
  return <span className={`inline-block size-3 rounded-full ${accentBg[accent]}`} aria-hidden />;
}

export function AccentPill({
  accent,
  children,
}: {
  accent: PlanCategory["accent"];
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${accentSoft[accent]}`}
    >
      {children}
    </span>
  );
}
