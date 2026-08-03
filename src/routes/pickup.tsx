import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import { StepIndicator } from "@/components/brand/StepIndicator";
import { BigButton } from "@/components/brand/BigButton";
import { pickupWindows } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { Clock, ChevronRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/pickup")({
  head: () => ({
    meta: [{ title: "Pickup Time — Table and Grace" }],
  }),
  component: Pickup,
});

function Pickup() {
  const { pickupWindowId, setPickupWindow, submitOrder, lines } = useOrder();
  const nav = useNavigate();

  const handleSubmit = () => {
    if (!pickupWindowId) return;
    submitOrder();
    nav({ to: "/confirmation" });
  };

  return (
    <GofofaLandingLayout showBack backTo="/review" backLabel="Back">
      <StepIndicator current="pickup" />
      <h1 className="text-3xl font-display font-semibold">Choose a pickup time</h1>
      <p className="mt-2 text-navy/80">
        Pick the window that works for you. We'll let you know when your order is ready for pickup.
      </p>

      <ul className="mt-6 space-y-3">
        {pickupWindows.map((w) => {
          const selected = pickupWindowId === w.id;
          return (
            <li key={w.id}>
              <button
                onClick={() => setPickupWindow(w.id)}
                className={[
                  "w-full text-left min-h-20 rounded-2xl border-2 p-4 flex items-center gap-4 transition-colors",
                  selected
                    ? "border-navy bg-navy text-primary-foreground"
                    : "border-border bg-card text-navy",
                ].join(" ")}
                aria-pressed={selected}
              >
                <div
                  className={[
                    "size-12 rounded-full flex items-center justify-center flex-shrink-0",
                    selected ? "bg-gold text-navy" : "bg-cream-deep text-navy",
                  ].join(" ")}
                >
                  {selected ? (
                    <CheckCircle2 className="size-6" aria-hidden />
                  ) : (
                    <Clock className="size-6" aria-hidden />
                  )}
                </div>
                <div>
                  <div className="text-lg font-display font-semibold">{w.day}</div>
                  <div className={selected ? "text-primary-foreground/85" : "text-navy/75"}>
                    {w.time}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-8">
        <BigButton onClick={handleSubmit} disabled={!pickupWindowId || lines.length === 0}>
          Submit my order <ChevronRight className="size-5" />
        </BigButton>
      </div>
    </GofofaLandingLayout>
  );
}
