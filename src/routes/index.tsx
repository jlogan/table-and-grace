import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChefHat,
  ClipboardList,
  Heart,
  Leaf,
  ShieldCheck,
  Sparkles,
  Target,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

import { GofofaAnchor, GofofaLink } from "@/components/gofofa/GofofaButton";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import { GofofaWordmark } from "@/components/gofofa/GofofaWordmark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GOFOFA — Weekly Meals from Table and Grace" },
      {
        name: "description",
        content:
          "Personal-chef-style weekly meal planning from Chef Margaux. Fresh meals built around your goals — fitness, health, and easy dinners without cooking.",
      },
      { property: "og:title", content: "GOFOFA — Good Food. Made Right. Made For You." },
      {
        property: "og:description",
        content:
          "Join GOFOFA for chef-guided weekly meals. Tell us your goals, and Chef Margaux plans fresh dinners for you.",
      },
    ],
  }),
  component: Home,
});

const mealCategories = [
  {
    title: "Lean proteins",
    description: "Grilled chicken, turkey, and fish-forward plates for active lifestyles.",
    accent: "bg-gofofa-green/15 text-gofofa-green",
  },
  {
    title: "Balanced dinners",
    description: "Well-rounded plates with vegetables, grains, and satisfying portions.",
    accent: "bg-gofofa-red/10 text-gofofa-red",
  },
  {
    title: "High-protein bowls",
    description: "Fuel for training days — protein-packed without feeling like diet food.",
    accent: "bg-gofofa-green/15 text-gofofa-green",
  },
  {
    title: "Comfort, made lighter",
    description:
      "Familiar favorites with thoughtful ingredients — homestyle without the heaviness.",
    accent: "bg-gofofa-red/10 text-gofofa-red",
  },
  {
    title: "Senior-friendly dinners",
    description: "Easy-to-heat, right-sized portions — fresh alternatives to frozen meals.",
    accent: "bg-gofofa-green/15 text-gofofa-green",
  },
  {
    title: "Family portions & sides",
    description: "Larger servings and add-ons to round out your weekly routine.",
    accent: "bg-gofofa-red/10 text-gofofa-red",
  },
];

const goals = [
  "Eat healthier without meal-prep burnout",
  "Support fitness and training consistently",
  "Simplify weeknight dinners",
  "Skip the frozen-food rut",
  "Manage portions with confidence",
  "Stay on track with a dependable routine",
];

