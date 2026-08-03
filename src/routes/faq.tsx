import { createFileRoute } from "@tanstack/react-router";
import { GofofaLink } from "@/components/gofofa/GofofaButton";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — GOFOFA Weekly Meals" },
      {
        name: "description",
        content:
          "Frequently asked questions about Table and Grace's fresh pickup heat & eat meals — portions, storage, ingredients, and pickup windows.",
      },
      { property: "og:title", content: "FAQ — Table and Grace" },
      {
        property: "og:description",
        content: "Everything you need to know about ordering fresh pickup meals from Chef Margaux.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

const faqs = [
  {
    q: "How do I get started with GOFOFA?",
    a: "Create your account, tell us your goals and preferences, and Chef Margaux will recommend weekly meals tailored to you. Review and update before cutoff when needed.",
  },
  {
    q: "Do I pick every meal myself?",
    a: "Not necessarily. GOFOFA is chef-guided — Margaux builds recommendations around your profile. You can review and adjust before each week's cutoff.",
  },
  {
    q: "How long do the meals last?",
    a: "Meals are cooked fresh the day of pickup and stay great in the fridge for about 4 days. You can also freeze them for up to a month.",
  },
  {
    q: "How do I reheat the meals?",
    a: "Most meals reheat beautifully in the microwave (2-3 minutes) or a 350°F oven (12-15 minutes covered). Heating instructions come with every order.",
  },
  {
    q: "Where do I pick up my order?",
    a: "We offer pickup in Acworth, Canton, and Woodstock, Georgia. You'll choose your preferred spot and window at checkout.",
  },
  {
    q: "Do you accommodate allergies or diets?",
    a: "We do our best. Chef Margaux cooks in a shared kitchen, but we clearly label each meal's ingredients. Give us a call at (770) 285-3600 to talk through anything specific.",
  },
  {
    q: "Can I order for a large family or event?",
    a: "Yes! For bigger orders or catering, call (770) 285-3600 and we'll plan it with you.",
  },
];

function FaqPage() {
  return (
    <GofofaLandingLayout>
      <header className="mb-6 text-center">
        <p className="inline-block rounded-full bg-gofofa-green/15 px-4 py-1 text-sm font-semibold text-gofofa-green">
          Good questions
        </p>
        <h1 className="mt-3 text-4xl">Frequently Asked Questions</h1>
      </header>

      <div className="rounded-3xl border-2 border-border bg-card p-2 sm:p-4">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-lg">{f.q}</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="mt-8 text-center">
        <GofofaLink to="/signup" variant="primary">
          Create your GOFOFA account
        </GofofaLink>
      </div>
    </GofofaLandingLayout>
  );
}
