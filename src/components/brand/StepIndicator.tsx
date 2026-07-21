import { Check } from "lucide-react";

const steps = [
  { key: "meals", label: "Choose Meals" },
  { key: "review", label: "Review Order" },
  { key: "pickup", label: "Pickup Time" },
  { key: "done", label: "Done" },
] as const;

export type StepKey = (typeof steps)[number]["key"];

export function StepIndicator({ current }: { current: StepKey }) {
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-1 mb-6" aria-label="Order progress">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.key} className="flex-1 flex items-center gap-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={[
                  "size-8 rounded-full flex items-center justify-center text-sm font-bold border-2",
                  done
                    ? "bg-navy text-primary-foreground border-navy"
                    : active
                      ? "bg-gold text-navy border-gold"
                      : "bg-background text-muted-foreground border-border",
                ].join(" ")}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </div>
              <span
                className={[
                  "mt-1 text-[0.7rem] font-semibold text-center truncate w-full leading-tight",
                  active ? "text-navy" : "text-muted-foreground",
                ].join(" ")}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  "h-0.5 flex-1 -mt-5 rounded",
                  i < currentIdx ? "bg-navy" : "bg-border",
                ].join(" ")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
