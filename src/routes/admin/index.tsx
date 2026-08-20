import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardCheck, CreditCard, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateString } from "@/lib/dates";
import {
  batchStatusBadgeVariant,
  formatBatchStatus,
  formatMembershipStatus,
  membershipStatusBadgeVariant,
} from "@/orders/admin-types";
import {
  centsToLabel,
  formatOrderStatus,
  formatPaymentSchedule,
  orderStatusBadgeVariant,
} from "@/orders/review-types";
import { fetchAdminDashboard } from "@/orders/admin.functions.server";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    const overview = await fetchAdminDashboard();
    return { overview };
  },
  head: () => ({
    meta: [{ title: "Dashboard — GOFOFA Ops" }],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { overview } = Route.useRouteContext();
  const { currentBatch, reviewQueueCount, activeMemberCount, customerCount } = overview;

  const kpiCards = [
    {
      title: "Current batch",
      value: currentBatch ? formatDateString(currentBatch.weekStart, "MMM d") : "—",
      detail: currentBatch
        ? `${formatBatchStatus(currentBatch.status)} · ${currentBatch.orderCount} order(s)`
        : "Create a batch to start the week",
      icon: CalendarClock,
      href: "/admin/batches" as const,
    },
    {
      title: "Ready for review",
      value: String(reviewQueueCount),
      detail: "Orders awaiting customer or chef review",
      icon: ClipboardCheck,
      href: "/admin/orders" as const,
    },
    {
      title: "Active members",
      value: String(activeMemberCount),
      detail: `${customerCount} total customer account(s)`,
      icon: Users,
      href: "/admin/memberships" as const,
    },
    {
      title: "Payment sync",
      value: "—",
      detail: "Stripe invoices — connect in a later phase",
      icon: CreditCard,
      href: "/admin/settings" as const,
    },
  ] as const;

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Operations overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Pilot workflow snapshot — batches, members, and this week&apos;s prep at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(({ title, value, detail, icon: Icon, href }) => (
          <Link key={title} to={href} className="block transition-opacity hover:opacity-90">
            <Card className="h-full shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {currentBatch
                  ? `This week — ${formatDateString(currentBatch.weekStart, "MMM d, yyyy")}`
                  : "This week's orders"}
              </CardTitle>
              <CardDescription>Review queue and pickup assignments</CardDescription>
            </div>
            {currentBatch ? (
              <Badge variant={batchStatusBadgeVariant(currentBatch.status)}>
                {formatBatchStatus(currentBatch.status)}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No orders for the current batch yet.{" "}
                    <Link
                      to="/admin/batches"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Set inventory and publish
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              ) : (
                overview.recentOrders.map((order) => {
                  const customerLabel = order.customerName?.trim() || order.customerEmail;
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium">{customerLabel}</div>
                        {order.customerName ? (
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={orderStatusBadgeVariant(order.status)}>
                          {formatOrderStatus(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatPaymentSchedule(order.paymentSchedule)}
                      </TableCell>
                      <TableCell>{order.pickupLabel ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{order.itemCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {centsToLabel(order.totalCents)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kitchen prep list</CardTitle>
            <CardDescription>
              Order demand vs cooked inventory for the current batch
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.prepTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No prep quantities yet — add batch inventory under Batches.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between border-b border-border pb-2 font-medium text-muted-foreground">
                  <span>Menu item</span>
                  <span className="tabular-nums">Need / Cooked</span>
                </li>
                {overview.prepTotals.map((row) => (
                  <li key={row.menuItemId} className="flex justify-between gap-4 py-1">
                    <span className="truncate">{row.menuItemName}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.qtyNeeded} / {row.qtyCooked}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming members</CardTitle>
            <CardDescription>Active memberships — cadence and plan type</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.upcomingCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active memberships yet.{" "}
                <Link
                  to="/admin/customers"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Add a pilot customer
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {overview.upcomingCustomers.map((member) => {
                  const label = member.name?.trim() || member.email;
                  return (
                    <li
                      key={member.membershipId}
                      className="border-b border-border pb-3 last:border-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{label}</span>
                        <Badge variant={membershipStatusBadgeVariant(member.membershipStatus)}>
                          {formatMembershipStatus(member.membershipStatus)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {member.planName ?? "Plan TBD"}
                        {member.mealsPerWeek ? ` · ${member.mealsPerWeek} meals/wk` : ""}
                        {" · "}
                        {formatPaymentSchedule(member.paymentSchedule)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
