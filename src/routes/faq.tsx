import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/brand/PageLayout";
import { BigLink } from "@/components/brand/BigButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Meal Prep Questions | Table and Grace" },
      {
        name: "description",
        content:
          "Frequently asked questions about Table and Grace's fresh pickup heat & eat meals — portions, storage, ingredients, and pickup windows.",
      },
      { property: "og:title", content: "FAQ — Table and Grace" },
      {
        property: "og:description",
        content:
          "Everything you need to know about ordering fresh pickup meals from Chef Margaux.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

const faqs = [
  {
    q: "How do I place an order?",
    a: "Choose a meal plan (like High Protein or Senior Size), pick your portion size (4oz or 6oz), add the quantity you'd like, and select a pickup window. That's it — we'll have your meals ready when you arrive.",
  },
  {
    q: "What's the difference between 4oz and 6oz portions?",
    a: "The 4oz portion is our smaller, lighter serving — great for kids, seniors, or a lighter lunch. The 6oz portion is a full adult dinner-sized serving. Order whatever mix fits your household.",
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
    <PageLayout>
      <header className="text-center mb-6">
        <p className="inline-block rounded-full bg-gold-soft px-4 py-1 text-sm font-semibold text-navy">
          Good questions
        </p>
        <h1 className="mt-3 text-4xl font-display font-semibold text-navy">
          Frequently Asked Questions
        </h1>
      </header>

      <div className="rounded-3xl bg-card border-2 border-cream-deep p-2 sm:p-4">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left font-display text-lg text-navy">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-base text-navy/85">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="mt-8 text-center">
        <BigLink to="/plans" variant="primary">
          Ready? Start my order
        </BigLink>
      </div>
    </PageLayout>
  );
}
