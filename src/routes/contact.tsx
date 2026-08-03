import { createFileRoute } from "@tanstack/react-router";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import { Phone, Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact GOFOFA — Table and Grace" },
      {
        name: "description",
        content:
          "Call, email, or stop by to order Table and Grace fresh pickup meals. We're happy to take your order or answer questions.",
      },
      { property: "og:title", content: "Contact — Table and Grace" },
      {
        property: "og:description",
        content: "Reach Chef Margaux and the Table and Grace kitchen. Call (770) 285-3600.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <GofofaLandingLayout>
      <header className="mb-6 text-center">
        <p className="inline-block rounded-full bg-gofofa-green/15 px-4 py-1 text-sm font-semibold text-gofofa-green">
          We'd love to hear from you
        </p>
        <h1 className="mt-3 text-4xl">Contact Us</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Questions about GOFOFA or need help signing up? We're here.
        </p>
      </header>

      <ul className="space-y-4">
        <li className="rounded-3xl border-2 border-border bg-card p-5">
          <a href="tel:7702853600" className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gofofa-green text-white">
              <Phone className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl">Call us</h2>
              <p className="text-base underline underline-offset-4">(770) 285-3600</p>
              <p className="mt-1 text-sm text-navy/70">Mon–Sat, 9:00am to 5:00pm</p>
            </div>
          </a>
        </li>

        <li className="rounded-3xl border-2 border-border bg-card p-5">
          <a href="mailto:hello@tableandgrace.com" className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gofofa-green text-white">
              <Mail className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl">Email</h2>
              <p className="text-base underline underline-offset-4">hello@tableandgrace.com</p>
              <p className="mt-1 text-sm text-navy/70">We reply within one business day.</p>
            </div>
          </a>
        </li>

        <li className="rounded-3xl border-2 border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gofofa-green text-white">
              <MapPin className="size-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl">Service area</h2>
              <p className="text-base">Acworth · Canton · Woodstock, Georgia</p>
            </div>
          </div>
        </li>
      </ul>
    </GofofaLandingLayout>
  );
}