function Home() {
  return (
    <GofofaLandingLayout wide>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gofofa-green px-6 py-10 text-white sm:px-10 sm:py-14">
        <div className="absolute -right-8 -top-8 size-40 rounded-full bg-white/10" aria-hidden />
        <div
          className="absolute -bottom-12 -left-6 size-56 rounded-full bg-gofofa-red/20"
          aria-hidden
        />

        <div className="relative text-center">
          <div className="mb-6 flex justify-center [&_p:first-child]:text-white [&_p:nth-child(2)]:text-white/85 [&_p:nth-child(3)]:text-gofofa-cream">
            <GofofaWordmark to={null} size="lg" />
          </div>

          <p className="mx-auto max-w-lg text-lg leading-relaxed text-white/90 sm:text-xl">
            Your personal chef for a fraction of the price. Fresh weekly meals planned around{" "}
            <em className="not-italic font-semibold text-white">your</em> goals — no menu
            spreadsheets, no frozen-food fatigue.
          </p>

          <div className="mx-auto mt-8 max-w-md space-y-3">
            <GofofaLink
              to="/signup"
              variant="secondary"
              className="border-0 bg-white text-gofofa-green hover:bg-gofofa-cream"
            >
              Start your meal plan
              <ArrowRight className="size-5" aria-hidden />
            </GofofaLink>
            <GofofaAnchor
              href="#how-it-works"
              variant="ghost"
              className="border-white/40 text-white hover:bg-white/10"
            >
              See how it works
            </GofofaAnchor>
          </div>

          <p className="mt-6 text-sm text-white/75">
            Already a member?{" "}
            <Link to="/login" className="font-semibold text-white underline underline-offset-4">
              Log in
            </Link>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mt-12 scroll-mt-24">
        <SectionHeading
          eyebrow="Simple weekly routine"
          title="How GOFOFA works"
          subtitle="Chef Margaux guides your meals — you share your goals, she handles the planning."
        />
        <ol className="mt-8 grid gap-5 sm:grid-cols-2">
          <ProcessStep
            n={1}
            icon={<ClipboardList className="size-6" />}
            title="Create your profile"
          >
            Sign up and tell us how you eat — household size, schedule, and what matters to you.
          </ProcessStep>
          <ProcessStep n={2} icon={<Target className="size-6" />} title="Share goals & preferences">
            Fitness targets, allergies, dislikes, portion needs — whatever helps us cook for you.
          </ProcessStep>
          <ProcessStep n={3} icon={<ChefHat className="size-6" />} title="Chef builds your week">
            Margaux recommends meals tailored to your goals. Review and update before cutoff when
            needed.
          </ProcessStep>
          <ProcessStep n={4} icon={<Truck className="size-6" />} title="Pick up & enjoy">
            Fresh, prepared meals ready when you are. Heat, eat, and stay consistent.
          </ProcessStep>
        </ol>
      </section>

      {/* Why GOFOFA */}
      <section className="mt-12">
        <SectionHeading
          eyebrow="Why members choose us"
          title="Personal chef planning, practical pricing"
        />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          <WhyCard icon={<ChefHat className="size-6" />} title="Chef-guided, not DIY menus">
            You are not building every weekly menu from scratch. A real chef plans around your
            goals.
          </WhyCard>
          <WhyCard icon={<Leaf className="size-6" />} title="Fresh beats frozen">
            Prepared weekly in small batches — a fresher alternative to freezer-aisle dinners.
          </WhyCard>
          <WhyCard icon={<Heart className="size-6" />} title="Built for real life">
            Whether you are training hard or just want dinner handled, GOFOFA fits your routine.
          </WhyCard>
          <WhyCard icon={<ShieldCheck className="size-6" />} title="Local chef you can trust">
            Chef Margaux and Table and Grace — North Georgia meal prep with care and consistency.
          </WhyCard>
        </ul>
      </section>

      {/* Meal types */}
      <section id="meal-types" className="mt-12 scroll-mt-24">
        <SectionHeading
          eyebrow="Sample categories"
          title="Meals we prepare"
          subtitle="Your exact weekly lineup is chef-recommended based on your profile — these are the kinds of dishes you can expect."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {mealCategories.map((cat) => (
            <article
              key={cat.title}
              className="group overflow-hidden rounded-2xl border-2 border-border bg-card transition-shadow hover:shadow-md"
            >
              <div className={`flex h-24 items-end p-4 ${cat.accent}`}>
                <UtensilsCrossed className="size-8 opacity-60" aria-hidden />
              </div>
              <div className="p-5">
                <h3 className="font-[family-name:var(--font-gofofa-display)] text-lg uppercase tracking-wide text-gofofa-black">
                  {cat.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {cat.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Goal-based planning */}
      <section className="mt-12 rounded-3xl border-2 border-gofofa-green/30 bg-gofofa-green/5 p-6 sm:p-8">
        <SectionHeading
          eyebrow="Goal-based planning"
          title="Your goals, turned into meals"
          subtitle="Tell GOFOFA what you are working toward — Margaux translates that into a practical weekly plan."
        />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => (
            <li
              key={goal}
              className="flex items-start gap-3 rounded-xl bg-card px-4 py-3 text-sm font-medium text-gofofa-black"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-gofofa-red" aria-hidden />
              {goal}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <GofofaLink to="/signup" variant="primary">
            Get started with a personal chef-style meal plan
          </GofofaLink>
        </div>
      </section>

      {/* Audience segments */}
      <section className="mt-12 grid gap-6 sm:grid-cols-2">
        <AudienceCard
          title="Fitness & health"
          points={[
            "Fresh weekly meals that support your training",
            "Goal-supportive planning without generic diet food",
            "Simple routine — eat well even on busy weeks",
          ]}
        />
        <AudienceCard
          title="Easy dinners & convenience"
          points={[
            "Fresh dinners without nightly cooking stress",
            "A dependable weekly routine you can count on",
            "Less frozen-food fatigue, more real meals",
          ]}
        />
      </section>

      {/* Reviews / trust — structure only, no invented quotes */}
      <section id="reviews" className="mt-12 scroll-mt-24">
        <SectionHeading eyebrow="Member stories" title="What customers are saying" />
        <div className="mt-8 rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Customer reviews and testimonials will appear here as GOFOFA members share their
            experience.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Be among the first — create your account and start your weekly meal plan today.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-12 rounded-3xl bg-gofofa-red px-6 py-10 text-center text-white sm:px-10">
        <h2 className="font-[family-name:var(--font-gofofa-display)] text-3xl uppercase tracking-wide sm:text-4xl">
          Ready for easier, better weeks?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-white/90">
          Create your account, tell GOFOFA your goals, and let Chef Margaux handle the rest.
        </p>
        <div className="mx-auto mt-8 max-w-sm space-y-3">
          <GofofaLink
            to="/signup"
            variant="primary"
            className="border-0 bg-white text-gofofa-red hover:bg-gofofa-cream"
          >
            Create your GOFOFA account
          </GofofaLink>
          <Link
            to="/login"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-white/50 px-6 text-base font-semibold text-white hover:bg-white/10"
          >
            I already have an account
          </Link>
        </div>
      </section>
    </GofofaLandingLayout>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="text-center">
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gofofa-red">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}

function ProcessStep({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border-2 border-border bg-card p-5">
      <div className="flex shrink-0 flex-col items-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-gofofa-green text-white">
          {icon}
        </div>
        <span className="mt-1.5 text-xs font-bold uppercase tracking-wider text-gofofa-green">
          Step {n}
        </span>
      </div>
      <div>
        <h3 className="font-[family-name:var(--font-gofofa-display)] text-lg uppercase tracking-wide">
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function WhyCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border-2 border-border bg-card p-5">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-gofofa-red/10 text-gofofa-red">
        {icon}
      </div>
      <h3 className="font-[family-name:var(--font-gofofa-display)] text-lg uppercase tracking-wide">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}

function AudienceCard({ title, points }: { title: string; points: string[] }) {
  return (
    <article className="rounded-2xl border-2 border-border bg-card p-6">
      <h3 className="font-[family-name:var(--font-gofofa-display)] text-xl uppercase tracking-wide text-gofofa-green">
        {title}
      </h3>
      <ul className="mt-4 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gofofa-red" aria-hidden />
            {point}
          </li>
        ))}
      </ul>
    </article>
  );
}
