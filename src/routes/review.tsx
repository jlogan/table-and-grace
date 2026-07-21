import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageLayout } from "@/components/brand/PageLayout";
import { StepIndicator } from "@/components/brand/StepIndicator";
import { BigButton } from "@/components/brand/BigButton";
import {
  categoryPrice,
  getCategory,
  getIngredient,
  pickupWindows,
} from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { Pencil, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [{ title: "Review Order — Table and Grace" }],
  }),
  component: Review,
});

function Review() {
  const { lines, extras, subtotal, pickupWindowId } = useOrder();
  const nav = useNavigate();
  const [name, setName] = useState("Margaret Wilson");
  const [phone, setPhone] = useState("(770) 555-0142");

  const pickup = pickupWindows.find((p) => p.id === pickupWindowId);

  if (lines.length === 0 && extras.length === 0) {
    return (
      <PageLayout showBack backTo="/cart" backLabel="Back">
        <p className="text-lg">Your order is empty. Add a plan first.</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout showBack backTo="/cart" backLabel="Back to cart">
      <StepIndicator current="review" />
      <h1 className="text-3xl font-display font-semibold">Review my order</h1>
      <p className="mt-2 text-navy/80">Take a look before we send it to the kitchen.</p>

      <Section title="Who is this for?" editHref="/review">
        <label className="block mt-2">
          <span className="text-sm font-semibold text-navy">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full min-h-12 rounded-xl border-2 border-border bg-card px-4 text-base text-navy focus:outline-none focus:border-navy"
          />
        </label>
        <label className="block mt-3">
          <span className="text-sm font-semibold text-navy">Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="mt-1 w-full min-h-12 rounded-xl border-2 border-border bg-card px-4 text-base text-navy focus:outline-none focus:border-navy"
          />
        </label>
      </Section>

      <Section title="Your meal plans" editHref="/cart">
        <ul className="space-y-3">
          {lines.map((l) => {
            const cat = getCategory(l.categoryId);
            if (!cat) return null;
            const price = categoryPrice(cat, l.portion);
            return (
              <li key={cat.id + l.portion} className="flex justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-navy">
                    {cat.name}
                  </p>
                  <p className="text-sm text-navy/75">
                    {l.quantity} × {l.portion} · ${price.toFixed(2)} each
                  </p>
                </div>
                <span className="font-display font-semibold">
                  ${(price * l.quantity).toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      {extras.length > 0 && (
        <Section title="Extras" editHref="/cart">
          <ul className="space-y-2">
            {extras.map((e) => {
              const ing = getIngredient(e.ingredientId);
              if (!ing) return null;
              return (
                <li key={ing.id} className="flex justify-between">
                  <span>
                    {e.quantity} × {ing.name}
                  </span>
                  <span className="font-display font-semibold">
                    ${(ing.price * e.quantity).toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Pickup" editHref="/pickup">
        {pickup ? (
          <div>
            <p className="text-lg font-semibold text-navy">{pickup.day}</p>
            <p className="text-navy/80">{pickup.time}</p>
          </div>
        ) : (
          <div>
            <p className="text-navy/80">You haven't chosen a pickup time yet.</p>
            <Link
              to="/pickup"
              className="mt-3 inline-flex min-h-12 items-center rounded-full bg-gold px-5 text-navy font-semibold"
            >
              Choose pickup time
            </Link>
          </div>
        )}
      </Section>

      <div className="mt-6 rounded-3xl bg-cream-deep/60 border-2 border-cream-deep p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-lg">Total</span>
          <span className="text-3xl font-display font-semibold">
            ${subtotal.toFixed(2)}
          </span>
        </div>
        <p className="mt-1 text-sm text-navy/70">You'll pay in person at pickup.</p>
        <div className="mt-4">
          <BigButton
            onClick={() => nav({ to: pickupWindowId ? "/confirmation" : "/pickup" })}
            disabled={!name || !phone}
          >
            {pickupWindowId ? "Submit my order" : "Choose pickup time"}
            <ChevronRight className="size-5" />
          </BigButton>
        </div>
      </div>
    </PageLayout>
  );
}

function Section({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-3xl bg-card border-2 border-cream-deep p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-display font-semibold">{title}</h2>
        <Link
          to={editHref as never}
          className="inline-flex min-h-11 items-center gap-1 text-navy font-semibold px-2"
        >
          <Pencil className="size-4" aria-hidden /> Edit
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
