import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import { StepIndicator } from "@/components/brand/StepIndicator";
import { BigButton, BigLink } from "@/components/brand/BigButton";
import { categoryPrice, getCategory, ingredientItems, type PortionSize } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { Minus, Plus, Trash2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [{ title: "My Order — Table and Grace" }],
  }),
  component: Cart,
});

function Cart() {
  const { lines, extras, updateLineQty, removeLine, setExtraQty, subtotal } = useOrder();
  const nav = useNavigate();

  const isEmpty = lines.length === 0 && extras.length === 0;

  return (
    <GofofaLandingLayout showBack backTo="/plans" backLabel="Keep adding">
      <StepIndicator current="meals" />
      <h1 className="text-3xl font-display font-semibold">My order</h1>

      {isEmpty ? (
        <div className="mt-6 rounded-3xl bg-card border-2 border-cream-deep p-6 text-center">
          <p className="text-lg text-navy">Your order is empty.</p>
          <p className="mt-1 text-navy/75">Pick a meal plan to get started.</p>
          <div className="mt-5">
            <BigLink to="/plans">Choose a meal plan</BigLink>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {lines.map((l) => {
              const cat = getCategory(l.categoryId);
              if (!cat) return null;
              const price = categoryPrice(cat, l.portion);
              return (
                <li
                  key={cat.id + l.portion}
                  className="rounded-2xl bg-card border-2 border-cream-deep p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-display font-semibold">{cat.name}</h3>
                      <p className="text-sm text-navy/75">
                        {l.portion} portions · ${price.toFixed(2)} each
                      </p>
                      <p className="mt-1 text-sm text-navy/70">
                        Includes:{" "}
                        {cat.meals
                          .slice(0, 2)
                          .map((m) => m.name)
                          .join(", ")}
                        {cat.meals.length > 2 ? ` +${cat.meals.length - 2} more` : ""}
                      </p>
                    </div>
                    <span className="text-xl font-display font-semibold whitespace-nowrap">
                      ${(price * l.quantity).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <QtyControl
                      value={l.quantity}
                      onChange={(v) => updateLineQty(l.categoryId, l.portion as PortionSize, v)}
                      label={cat.name}
                    />
                    <button
                      onClick={() => removeLine(l.categoryId, l.portion as PortionSize)}
                      className="min-h-11 inline-flex items-center gap-1 text-navy/80 font-semibold px-2"
                      aria-label={`Remove ${cat.name}`}
                    >
                      <Trash2 className="size-5" aria-hidden />
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <section className="mt-8">
            <h2 className="text-2xl font-display font-semibold">Add extras</h2>
            <p className="text-navy/75">Ingredients by the container — great for meal prep.</p>
            <ul className="mt-3 space-y-3">
              {ingredientItems.map((ing) => {
                const line = extras.find((e) => e.ingredientId === ing.id);
                const qty = line?.quantity ?? 0;
                return (
                  <li
                    key={ing.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-card border border-cream-deep p-4"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-navy">{ing.name}</h3>
                      <p className="text-sm text-navy/70">
                        {ing.description} · ${ing.price.toFixed(2)}
                      </p>
                    </div>
                    <QtyControl
                      value={qty}
                      onChange={(v) => setExtraQty(ing.id, v)}
                      label={ing.name}
                      allowZero
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="mt-8 rounded-3xl bg-cream-deep/60 border-2 border-cream-deep p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-lg text-navy">Subtotal</span>
              <span className="text-3xl font-display font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-sm text-navy/70">
              You'll choose your pickup time on the next step.
            </p>
            <div className="mt-4">
              <BigButton onClick={() => nav({ to: "/review" })}>
                Review my order <ChevronRight className="size-5" />
              </BigButton>
            </div>
            <Link
              to="/plans"
              className="mt-3 block text-center text-navy font-semibold underline underline-offset-4 py-2"
            >
              Add another plan
            </Link>
          </div>
        </>
      )}
    </GofofaLandingLayout>
  );
}

function QtyControl({
  value,
  onChange,
  label,
  allowZero,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  allowZero?: boolean;
}) {
  const min = allowZero ? 0 : 1;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="size-12 rounded-full border-2 border-navy text-navy flex items-center justify-center disabled:opacity-40"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
      >
        <Minus className="size-5" />
      </button>
      <span className="text-xl font-display font-semibold w-8 text-center" aria-live="polite">
        {value}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        className="size-12 rounded-full border-2 border-navy text-navy flex items-center justify-center"
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}
