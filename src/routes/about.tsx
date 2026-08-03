import { createFileRoute } from "@tanstack/react-router";
import { GofofaLink } from "@/components/gofofa/GofofaButton";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import { Heart, Utensils, Users } from "lucide-react";
import chefMargauxImg from "@/assets/chef-margaux.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Chef Margaux — GOFOFA" },
      {
        name: "description",
        content:
          "Meet Chef Margaux, the chef behind GOFOFA and Table and Grace. Small-batch, chef-prepared weekly meals in North Georgia.",
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
    <GofofaLandingLayout>
      <article className="space-y-6">
        <header className="text-center">
          <p className="inline-block rounded-full bg-gofofa-green/15 px-4 py-1 text-sm font-semibold text-gofofa-green">
            Our story
          </p>
          <h1 className="mt-3 text-4xl">Meet Chef Margaux</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            The chef behind GOFOFA — weekly meals from Table and Grace.
          </p>
        </header>

        <figure className="relative mx-auto max-w-md">
          <div className="absolute -inset-2 rounded-[2rem] bg-gold-soft/70 -z-10" aria-hidden />
          <img
            src={chefMargauxImg}
            alt="Chef Margaux smiling, wearing her navy Table and Grace chef's coat"
            width={1024}
            height={1024}
            loading="lazy"
            className="w-full h-auto rounded-3xl border-2 border-cream-deep shadow-sm object-cover"
          />
          <figcaption className="mt-3 text-center text-sm text-navy/70 font-display italic">
            Chef Margaux in the kitchen
          </figcaption>
        </figure>

        <section className="rounded-3xl border-2 border-border bg-card p-6 space-y-4">
          <p className="text-base leading-relaxed">
            Table and Grace started in a home kitchen with a simple idea: neighbors deserve real,
            home-cooked food, even on the busiest days. Chef Margaux cooks every batch by hand — no
            shortcuts, no mystery ingredients — using recipes she's been fine-tuning her whole life.
          </p>
          <p className="text-base leading-relaxed">
            GOFOFA brings that same care to your weekly routine. Share your goals, and Margaux plans
            fresh meals that fit your life — whether you're training hard or just want dinner
            handled without cooking every night.
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
          <p className="text-lg font-semibold uppercase tracking-wide text-gofofa-green">
            Good food. Made right. Made for you.
          </p>
          <div className="mt-5">
            <GofofaLink to="/signup" variant="primary">
              Join GOFOFA
            </GofofaLink>
          </div>
        </section>
      </article>
    </GofofaLandingLayout>
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
    <div className="rounded-2xl border-2 border-border bg-card p-5 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-gofofa-green text-white">
        {icon}
      </div>
      <h2 className="mt-3 text-lg">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
