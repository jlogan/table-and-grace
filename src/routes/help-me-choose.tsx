import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageLayout } from "@/components/brand/PageLayout";
import { BigButton } from "@/components/brand/BigButton";
import { recommendFromGoals, wizardGoals, type PlanCategory } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/help-me-choose")({
  head: () => ({
    meta: [
      { title: "Help Me Choose — Table and Grace" },
      { name: "description", content: "Tell us your goals and we'll suggest a plan." },
    ],
  }),
  component: HelpMeChoose,
});

function HelpMeChoose() {
  const nav = useNavigate();
  const { addLine } = useOrder();
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [results, setResults] = useState<PlanCategory[] | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const toggleChip = (c: string) =>
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const getRecs = () => {
    const goals = [...chips, text].filter(Boolean);
    setResults(recommendFromGoals(goals));
  };

  const addPlan = (cat: PlanCategory) => {
    addLine(cat.id, "6oz", 1);
    setAddedIds((a) => [...a, cat.id]);
  };

  return (
    <PageLayout showBack backTo="/plans" backLabel="Back to plans">
      <div className="rounded-3xl bg-gold-soft border-2 border-gold p-5">
        <div className="flex items-center gap-2 font-semibold text-navy">
          <Sparkles className="size-5" aria-hidden />
          Help me choose a plan
        </div>
        <p className="mt-2 text-navy/85">
          Tell us a little about what you're looking for. We'll suggest one or two plans that might
          be a good fit. This is optional — you can always browse all plans.
        </p>
      </div>

      {!results ? (
        <>
          <div className="mt-6">
            <label htmlFor="goals" className="block text-lg font-semibold text-navy">
              What are your goals?
            </label>
            <p className="text-sm text-navy/75">In your own words — or pick a few below.</p>
            <textarea
              id="goals"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. I want easy dinners that aren't too salty for my dad."
              className="mt-2 w-full rounded-2xl border-2 border-border bg-card p-4 text-base text-navy focus:outline-none focus:border-navy"
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-navy">Quick picks</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {wizardGoals.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleChip(g)}
                  className={[
                    "min-h-11 px-4 rounded-full text-sm font-semibold border-2",
                    chips.includes(g)
                      ? "bg-navy text-primary-foreground border-navy"
                      : "bg-background text-navy border-border",
                  ].join(" ")}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <BigButton onClick={getRecs} disabled={!text && chips.length === 0}>
              See my suggestions
            </BigButton>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-6 text-2xl font-display font-semibold">
            {results.length === 1 ? "Here's a plan we think you'll love" : "Here are a few good fits"}
          </h2>
          <ul className="mt-4 space-y-4">
            {results.map((cat) => (
              <li
                key={cat.id}
                className="rounded-3xl bg-card border-2 border-cream-deep p-5"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-gold">
                  {cat.tagline}
                </p>
                <h3 className="mt-1 text-2xl font-display font-semibold">{cat.name}</h3>
                <p className="mt-2 text-navy/85">{cat.description}</p>
                <p className="mt-3 text-sm text-navy/75 italic">Why: {cat.recommendedFor}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Link
                    to="/plans/$categoryId"
                    params={{ categoryId: cat.id }}
                    className="min-h-14 rounded-full border-2 border-navy text-navy font-semibold flex items-center justify-center"
                  >
                    See meals
                  </Link>
                  <BigButton
                    variant="gold"
                    onClick={() => addPlan(cat)}
                    disabled={addedIds.includes(cat.id)}
                  >
                    {addedIds.includes(cat.id) ? (
                      <>
                        <CheckCircle2 className="size-5" /> Added
                      </>
                    ) : (
                      <>Add this plan</>
                    )}
                  </BigButton>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-3">
            <BigButton variant="primary" onClick={() => nav({ to: "/cart" })}>
              Go to my order <ArrowRight className="size-5" />
            </BigButton>
            <button
              onClick={() => setResults(null)}
              className="w-full min-h-12 rounded-full border-2 border-navy text-navy font-semibold"
            >
              Try different goals
            </button>
          </div>
        </>
      )}
    </PageLayout>
  );
}
