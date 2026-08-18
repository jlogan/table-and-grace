import { createFileRoute, Link } from "@tanstack/react-router";

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
import { batchStatusBadgeVariant, formatBatchStatus } from "@/orders/admin-types";
import { fetchAdminDashboard } from "@/orders/admin.functions.server";

export const Route = createFileRoute("/admin/kitchen")({
  beforeLoad: async () => {
    const overview = await fetchAdminDashboard();
    return { overview };
  },
  head: () => ({
    meta: [{ title: "Kitchen — GOFOFA Ops" }],
  }),
  component: AdminKitchenPage,
});

function AdminKitchenPage() {
  const { overview } = Route.useRouteContext();
  const { currentBatch, prepTotals } = overview;

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Kitchen prep</h2>
        <p className="text-sm text-muted-foreground">
          Pick lists and cooked quantities for the current batch — demand from member orders vs
          inventory on hand.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {currentBatch
                  ? `Week of ${formatDateString(currentBatch.weekStart, "MMM d, yyyy")}`
                  : "No batch selected"}
              </CardTitle>
              <CardDescription>
                {currentBatch
                  ? `${currentBatch.orderCount} order(s) · ${currentBatch.itemCount} menu item(s) in inventory`
                  : "Create a batch and set inventory first"}
              </CardDescription>
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
                <TableHead>Menu item</TableHead>
                <TableHead className="text-right">Needed</TableHead>
                <TableHead className="text-right">Cooked</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prepTotals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No prep data yet.{" "}
                    <Link
                      to="/admin/batches"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Add batch inventory
                    </Link>{" "}
                    and publish orders for members.
                  </TableCell>
                </TableRow>
              ) : (
                prepTotals.map((row) => {
                  const gap = row.qtyNeeded - row.qtyRemaining;
                  return (
                    <TableRow key={row.menuItemId}>
                      <TableCell className="font-medium">{row.menuItemName}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.qtyNeeded}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.qtyCooked}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.qtyRemaining}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${gap > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                      >
                        {gap > 0 ? `+${gap}` : gap === 0 ? "OK" : gap}
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
