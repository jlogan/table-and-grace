import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/brand/PageLayout";
import { BigLink } from "@/components/brand/BigButton";
import { Heart, Utensils, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Chef Margaux — Table and Grace" },
      {
        name: "description",
        content:
          "Meet Chef Margaux, the heart behind Table and Grace. Small-batch, chef-prepared heat & eat meals made with love in North Georgia.",
      },
      { property: "og:title", content: "About Chef Margaux — Table and Grace" },
      {
        property: "og:description",
        content:
          "The story behind Table and Grace and Chef Margaux's small-batch, heat & eat meal-prep kitchen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageLayout>
      <article className="space-y-6">
        <header className="text-center">
          <p className="inline-block rounded-full bg-gold-soft px-4 py-1 text-sm font-semibold text-navy">
            Our story
          </p>
          <h1 className="mt-3 text-4xl font-display font-semibold text-navy">
            Meet Chef Margaux
          </h1>
          <p className="mt-3 text-lg text-navy/85">
            The heart, hands, and love behind every Table and Grace meal.
          </p>
        </header>

        <section className="rounded-3xl bg-card border-2 border-cream-deep p-6 space-y-4">
          <p className="text-base leading-relaxed text-navy/90">
            Table and Grace started in a home kitchen with a simple idea: neighbors
            deserve real, home-cooked food, even on the busiest days. Chef Margaux
            cooks every batch by hand — no shortcuts, no mystery ingredients —
            using recipes she's been fine-tuning her whole life.
          </p>
          <p className="text-base leading-relaxed text-navy/90">
            We're small on purpose. Small enough to know your name, remember your
            favorites, and cook the kind of meals you'd cook for yourself if you
            had all day in the kitchen.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Value icon={<Heart className="size-6" />} title="Made with love">
            Every meal is cooked by Chef Margaux herself in small batches.
          </Value>
          <Value icon={<Utensils className="size-6" />} title="Real ingredients">
            Whole foods, fresh produce, and pantry basics you can pronounce.
          </Value>
          <Value icon={<Users className="size-6" />} title="For our neighbors">
            Feeding families in Acworth, Canton, and Woodstock.
          </Value>
        </section>

        <section className="rounded-3xl bg-secondary p-6 text-center">
          <p className="font-display italic text-2xl text-gold">
            good cookin' is love you can taste
          </p>
          <div className="mt-5">
            <BigLink to="/plans" variant="primary">
              See this week's meals
            </BigLink>
          </div>
        </section>
      </article>
    </PageLayout>
  );
}

function Value({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border-2 border-cream-deep p-5 text-center">
      <div className="mx-auto size-11 rounded-full bg-gold text-navy flex items-center justify-center">
        {icon}
      </div>
      <h2 className="mt-3 font-display font-semibold text-lg text-navy">{title}</h2>
      <p className="mt-1 text-sm text-navy/80">{children}</p>
    </div>
  );
}
