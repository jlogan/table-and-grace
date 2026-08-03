import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, LogOut, MessageCircle, PauseCircle, Repeat, Shield } from "lucide-react";

import { logout } from "@/auth/auth.functions.server";
import { MemberLayout } from "@/components/gofofa/MemberLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryPrice, getCategory, getIngredient, pickupWindows } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";

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
    <MemberLayout>
      <Card>
        <CardHeader>
          <CardDescription>Your GOFOFA account</CardDescription>
          <CardTitle className="text-2xl">{displayName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{user.email}</p>
          {user.phone ? <p>{user.phone}</p> : null}
          <div className="flex flex-wrap gap-2 pt-3">
            {user.role === "admin" ? (
              <Button variant="outline" className="min-h-11" asChild>
                <Link to="/admin">
                  <Shield className="size-4" aria-hidden />
                  Admin
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" className="min-h-11" onClick={handleLogout}>
              <LogOut className="size-4" aria-hidden />
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-green" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Subscription: Active</p>
              <p className="text-sm text-muted-foreground">Weekly meal plan · Next order Tuesday</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="min-h-11">
              <PauseCircle className="size-4" aria-hidden />
              Pause
            </Button>
            <Button className="min-h-11" asChild>
              <Link to="/plans">Adjust plan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Current order</h2>
        {currentOrderId ? (
          <Link to="/confirmation" className="mt-3 block">
            <Card className="transition-colors hover:bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Order #{currentOrderId}</p>
                    <p className="mt-1 font-medium">
                      {pickup ? `Pickup ${pickup.day}, ${pickup.time}` : "Pickup: pending"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lines.reduce((n, l) => n + l.quantity, 0) +
                        extras.reduce((n, e) => n + e.quantity, 0)}{" "}
                      items
                    </p>
                  </div>
                  <Badge variant="secondary">Preparing</Badge>
                </div>
                <p className="mt-3 text-sm font-medium underline underline-offset-4">
                  See order status →
                </p>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="mt-3">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">You don&apos;t have a current order.</p>
              <Button className="mt-4 min-h-11" asChild>
                <Link to="/plans">Start a new order</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Past orders</h2>
        <ul className="mt-3 space-y-4">
          {pastOrders.map((o) => (
            <li key={o.id}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Order #{o.id}</p>
                      <p className="mt-1 font-medium">{o.pickupLabel}</p>
                      <p className="text-sm text-muted-foreground">{o.placedAt} · Picked up</p>
                    </div>
                    <span className="font-semibold tabular-nums">${o.total.toFixed(2)}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
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
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" className="min-h-11" asChild>
                      <Link to="/feedback/$orderId" params={{ orderId: o.id }}>
                        <MessageCircle className="size-4" aria-hidden />
                        {o.feedbackLeft ? "Feedback sent" : "Leave feedback"}
                      </Link>
                    </Button>
                    <Button className="min-h-11" onClick={() => reorder(o)}>
                      <Repeat className="size-4" aria-hidden />
                      Order again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </MemberLayout>
  );
}
