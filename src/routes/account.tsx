import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PageLayout } from "@/components/brand/PageLayout";
import { categoryPrice, getCategory, getIngredient, pickupWindows } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import { BigLink } from "@/components/brand/BigButton";
import { CircleCheck, PauseCircle, MessageCircle, Repeat, LogOut, Shield } from "lucide-react";
import { logout } from "@/auth/auth.functions.server";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  },
  head: () => ({
    meta: [{ title: "My Account — GOFOFA" }],
  }),
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const logoutFn = useServerFn(logout);
  const { currentOrderId, pickupWindowId, lines, extras, pastOrders, reorder } = useOrder();
  const pickup = pickupWindows.find((p) => p.id === pickupWindowId);

  if (!user) {
    return null;
  }

  const displayName = user.name?.trim() || user.email;

  async function handleLogout() {
    await logoutFn();
    await router.invalidate();
    await router.navigate({ to: "/", replace: true });
  }

  return (
    <PageLayout showBack backTo="/" backLabel="Home" showAccount={false}>
      <div className="rounded-3xl bg-card border-2 border-cream-deep p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gold">Welcome back</p>
        <h1 className="mt-1 text-3xl font-display font-semibold">{displayName}</h1>
        <p className="mt-1 text-navy/80">{user.email}</p>
        {user.phone ? <p className="mt-1 text-navy/80">{user.phone}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {user.role === "admin" ? (
            <Link
              to="/admin"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-navy px-4 text-navy font-semibold"
            >
              <Shield className="size-5" aria-hidden />
              Admin
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-navy px-4 text-navy font-semibold"
          >
            <LogOut className="size-5" aria-hidden />
            Log out
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-3xl bg-cream-deep/60 border-2 border-cream-deep p-5">
        <div className="flex items-center gap-3">
          <CircleCheck className="size-7 text-green" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-navy">Subscription: Active</p>
            <p className="text-sm text-navy/75">Weekly meal plan · Next order Tuesday</p>
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          <button className="min-h-12 flex-1 rounded-full border-2 border-navy text-navy font-semibold flex items-center justify-center gap-2">
            <PauseCircle className="size-5" aria-hidden /> Pause
          </button>
          <Link
            to="/plans"
            className="min-h-12 flex-1 rounded-full bg-navy text-primary-foreground font-semibold flex items-center justify-center"
          >
            Adjust plan
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-2xl font-display font-semibold">Current order</h2>
        {currentOrderId ? (
          <Link
            to="/confirmation"
            className="mt-3 block rounded-3xl bg-card border-2 border-cream-deep p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-navy/70">Order #{currentOrderId}</p>
                <p className="text-lg font-semibold text-navy mt-1">
                  {pickup ? `Pickup ${pickup.day}, ${pickup.time}` : "Pickup: pending"}
                </p>
                <p className="text-sm text-navy/75 mt-1">
                  {lines.reduce((n, l) => n + l.quantity, 0) +
                    extras.reduce((n, e) => n + e.quantity, 0)}{" "}
                  items
                </p>
              </div>
              <span className="rounded-full bg-gold px-3 py-1 text-sm font-semibold text-navy whitespace-nowrap">
                Preparing
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-navy underline underline-offset-4">
              See order status →
            </p>
          </Link>
        ) : (
          <div className="mt-3 rounded-3xl bg-card border-2 border-cream-deep p-5 text-center">
            <p className="text-navy/80">You don't have a current order.</p>
            <div className="mt-4">
              <BigLink to="/plans">Start a new order</BigLink>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-display font-semibold">Past orders</h2>
        <ul className="mt-3 space-y-4">
          {pastOrders.map((o) => (
            <li key={o.id} className="rounded-3xl bg-card border-2 border-cream-deep p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-navy/70">Order #{o.id}</p>
                  <p className="text-lg font-semibold text-navy">{o.pickupLabel}</p>
                  <p className="text-sm text-navy/75">{o.placedAt} · Picked up</p>
                </div>
                <span className="font-display font-semibold">${o.total.toFixed(2)}</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-navy/80">
                {o.lines.map((l) => {
                  const cat = getCategory(l.categoryId);
                  if (!cat) return null;
                  return (
                    <li key={cat.id + l.portion}>
                      {l.quantity} × {cat.name} ({l.portion}) — $
                      {(categoryPrice(cat, l.portion) * l.quantity).toFixed(2)}
                    </li>
                  );
                })}
                {o.extras.map((e) => {
                  const ing = getIngredient(e.ingredientId);
                  if (!ing) return null;
                  return (
                    <li key={ing.id}>
                      {e.quantity} × {ing.name}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  to="/feedback/$orderId"
                  params={{ orderId: o.id }}
                  className="min-h-12 rounded-full border-2 border-navy text-navy font-semibold flex items-center justify-center gap-2"
                >
                  <MessageCircle className="size-5" aria-hidden />
                  {o.feedbackLeft ? "Feedback sent" : "Leave feedback"}
                </Link>
                <button
                  onClick={() => reorder(o)}
                  className="min-h-12 rounded-full bg-gold text-navy font-semibold flex items-center justify-center gap-2"
                >
                  <Repeat className="size-5" aria-hidden />
                  Order again
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PageLayout>
  );
}
