import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import { StepIndicator } from "@/components/brand/StepIndicator";
import { BigLink } from "@/components/brand/BigButton";
import {
  categoryPrice,
  getCategory,
  getIngredient,
  pickupWindows,
  type OrderStatus,
} from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { CheckCircle2, Circle, Bell } from "lucide-react";

export const Route = createFileRoute("/confirmation")({
  head: () => ({
    meta: [{ title: "Order Confirmed — Table and Grace" }],
  }),
  component: Confirmation,
});

const statusOrder: { key: OrderStatus; label: string; description: string }[] = [
  { key: "received", label: "Order received", description: "We got your order." },
  { key: "preparing", label: "Preparing", description: "Chef Margaux is cooking." },
  { key: "ready", label: "Ready for pickup", description: "Come on by!" },
  { key: "picked-up", label: "Picked up", description: "Enjoy every bite." },
];

function Confirmation() {
  const { currentOrderId, currentOrderStatus, lines, extras, pickupWindowId, subtotal } =
    useOrder();

  const pickup = pickupWindows.find((p) => p.id === pickupWindowId);
  const idx = useMemo(
    () => statusOrder.findIndex((s) => s.key === currentOrderStatus),
    [currentOrderStatus],
  );

  useEffect(() => {
    if (currentOrderId) window.scrollTo({ top: 0 });
  }, [currentOrderId]);

  if (!currentOrderId) {
    return (
      <GofofaLandingLayout showBack backTo="/plans">
        <p className="text-lg">You don't have a current order.</p>
        <div className="mt-4">
          <BigLink to="/plans">Start an order</BigLink>
        </div>
      </GofofaLandingLayout>
    );
  }

  return (
    <GofofaLandingLayout>
      <StepIndicator current="done" />

      <div className="rounded-3xl bg-gold-soft border-2 border-gold p-6 text-center">
        <div className="mx-auto size-14 rounded-full bg-navy text-primary-foreground flex items-center justify-center">
          <CheckCircle2 className="size-8" aria-hidden />
        </div>
        <h1 className="mt-4 text-3xl font-display font-semibold">Order confirmed</h1>
        <p className="mt-2 text-navy/85">
          We received your order. We will notify you when it is ready for pickup.
        </p>
        <p className="mt-4 text-sm font-semibold text-navy">Order #{currentOrderId}</p>
      </div>

      {pickup && (
        <section className="mt-6 rounded-3xl bg-card border-2 border-cream-deep p-5">
          <h2 className="text-xl font-display font-semibold">Pickup</h2>
          <p className="mt-1 text-lg text-navy">{pickup.day}</p>
          <p className="text-navy/80">{pickup.time}</p>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-cream-deep/70 p-3 text-sm text-navy">
            <Bell className="size-5 flex-shrink-0 mt-0.5" aria-hidden />
            <span>We'll send you a text and email when your order is ready.</span>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-3xl bg-card border-2 border-cream-deep p-5">
        <h2 className="text-xl font-display font-semibold">Status</h2>
        <ol className="mt-4 space-y-3">
          {statusOrder.map((s, i) => {
            const done = i <= idx;
            const current = i === idx;
            return (
              <li key={s.key} className="flex items-start gap-3">
                {done ? (
                  <CheckCircle2
                    className={`size-6 flex-shrink-0 mt-0.5 ${current ? "text-gold" : "text-green"}`}
                    aria-hidden
                  />
                ) : (
                  <Circle className="size-6 flex-shrink-0 mt-0.5 text-border" aria-hidden />
                )}
                <div>
                  <p
                    className={[
                      "font-semibold",
                      current ? "text-navy" : done ? "text-navy" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </p>
                  <p className="text-sm text-navy/70">{s.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6 rounded-3xl bg-card border-2 border-cream-deep p-5">
        <h2 className="text-xl font-display font-semibold">What you're getting</h2>
        <ul className="mt-3 space-y-2">
          {lines.map((l) => {
            const cat = getCategory(l.categoryId);
            if (!cat) return null;
            return (
              <li key={cat.id + l.portion} className="flex justify-between text-navy">
                <span>
                  {l.quantity} × {cat.name} ({l.portion})
                </span>
                <span className="font-semibold">
                  ${(categoryPrice(cat, l.portion) * l.quantity).toFixed(2)}
                </span>
              </li>
            );
          })}
          {extras.map((e) => {
            const ing = getIngredient(e.ingredientId);
            if (!ing) return null;
            return (
              <li key={ing.id} className="flex justify-between text-navy">
                <span>
                  {e.quantity} × {ing.name}
                </span>
                <span className="font-semibold">${(ing.price * e.quantity).toFixed(2)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 pt-3 border-t border-cream-deep flex justify-between text-lg">
          <span>Total</span>
          <span className="font-display font-semibold">${subtotal.toFixed(2)}</span>
        </div>
      </section>

      <div className="mt-8 space-y-3">
        <BigLink to="/account">View my orders</BigLink>
        <Link
          to="/"
          className="block text-center text-navy font-semibold underline underline-offset-4 py-2"
        >
          Back to home
        </Link>
      </div>
    </GofofaLandingLayout>
  );
}
