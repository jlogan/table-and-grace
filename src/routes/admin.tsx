import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { PageLayout } from "@/components/brand/PageLayout";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
    if (context.user.role !== "admin") {
      throw redirect({ to: "/account" });
    }
  },
  head: () => ({
    meta: [{ title: "Admin — GOFOFA" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = Route.useRouteContext();

  return (
    <PageLayout showBack backTo="/" backLabel="Home">
      <div className="rounded-3xl bg-card border-2 border-cream-deep p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gold">Admin</p>
        <h1 className="mt-1 text-3xl font-display font-semibold">Operations dashboard</h1>
        <p className="mt-2 text-navy/80">
          Signed in as {user?.name ?? user?.email} ({user?.role}).
        </p>
      </div>

      <section className="mt-6 rounded-3xl bg-cream-deep/60 border-2 border-cream-deep p-5">
        <h2 className="text-xl font-display font-semibold text-navy">Coming in Phase 4</h2>
        <ul className="mt-3 space-y-2 text-sm text-navy/80 list-disc pl-5">
          <li>Weekly batch overview and order counts</li>
          <li>Kitchen pick lists and labels</li>
          <li>Order comments and in-app notifications</li>
        </ul>
        <p className="mt-4 text-sm text-navy/70">
          This route confirms admin role guarding works. Business tools ship with chef admin
          features.
        </p>
      </section>

      <div className="mt-6">
        <Link
          to="/account"
          className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-navy px-5 text-navy font-semibold"
        >
          Back to my account
        </Link>
      </div>
    </PageLayout>
  );
}
