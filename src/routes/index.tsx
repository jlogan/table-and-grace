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

import logoAsset from "@/assets/table-and-grace-logo.png.asset.json";
import chefMargauxImg from "@/assets/chef-margaux.jpg";
import { GofofaAnchor, GofofaLink } from "@/components/gofofa/GofofaButton";
import { GofofaLandingLayout, GofofaLandingSection } from "@/components/gofofa/GofofaLandingLayout";
import { GofofaWordmark } from "@/components/gofofa/GofofaWordmark";
import { PatternPanel } from "@/components/brand/PatternPanel";

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
    accent: "from-gofofa-green/80 to-gofofa-green",
  },
  {
    title: "Balanced dinners",
    description: "Well-rounded plates with vegetables, grains, and satisfying portions.",
    accent: "from-gofofa-red/70 to-gofofa-red",
  },
  {
    title: "High-protein bowls",
    description: "Fuel for training days — protein-packed without feeling like diet food.",
    accent: "from-gofofa-green/70 to-gofofa-black/80",
  },
  {
    title: "Comfort, made lighter",
    description:
      "Familiar favorites with thoughtful ingredients — homestyle without the heaviness.",
    accent: "from-gofofa-red/60 to-gofofa-green/70",
  },
  {
    title: "Senior-friendly dinners",
    description: "Easy-to-heat, right-sized portions — fresh alternatives to frozen meals.",
    accent: "from-gofofa-green/60 to-gofofa-cream/90",
  },
  {
    title: "Family portions & sides",
    description: "Larger servings and add-ons to round out your weekly routine.",
    accent: "from-gofofa-red/50 to-gofofa-red",
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
      {/* Full-bleed hero */}
      <section className="relative overflow-hidden bg-gofofa-green text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("${logoAsset.url}")`,
            backgroundSize: "120px",
            backgroundRepeat: "repeat",
          }}
          aria-hidden
        />
        <div
          className="absolute -right-16 top-10 size-72 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-20 -left-10 size-96 rounded-full bg-gofofa-red/25 blur-3xl"
          aria-hidden
        />

        <GofofaLandingSection wide className="relative py-10 sm:py-14 lg:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="text-center lg:text-left">
              <div className="mb-6 flex justify-center lg:justify-start [&_p:first-child]:text-white [&_p:nth-child(2)]:text-white/85 [&_p:nth-child(3)]:text-gofofa-cream">
                <GofofaWordmark to={null} size="lg" />
              </div>

              <p className="text-lg leading-relaxed text-white/90 sm:text-xl lg:max-w-xl">
                Your personal chef for a fraction of the price. Fresh weekly meals planned around{" "}
                <em className="not-italic font-semibold text-white">your</em> goals — no menu
                spreadsheets, no frozen-food fatigue.
              </p>

              <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row lg:mx-0 lg:max-w-none">
                <GofofaLink
                  to="/signup"
                  variant="secondary"
                  className="min-h-14 flex-1 border-0 bg-white px-8 text-base text-gofofa-green hover:bg-gofofa-cream sm:flex-none"
                >
                  Start your meal plan
                  <ArrowRight className="size-5" aria-hidden />
                </GofofaLink>
                <GofofaAnchor
                  href="#how-it-works"
                  variant="ghost"
                  className="min-h-14 border-white/40 text-white hover:bg-white/10"
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

            <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div
                className="absolute -inset-3 rounded-[2rem] bg-gofofa-red/40 blur-sm"
                aria-hidden
              />
              <img
                src={chefMargauxImg}
                alt="Chef Margaux in her Table and Grace kitchen, preparing fresh weekly meals"
                width={1024}
                height={1024}
                fetchPriority="high"
                className="relative aspect-square w-full rounded-3xl border-4 border-white/30 object-cover shadow-2xl"
              />
              <figcaption className="mt-4 text-center text-sm font-medium text-white/80 lg:text-left">
                Chef Margaux · Table and Grace, North Georgia
              </figcaption>
            </figure>
          </div>
        </GofofaLandingSection>
      </section>

      {/* Visual trust band */}
      <PatternPanel className="border-y-2 border-border py-8" opacity={0.55} size={140}>
        <GofofaLandingSection wide className="py-0">
          <div className="grid gap-6 sm:grid-cols-3">
            <VisualStat value="Weekly" label="Fresh batches cooked by Chef Margaux" />
            <VisualStat value="Local" label="Pickup in Acworth, Canton & Woodstock" />
            <VisualStat value="Personal" label="Meals planned around your goals" />
          </div>
        </GofofaLandingSection>
      </PatternPanel>

      <GofofaLandingSection wide className="space-y-12 pt-10">
        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24">
          <SectionHeading
            eyebrow="Simple weekly routine"
            title="How GOFOFA works"
            subtitle="Chef Margaux guides your meals — you share your goals, she handles the planning."
          />
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <ProcessStep
              n={1}
              icon={<ClipboardList className="size-6" />}
              title="Create your profile"
            >
              Sign up and tell us how you eat — household size, schedule, and what matters to you.
            </ProcessStep>
            <ProcessStep
              n={2}
              icon={<Target className="size-6" />}
              title="Share goals & preferences"
            >
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
        <section>
          <SectionHeading
            eyebrow="Why members choose us"
            title="Personal chef planning, practical pricing"
          />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </GofofaLandingSection>

      {/* Meal types — full-bleed photo-style grid */}
      <section id="meal-types" className="scroll-mt-24 bg-secondary/60 py-12">
        <GofofaLandingSection wide className="py-0">
          <SectionHeading
            eyebrow="Sample categories"
            title="Meals we prepare"
            subtitle="Your exact weekly lineup is chef-recommended based on your profile — these are the kinds of dishes you can expect."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mealCategories.map((cat) => (
              <article
                key={cat.title}
                className="group overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className={`relative flex h-36 items-end bg-gradient-to-br p-5 ${cat.accent}`}>
                  <div
                    className="absolute inset-0 opacity-30 mix-blend-overlay"
                    style={{
                      backgroundImage: `url("${logoAsset.url}")`,
                      backgroundSize: "80px",
                      backgroundRepeat: "repeat",
                    }}
                    aria-hidden
                  />
                  <UtensilsCrossed
                    className="relative size-10 text-white drop-shadow"
                    aria-hidden
                  />
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
        </GofofaLandingSection>
      </section>

      <GofofaLandingSection wide className="space-y-12">
        {/* Goal-based planning */}
        <section className="rounded-3xl border-2 border-gofofa-green/30 bg-gofofa-green/5 p-6 sm:p-10">
          <SectionHeading
            eyebrow="Goal-based planning"
            title="Your goals, turned into meals"
            subtitle="Tell GOFOFA what you are working toward — Margaux translates that into a practical weekly plan."
          />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="mt-8 flex flex-wrap justify-center gap-3 sm:justify-start">
            <GofofaLink to="/signup" variant="primary" className="min-h-14 px-8 text-base">
              Get started with a personal chef-style meal plan
            </GofofaLink>
            <GofofaLink to="/about" variant="outline" className="min-h-14 px-8 text-base">
              Meet Chef Margaux
            </GofofaLink>
          </div>
        </section>

        {/* Audience segments */}
        <section className="grid gap-6 lg:grid-cols-2">
          <AudienceCard
            title="Fitness & health"
            image={chefMargauxImg}
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
        <section id="reviews" className="scroll-mt-24">
          <SectionHeading eyebrow="Member stories" title="What customers are saying" />
          <div className="mt-8 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card">
            <div className="grid lg:grid-cols-2">
              <div className="relative hidden min-h-[220px] lg:block">
                <img
                  src={chefMargauxImg}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 size-full object-cover object-top opacity-90"
                />
                <div className="absolute inset-0 bg-gofofa-green/40" aria-hidden />
              </div>
              <div className="p-8 text-center lg:text-left">
                <p className="text-muted-foreground">
                  Customer reviews and testimonials will appear here as GOFOFA members share their
                  experience.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Be among the first — create your account and start your weekly meal plan today.
                </p>
                <GofofaLink to="/signup" variant="primary" className="mt-6 min-h-12">
                  Join GOFOFA today
                </GofofaLink>
              </div>
            </div>
          </div>
        </section>
      </GofofaLandingSection>

      {/* Final CTA — full bleed */}
      <section className="mt-12 bg-gofofa-red px-6 py-14 text-center text-white sm:px-10 lg:py-20">
        <GofofaLandingSection wide className="py-0">
          <h2 className="font-[family-name:var(--font-gofofa-display)] text-3xl uppercase tracking-wide sm:text-4xl lg:text-5xl">
            Ready for easier, better weeks?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90 sm:text-xl">
            Create your account, tell GOFOFA your goals, and let Chef Margaux handle the rest.
          </p>
          <div className="mx-auto mt-10 flex max-w-lg flex-col gap-3 sm:flex-row sm:justify-center">
            <GofofaLink
              to="/signup"
              variant="primary"
              className="min-h-14 flex-1 border-0 bg-white px-8 text-base text-gofofa-red hover:bg-gofofa-cream sm:flex-none"
            >
              Create your GOFOFA account
            </GofofaLink>
            <Link
              to="/login"
              className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full border-2 border-white/50 px-8 text-base font-semibold text-white hover:bg-white/10 sm:flex-none"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-8 text-sm text-white/75">
            Questions?{" "}
            <a href="tel:7702853600" className="font-semibold underline underline-offset-4">
              Call (770) 285-3600
            </a>
          </p>
        </GofofaLandingSection>
      </section>
    </GofofaLandingLayout>
  );
}

function VisualStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-[family-name:var(--font-gofofa-display)] text-3xl uppercase tracking-wide text-gofofa-green sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-gofofa-black/80">{label}</p>
    </div>
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
      {subtitle ? <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{subtitle}</p> : null}
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

function AudienceCard({
  title,
  points,
  image,
}: {
  title: string;
  points: string[];
  image?: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-border bg-card">
      {image ? (
        <div className="relative h-40 overflow-hidden">
          <img src={image} alt="" className="size-full object-cover object-top" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          <h3 className="absolute bottom-4 left-6 font-[family-name:var(--font-gofofa-display)] text-xl uppercase tracking-wide text-gofofa-green">
            {title}
          </h3>
        </div>
      ) : (
        <div className="border-b border-border bg-gofofa-green/10 px-6 py-4">
          <h3 className="font-[family-name:var(--font-gofofa-display)] text-xl uppercase tracking-wide text-gofofa-green">
            {title}
          </h3>
        </div>
      )}
      <ul className="space-y-2 p-6">
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
