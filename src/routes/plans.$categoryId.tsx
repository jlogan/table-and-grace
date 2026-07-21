import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageLayout } from "@/components/brand/PageLayout";
import { StepIndicator } from "@/components/brand/StepIndicator";
import { BigButton } from "@/components/brand/BigButton";
import { AccentPill } from "@/components/brand/AccentBadge";
import { categoryPrice, getCategory, type PortionSize } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { Minus, Plus, ChevronRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/plans/$categoryId")({
  head: ({ params }) => {
    const cat = getCategory(params.categoryId);
    return {
      meta: [
        {
          title: cat ? `${cat.name} — Table and Grace` : "Meal Plan — Table and Grace",
        },
        {
          name: "description",
          content: cat ? cat.description : "Table and Grace meal plan.",
        },
      ],
    };
  },
  component: CategoryDetail,
  notFoundComponent: () => (
    <PageLayout showBack backTo="/plans" backLabel="All plans">
      <p className="text-lg">We couldn't find that meal plan.</p>
    </PageLayout>
  ),
});

function CategoryDetail() {
  const { categoryId } = Route.useParams();
  const cat = getCategory(categoryId);
  const { addLine } = useOrder();
  const nav = useNavigate();
  const [portion, setPortion] = useState<PortionSize>("6oz");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!cat) {
    return (
      <PageLayout showBack backTo="/plans" backLabel="All plans">
        <p className="text-lg">We couldn't find that meal plan.</p>
      </PageLayout>
    );
  }

  const price = categoryPrice(cat, portion);

  const handleAdd = () => {
    addLine(cat.id, portion, qty);
    setAdded(true);
  };

  return (
    <PageLayout showBack backTo="/plans" backLabel="All plans">
      <StepIndicator current="meals" />

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gold">{cat.tagline}</p>
        <h1 className="mt-1 text-4xl font-display font-semibold">{cat.name}</h1>
        <p className="mt-3 text-lg text-navy/85">{cat.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cat.tags.map((t) => (
            <AccentPill key={t} accent={cat.accent}>
              {t}
            </AccentPill>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-cream-deep/60 border-2 border-cream-deep p-4">
        <p className="text-sm font-semibold text-navy">Recommended for</p>
        <p className="mt-1 text-navy/85">{cat.recommendedFor}</p>
      </div>

      <section className="mt-6">
        <h2 className="text-2xl font-display font-semibold">Meals included</h2>
        <ul className="mt-3 space-y-2">
          {cat.meals.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-2xl bg-card border border-cream-deep p-4"
            >
              <CheckCircle2 className="size-6 text-green flex-shrink-0 mt-0.5" aria-hidden />
              <span className="text-lg text-navy">{m.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-display font-semibold">Choose portion size</h2>
        <p className="mt-1 text-navy/75">Portion is set for this plan.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["4oz", "6oz"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPortion(p)}
              className={[
                "min-h-16 rounded-2xl border-2 p-4 text-left transition-colors",
                portion === p
                  ? "border-navy bg-navy text-primary-foreground"
                  : "border-border bg-card text-navy",
              ].join(" ")}
              aria-pressed={portion === p}
            >
              <div className="text-xl font-display font-semibold">{p}</div>
              <div
                className={[
                  "text-sm",
                  portion === p ? "text-primary-foreground/85" : "text-navy/70",
                ].join(" ")}
              >
                ${(p === "4oz" ? cat.price4oz : cat.price6oz).toFixed(2)} each
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-2xl font-display font-semibold">How many?</h2>
        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="size-14 rounded-full border-2 border-navy text-navy flex items-center justify-center"
            aria-label="Decrease quantity"
          >
            <Minus className="size-6" />
          </button>
          <div className="text-4xl font-display font-semibold w-16 text-center" aria-live="polite">
            {qty}
          </div>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="size-14 rounded-full border-2 border-navy text-navy flex items-center justify-center"
            aria-label="Increase quantity"
          >
            <Plus className="size-6" />
          </button>
        </div>
      </section>

      <div className="mt-8 rounded-3xl bg-card border-2 border-cream-deep p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-navy">Line total</span>
          <span className="text-2xl font-display font-semibold">
            ${(price * qty).toFixed(2)}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {added ? (
            <>
              <div className="flex items-center gap-2 rounded-2xl bg-[#dff4d1] text-[#1f6f10] p-3">
                <CheckCircle2 className="size-5" aria-hidden />
                <span className="font-semibold">Added to your order</span>
              </div>
              <BigButton variant="primary" onClick={() => nav({ to: "/cart" })}>
                Review my order <ChevronRight className="size-5" />
              </BigButton>
              <Link
                to="/plans"
                className="block text-center text-navy font-semibold underline underline-offset-4 py-2"
              >
                Add another plan
              </Link>
            </>
          ) : (
            <BigButton variant="primary" onClick={handleAdd}>
              Add to my order
            </BigButton>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
