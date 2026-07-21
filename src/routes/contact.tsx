import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/brand/PageLayout";
import { Phone, Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Table and Grace — Chef Margaux's Meal Prep" },
      {
        name: "description",
        content:
          "Call, email, or stop by to order Table and Grace fresh pickup meals. We're happy to take your order or answer questions.",
      },
      { property: "og:title", content: "Contact — Table and Grace" },
      {
        property: "og:description",
        content:
          "Reach Chef Margaux and the Table and Grace kitchen. Call (770) 285-3600.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <PageLayout>
      <header className="text-center mb-6">
        <p className="inline-block rounded-full bg-gold-soft px-4 py-1 text-sm font-semibold text-navy">
          We'd love to hear from you
        </p>
        <h1 className="mt-3 text-4xl font-display font-semibold text-navy">
          Contact Us
        </h1>
        <p className="mt-3 text-lg text-navy/85">
          Prefer to place your order by phone? We're happy to help.
        </p>
      </header>

      <ul className="space-y-4">
        <li className="rounded-3xl bg-card border-2 border-cream-deep p-5">
          <a href="tel:7702853600" className="flex items-start gap-3">
            <div className="size-11 rounded-full bg-gold text-navy flex items-center justify-center flex-shrink-0">
              <Phone className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-navy">Call us</h2>
              <p className="text-base text-navy underline underline-offset-4">
                (770) 285-3600
              </p>
              <p className="mt-1 text-sm text-navy/70">
                Mon–Sat, 9:00am to 5:00pm
              </p>
            </div>
          </a>
        </li>

        <li className="rounded-3xl bg-card border-2 border-cream-deep p-5">
          <a href="mailto:hello@tableandgrace.com" className="flex items-start gap-3">
            <div className="size-11 rounded-full bg-gold text-navy flex items-center justify-center flex-shrink-0">
              <Mail className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-navy">Email</h2>
              <p className="text-base text-navy underline underline-offset-4">
                hello@tableandgrace.com
              </p>
              <p className="mt-1 text-sm text-navy/70">
                We reply within one business day.
              </p>
            </div>
          </a>
        </li>

        <li className="rounded-3xl bg-card border-2 border-cream-deep p-5">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-full bg-gold text-navy flex items-center justify-center flex-shrink-0">
              <MapPin className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-navy">Service area</h2>
              <p className="text-base text-navy/90">
                Acworth · Canton · Woodstock, Georgia
              </p>
            </div>
          </div>
        </li>
      </ul>
    </PageLayout>
  );
}
