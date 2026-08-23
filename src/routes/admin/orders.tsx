import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  centsToLabel,
  formatOrderStatus,
  formatPaymentSchedule,
  orderStatusBadgeVariant,
} from "@/orders/review-types";
import { fetchAdminBatches, fetchAdminOrders } from "@/orders/admin.functions.server";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: (search: Record<string, unknown>) => ({
    batchId: typeof search.batchId === "string" ? search.batchId : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const [batches, orders] = await Promise.all([
      fetchAdminBatches(),
      fetchAdminOrders({ data: { batchId: search.batchId } }),
    ]);
    return { batches, orders };
  },
  head: () => ({
    meta: [{ title: "Orders — GOFOFA Ops" }],
  }),
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const { batches, orders } = Route.useRouteContext();
  const { batchId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleBatchFilter(value: string) {
    setLoading(true);
    try {
      await navigate({
        search: { batchId: value === "all" ? undefined : value },
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedBatch = batches.find((b) => b.id === batchId);

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Orders</h2>
        <p className="text-sm text-muted-foreground">
          Weekly orders by membership — catalog menu items, portion sizes (4 oz / 6 oz), and line
          pricing from the active item catalog. Legacy imported orders may show no plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {selectedBatch
                  ? `Week of ${formatDateString(selectedBatch.weekStart, "MMM d, yyyy")}`
                  : "All batches"}
              </CardTitle>
              <CardDescription>
                {loading
                  ? "Loading…"
                  : `${orders.length} order(s) · each line links to a catalog item with portion and unit price`}
              </CardDescription>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-filter">Batch</Label>
              <Select value={batchId ?? "all"} onValueChange={handleBatchFilter} disabled={loading}>
                <SelectTrigger id="batch-filter" className="w-[220px]">
                  <SelectValue placeholder="All batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {formatDateString(batch.weekStart, "MMM d, yyyy")} ({batch.orderCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead className="text-right">Catalog lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const customerLabel = order.customerName?.trim() || order.customerEmail;

                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium">{customerLabel}</div>
                        {order.customerName ? (
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.planName ?? (order.membershipId ? "—" : "Legacy")}
                      </TableCell>
                      <TableCell>{formatDateString(order.batchWeekStart, "MMM d")}</TableCell>
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
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {order.customerVisibleNote ?? (
                          <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
