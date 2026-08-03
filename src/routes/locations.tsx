import { createFileRoute } from "@tanstack/react-router";
import { GofofaLink } from "@/components/gofofa/GofofaButton";
import { GofofaLandingLayout } from "@/components/gofofa/GofofaLandingLayout";
import { MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/locations")({
  head: () => ({
    meta: [
      { title: "Pickup Locations — GOFOFA" },
      {
        name: "description",
        content:
          "Pick up your Table and Grace meals in Acworth, Canton, or Woodstock, Georgia. See pickup windows and directions for each location.",
      },
      { property: "og:title", content: "Pickup Locations — Table and Grace" },
      {
        property: "og:description",
        content: "Fresh heat & eat meal pickup in Acworth, Canton, and Woodstock, Georgia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocationsPage,
});

const locations = [
  {
    name: "Acworth",
    address: "Downtown Acworth, GA",
    days: "Tuesday & Friday",
    hours: "3:00pm – 6:00pm",
  },
  {
    name: "Canton",
    address: "Canton, GA",
    days: "Wednesday",
    hours: "4:00pm – 6:30pm",
  },
  {
    name: "Woodstock",
    address: "Downtown Woodstock, GA",
    days: "Thursday & Saturday",
    hours: "10:00am – 1:00pm",
  },
];

function LocationsPage() {
  return (
    <GofofaLandingLayout>
      <header className="mb-6 text-center">
        <p className="inline-block rounded-full bg-gofofa-green/15 px-4 py-1 text-sm font-semibold text-gofofa-green">
          Where to grab your meals
        </p>
        <h1 className="mt-3 text-4xl">Pickup Locations</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Convenient pickup windows across North Georgia.
        </p>
      </header>

      <ul className="space-y-4">
        {locations.map((l) => (
          <li key={l.name} className="rounded-3xl border-2 border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gofofa-green text-white">
                <MapPin className="size-6" aria-hidden />
              </div>
              <div>
                <h2 className="text-2xl">{l.name}</h2>
                <p className="text-base text-navy/90">{l.address}</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-navy">
                  <Clock className="size-4" aria-hidden />
                  {l.days} · {l.hours}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <GofofaLink to="/signup" variant="primary">
          Join GOFOFA
        </GofofaLink>
      </div>
    </GofofaLandingLayout>
  );
}
