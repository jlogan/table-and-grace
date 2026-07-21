import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageLayout } from "@/components/brand/PageLayout";
import { StepIndicator } from "@/components/brand/StepIndicator";
import { AccentPill } from "@/components/brand/AccentBadge";
import { planCategories } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { ShoppingBasket, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Choose Your Meal Plan — Table and Grace" },
      { name: "description", content: "Browse Chef Margaux's fresh pickup meal-prep plans." },
    ],
  }),
  component: Plans,
});

const allTags = ["All", "Protein", "Senior-friendly", "Low sodium", "Vegetarian", "Breakfast", "Meal prep"];

function Plans() {
  const { totalItems } = useOrder();
  const [tag, setTag] = useState("All");

  const filtered =
    tag === "All"
      ? planCategories
      : planCategories.filter((c) => c.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));

  return (
    <PageLayout showBack backTo="/" backLabel="Home">
      <StepIndicator current="meals" />

      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h1 className="text-3xl font-display font-semibold">Choose a meal plan</h1>
          <p className="mt-2 text-navy/80">
            Pick a category to see what's inside. You can add more than one.
          </p>
        </div>
      </div>

      <Link
        to="/help-me-choose"
        className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-gold-soft border-2 border-gold px-4 py-3 text-navy"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-5" aria-hidden />
          Not sure? Help me choose
        </span>
        <ArrowRight className="size-5" aria-hidden />
      </Link>

      <div className="mt-5 -mx-1 flex flex-wrap gap-2">
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={[
              "min-h-11 px-4 rounded-full text-sm font-semibold border-2 transition-colors",
              tag === t
                ? "bg-navy text-primary-foreground border-navy"
                : "bg-background text-navy border-border",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-4">
        {filtered.map((cat) => (
          <li key={cat.id}>
            <Link
              to="/plans/$categoryId"
              params={{ categoryId: cat.id }}
              className="block rounded-3xl bg-card border-2 border-cream-deep p-5 hover:border-gold transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gold">
                    {cat.tagline}
                  </p>
                  <h2 className="mt-1 text-2xl font-display font-semibold">{cat.name}</h2>
                </div>
                <span className="rounded-full bg-cream-deep px-3 py-1 text-sm font-semibold text-navy whitespace-nowrap">
                  from ${cat.price4oz.toFixed(2)}
                </span>
              </div>
              <p className="mt-3 text-navy/85">{cat.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cat.tags.map((t) => (
                  <AccentPill key={t} accent={cat.accent}>
                    {t}
                  </AccentPill>
                ))}
              </div>
              <p className="mt-3 text-sm text-navy/70">
                <span className="font-semibold text-navy">Includes:</span>{" "}
                {cat.meals.slice(0, 3).map((m) => m.name).join(" · ")}
                {cat.meals.length > 3 ? ` +${cat.meals.length - 3} more` : ""}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-navy underline underline-offset-4">
                  View meals
                </span>
                <ArrowRight className="size-5 text-navy" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {totalItems > 0 && (
        <div className="sticky bottom-4 mt-8 z-20">
          <Link
            to="/cart"
            className="flex items-center justify-between gap-3 rounded-full bg-navy text-primary-foreground px-6 py-4 shadow-lg shadow-navy/20"
          >
            <span className="flex items-center gap-2 font-semibold text-base">
              <ShoppingBasket className="size-5" aria-hidden />
              My order ({totalItems})
            </span>
            <span className="font-semibold text-base">Review →</span>
          </Link>
        </div>
      )}
    </PageLayout>
  );
}
