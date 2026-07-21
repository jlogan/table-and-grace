import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageLayout } from "@/components/brand/PageLayout";
import { BigButton } from "@/components/brand/BigButton";
import { getCategory } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { Star, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/feedback/$orderId")({
  head: () => ({
    meta: [{ title: "Food Feedback — Table and Grace" }],
  }),
  component: Feedback,
});

function Feedback() {
  const { orderId } = Route.useParams();
  const nav = useNavigate();
  const { pastOrders } = useOrder();
  const order = useMemo(() => pastOrders.find((o) => o.id === orderId), [pastOrders, orderId]);

  const [overall, setOverall] = useState(0);
  const [wouldOrderAgain, setWouldOrderAgain] = useState<null | boolean>(null);
  const [comment, setComment] = useState("");
  const [perMeal, setPerMeal] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);

  if (!order) {
    return (
      <PageLayout showBack backTo="/account" backLabel="My account">
        <p className="text-lg">We couldn't find that order.</p>
      </PageLayout>
    );
  }

  if (sent) {
    return (
      <PageLayout showBack backTo="/account" backLabel="My account">
        <div className="rounded-3xl bg-gold-soft border-2 border-gold p-6 text-center">
          <div className="mx-auto size-14 rounded-full bg-navy text-primary-foreground flex items-center justify-center">
            <CheckCircle2 className="size-8" aria-hidden />
          </div>
          <h1 className="mt-4 text-3xl font-display font-semibold">Thank you!</h1>
          <p className="mt-2 text-navy/85">
            Chef Margaux loves reading your notes. It helps us cook better meals for you.
          </p>
          <div className="mt-6">
            <BigButton onClick={() => nav({ to: "/account" })}>Back to my account</BigButton>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout showBack backTo="/account" backLabel="My account">
      <p className="text-xs font-bold uppercase tracking-widest text-gold">
        Order #{order.id}
      </p>
      <h1 className="mt-1 text-3xl font-display font-semibold">
        How did these meals work for you?
      </h1>
      <p className="mt-2 text-navy/80">
        Your notes go straight to Chef Margaux. Keep it as short as you like.
      </p>

      <section className="mt-6 rounded-3xl bg-card border-2 border-cream-deep p-5">
        <h2 className="text-xl font-display font-semibold">Overall rating</h2>
        <RatingRow value={overall} onChange={setOverall} />
      </section>

      <section className="mt-5 rounded-3xl bg-card border-2 border-cream-deep p-5">
        <h2 className="text-xl font-display font-semibold">By meal plan</h2>
        <ul className="mt-3 space-y-4">
          {order.lines.map((l) => {
            const cat = getCategory(l.categoryId);
            if (!cat) return null;
            const key = cat.id + l.portion;
            return (
              <li key={key}>
                <p className="font-semibold text-navy">{cat.name}</p>
                <p className="text-sm text-navy/70">
                  {l.quantity} × {l.portion}
                </p>
                <RatingRow
                  value={perMeal[key] ?? 0}
                  onChange={(v) => setPerMeal((m) => ({ ...m, [key]: v }))}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-5 rounded-3xl bg-card border-2 border-cream-deep p-5">
        <h2 className="text-xl font-display font-semibold">Would you order this again?</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { v: true, label: "Yes, please" },
            { v: false, label: "Not this time" },
          ].map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setWouldOrderAgain(o.v)}
              className={[
                "min-h-14 rounded-full border-2 font-semibold",
                wouldOrderAgain === o.v
                  ? "bg-navy text-primary-foreground border-navy"
                  : "bg-background text-navy border-navy",
              ].join(" ")}
              aria-pressed={wouldOrderAgain === o.v}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-card border-2 border-cream-deep p-5">
        <label htmlFor="comment" className="text-xl font-display font-semibold">
          Anything else? (Optional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="What did you love? What could we do better?"
          className="mt-3 w-full rounded-2xl border-2 border-border bg-background p-4 text-base text-navy focus:outline-none focus:border-navy"
        />
      </section>

      <div className="mt-8">
        <BigButton onClick={() => setSent(true)} disabled={overall === 0}>
          Send my feedback
        </BigButton>
      </div>
    </PageLayout>
  );
}

function RatingRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={[
            "size-12 rounded-full border-2 flex items-center justify-center",
            n <= value ? "bg-gold border-gold text-navy" : "bg-background border-border text-navy/50",
          ].join(" ")}
          aria-label={`${n} out of 5`}
          aria-pressed={n === value}
          role="radio"
          aria-checked={n === value}
        >
          <Star className={`size-6 ${n <= value ? "fill-navy" : ""}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}
