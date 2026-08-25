import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { CircleCheck, LogOut, MessageCircle, PauseCircle, Repeat, Shield } from "lucide-react";

import { logout } from "@/auth/auth.functions.server";
import { MemberLayout } from "@/components/gofofa/MemberLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryPrice, getCategory, getIngredient } from "@/lib/mock-data";
import { useOrder } from "@/lib/order-store";
import {
  centsToLabel,
  formatOrderStatus,
  orderStatusBadgeVariant,
  type CustomerOrderSummary,
} from "@/orders/review-types";
import { fetchCustomerOrderSummaries } from "@/orders/orders.functions.server";

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }

    const orderSummaries = await fetchCustomerOrderSummaries();
    return { orderSummaries };
  },
  head: () => ({
    meta: [{ title: "My Account — GOFOFA" }],
  }),
  component: Account,
});

function Account() {
  const { user, orderSummaries } = Route.useRouteContext();
  const router = useRouter();
  const logoutFn = useServerFn(logout);
  const { pastOrders, reorder } = useOrder();

  if (!user) {
    return null;
  }

  const displayName = user.name?.trim() || user.email;
  const selectionOrders = orderSummaries.filter((o) => o.needsSelection);
  const reviewOrders = orderSummaries.filter((o) => o.needsReview);
  const activeOrders = orderSummaries.filter(
    (o) =>
      !o.needsReview &&
      !o.needsSelection &&
      o.status !== "picked_up" &&
      o.status !== "skipped" &&
      o.status !== "payment_failed",
  );
  const pastServerOrders = orderSummaries.filter(
    (o) => o.status === "picked_up" || o.status === "skipped" || o.status === "payment_failed",
  );

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

      {selectionOrders.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">
            {selectionOrders.length === 1 ? "Choose your meals" : "Choose your meals"}
          </h2>
          <ul className="mt-3 space-y-3">
            {selectionOrders.map((order) => (
              <li key={order.id}>
                <OrderSummaryCard order={order} highlight variant="selection" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reviewOrders.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">
            {reviewOrders.length === 1 ? "Review your order" : "Review your orders"}
          </h2>
          <ul className="mt-3 space-y-3">
            {reviewOrders.map((order) => (
              <li key={order.id}>
                <OrderSummaryCard order={order} highlight variant="review" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Current orders</h2>
        {activeOrders.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {activeOrders.map((order) => (
              <li key={order.id}>
                <OrderSummaryCard order={order} />
              </li>
            ))}
          </ul>
        ) : reviewOrders.length === 0 && selectionOrders.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                You don&apos;t have any current weekly orders.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                When Chef Margaux opens your weekly menu, it will appear here for selection or
                review.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {pastServerOrders.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Past weekly orders</h2>
          <ul className="mt-3 space-y-3">
            {pastServerOrders.map((order) => (
              <li key={order.id}>
                <OrderSummaryCard order={order} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pastOrders.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Demo order history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Legacy local demo orders — weekly orders above are from your account.
          </p>
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
      ) : null}
    </MemberLayout>
  );
}

function OrderSummaryCard({
  order,
  highlight,
  variant = "default",
}: {
  order: CustomerOrderSummary;
  highlight?: boolean;
  variant?: "default" | "selection" | "review";
}) {
  const weekLabel = formatWeekLabel(order.batchWeekStart);
  const cardVariant =
    variant === "selection" ? "selection" : variant === "review" ? "review" : "default";
  const linkTo =
    cardVariant === "selection" || order.status === "selection_submitted"
      ? "/account/orders/$orderId/select"
      : "/account/orders/$orderId";
  const actionLabel =
    cardVariant === "selection"
      ? order.status === "selection_in_progress"
        ? "Continue selection →"
        : "Choose meals →"
      : order.needsReview
        ? "Review order →"
        : order.status === "selection_submitted"
          ? "View selection →"
          : "View order →";

  return (
    <Link to={linkTo} params={{ orderId: order.id }} className="block">
      <Card
        className={
          highlight
            ? "border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10"
            : "transition-colors hover:bg-muted/30"
        }
      >
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {order.receiptNumber ? (
                  <>
                    Receipt {order.receiptNumber}
                    {order.externalOrderNumber ? ` · Order #${order.externalOrderNumber}` : null}
                  </>
                ) : (
                  <>Week of {weekLabel}</>
                )}
              </p>
              {!order.receiptNumber ? null : (
                <p className="text-sm text-muted-foreground">Week of {weekLabel}</p>
              )}
              <p className="mt-1 font-medium">{order.pickupLabel ?? "Pickup details pending"}</p>
              {order.planName ? (
                <p className="mt-1 text-sm text-muted-foreground">Plan: {order.planName}</p>
              ) : null}
              {order.mealsAllowed != null && cardVariant === "selection" ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.mealsSelected} of {order.mealsAllowed} meals selected
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
                  {centsToLabel(order.totalCents)}
                  {order.tipCents > 0 ? ` (incl. ${centsToLabel(order.tipCents)} tip)` : null}
                </p>
              )}
              {order.selectionDeadline && cardVariant === "selection" ? (
                <p className="mt-1 text-sm font-medium text-primary">
                  Select by {format(parseISO(order.selectionDeadline), "EEE, MMM d")}
                </p>
              ) : null}
              {order.reviewDeadline && order.needsReview ? (
                <p className="mt-1 text-sm font-medium text-primary">
                  Review by {format(parseISO(order.reviewDeadline), "EEE, MMM d")}
                </p>
              ) : null}
            </div>
            <Badge variant={orderStatusBadgeVariant(order.status)}>
              {formatOrderStatus(order.status)}
            </Badge>
          </div>
          <p className="mt-3 text-sm font-medium underline underline-offset-4">{actionLabel}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatWeekLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}
