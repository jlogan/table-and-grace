import { createFileRoute, Link } from "@tanstack/react-router";
import { PageLayout } from "@/components/brand/PageLayout";
import { BigLink } from "@/components/brand/BigButton";
import { Logo } from "@/components/brand/Logo";
import { PatternPanel } from "@/components/brand/PatternPanel";
import { Utensils, Clock, Flame, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Table and Grace — Fresh Pickup Heat & Eat Meals" },
      {
        name: "description",
        content:
          "Chef Margaux's fresh pickup heat & eat meals. Choose a meal-prep plan, pick 4oz or 6oz portions, and pick up in Acworth, Canton, or Woodstock.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PageLayout showAccount={false}>
      <PatternPanel
        size={130}
        opacity={0.85}
        className="rounded-3xl -mx-2 px-2 py-8"
      >
        <section className="text-center py-6">
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="mx-auto max-w-lg">
            <p className="inline-block rounded-full bg-gold-soft px-4 py-1 text-sm font-semibold text-navy mb-4">
              Fresh pickup · Heat &amp; eat
            </p>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold text-navy leading-tight">
              Fresh pickup meals,
              <br />
              <span className="italic">made with love.</span>
            </h1>
            <p className="mt-5 text-lg text-navy/85">
              Chef Margaux cooks small-batch prepared meals for easy pickup. Order ahead, heat when
              you're ready, and enjoy real food that tastes like home.
            </p>

            <div className="mt-8 space-y-3">
              <BigLink to="/plans" variant="primary">
                Start my meal order
              </BigLink>
              <BigLink to="/help-me-choose" variant="ghost">
                <Sparkles className="size-5" aria-hidden />
                Help me choose a plan
              </BigLink>
            </div>
          </div>
        </section>
      </PatternPanel>

      <section className="mt-10 rounded-3xl bg-card border-2 border-cream-deep p-6">
        <h2 className="text-xl font-display font-semibold text-navy text-center">
          How it works
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2">
          <Step icon={<Utensils className="size-6" />} n={1} title="Choose your meal plan">
            Pick one or more meal categories like High Protein, Senior Size, or Veggie.
          </Step>
          <Step icon={<Flame className="size-6" />} n={2} title="Pick 4oz or 6oz portions">
            You choose the portion that fits your appetite. Add as many as you need.
          </Step>
          <Step icon={<Clock className="size-6" />} n={3} title="Choose a pickup time">
            Pick a window that works for you. We'll let you know when it's ready.
          </Step>
          <Step icon={<Sparkles className="size-6" />} n={4} title="Heat and enjoy">
            Take home, warm up, and dig in. That's it.
          </Step>
        </ol>
      </section>


      <section className="mt-8 text-center">
        <p className="font-display italic text-2xl text-gold">
          good cookin' is love you can taste
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Acworth · Canton · Woodstock
        </p>
        <p className="mt-6 text-sm">
          <Link to="/account" className="underline underline-offset-4 text-navy font-semibold">
            Already a member? See my account
          </Link>
        </p>
      </section>
    </PageLayout>
  );
}

function Step({
  icon,
  n,
  title,
  children,
}: {
  icon: React.ReactNode;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="size-11 rounded-full bg-gold text-navy flex items-center justify-center">
          {icon}
        </div>
        <span className="mt-1 text-xs font-bold text-gold">STEP {n}</span>
      </div>
      <div>
        <h3 className="font-display font-semibold text-lg">{title}</h3>
        <p className="text-sm text-navy/80 mt-1">{children}</p>
      </div>
    </li>
  );
}
