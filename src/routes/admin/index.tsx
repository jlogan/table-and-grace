import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, ClipboardCheck, CreditCard } from "lucide-react";

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

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard — GOFOFA Ops" }],
  }),
  component: AdminDashboardPage,
});

const kpiCards = [
  {
    title: "Current batch",
    value: "—",
    detail: "No active batch configured",
    icon: CalendarClock,
  },
  {
    title: "Ready for review",
    value: "0",
    detail: "Orders awaiting chef review",
    icon: ClipboardCheck,
  },
  {
    title: "Payment issues",
    value: "0",
    detail: "Failed or pending charges",
    icon: CreditCard,
  },
  {
    title: "Pickup readiness",
    value: "—",
    detail: "Slots not scheduled",
    icon: AlertTriangle,
  },
] as const;

const placeholderOrders = [
  { id: "—", customer: "—", items: "—", status: "Pending data", pickup: "—" },
  { id: "—", customer: "—", items: "—", status: "Pending data", pickup: "—" },
  { id: "—", customer: "—", items: "—", status: "Pending data", pickup: "—" },
];

function AdminDashboardPage() {
  return (
    <>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Operations overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Kitchen dashboard skeleton — wire to weekly batches and orders in Phase 3–4.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(({ title, value, detail, icon: Icon }) => (
          <Card key={title} className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">This week&apos;s orders</CardTitle>
              <CardDescription>Review queue and pickup assignments</CardDescription>
            </div>
            <Badge variant="secondary">Placeholder</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pickup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {placeholderOrders.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium tabular-nums">{row.id}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.items}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell>{row.pickup}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kitchen prep list</CardTitle>
            <CardDescription>Batch cooking quantities by menu item</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex justify-between border-b border-border pb-2">
                <span>Menu item</span>
                <span className="tabular-nums">Qty</span>
              </li>
              <li className="flex justify-between py-1">
                <span>—</span>
                <span className="tabular-nums">—</span>
              </li>
              <li className="flex justify-between py-1">
                <span>—</span>
                <span className="tabular-nums">—</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Comments, status changes, payment events</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="border-b border-border pb-2">
                No activity yet — connect notifications in Phase 4.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
