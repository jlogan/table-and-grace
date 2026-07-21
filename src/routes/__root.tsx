import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/runtime-error-reporting";
import { OrderProvider } from "../lib/order-store";
import { Link } from "@tanstack/react-router";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-navy">404</h1>
        <h2 className="mt-4 text-2xl font-display">Page not found</h2>
        <p className="mt-3 text-base text-muted-foreground">Let's get you back to the kitchen.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-display">This page didn't load</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Something went wrong. Please try again or call us for help.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="tel:7702853600"
            className="inline-flex min-h-12 items-center rounded-full border-2 border-navy px-6 text-base font-semibold text-navy"
          >
            Call (770) 285-3600
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light only" },
      { name: "supported-color-schemes", content: "light" },
      { title: "Table and Grace — Fresh Pickup Heat & Eat Meals" },
      {
        name: "description",
        content:
          "Chef Margaux presents Table and Grace. Fresh pickup heat & eat meals, made with love. Order ahead and pick up in Acworth, Canton, or Woodstock.",
      },
      { name: "author", content: "Table and Grace" },
      { property: "og:title", content: "Table and Grace — Fresh Pickup Meals" },
      {
        property: "og:description",
        content: "Good cookin' is love you can taste. Order fresh heat & eat meals for pickup.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tag.ourstagingserver.com/" },
      { property: "og:image", content: "https://tag.ourstagingserver.com/og-image.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Table and Grace fresh pickup meals advertisement with Chef Margaux.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Table and Grace — Fresh Pickup Meals" },
      {
        name: "twitter:description",
        content: "Good cookin' is love you can taste. Order fresh heat & eat meals for pickup.",
      },
      { name: "twitter:image", content: "https://tag.ourstagingserver.com/og-image.png" },
      {
        name: "twitter:image:alt",
        content: "Table and Grace fresh pickup meals advertisement with Chef Margaux.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "canonical", href: "https://tag.ourstagingserver.com/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,600&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <OrderProvider>
        <Outlet />
      </OrderProvider>
    </QueryClientProvider>
  );
}
