import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMembershipStatus, membershipStatusBadgeVariant } from "@/orders/admin-types";
import { fetchAdminMemberships, updateAdminCustomerProfile } from "@/orders/admin.functions.server";
import { formatPaymentSchedule } from "@/orders/review-types";

export const Route = createFileRoute("/admin/memberships")({
  beforeLoad: async () => {
    const memberships = await fetchAdminMemberships();
    return { memberships };
  },
  head: () => ({
    meta: [{ title: "Memberships — GOFOFA Ops" }],
  }),
  component: AdminMembershipsPage,
});

function AdminMembershipsPage() {
  const { memberships: initialMemberships } = Route.useRouteContext();
  const updateFn = useServerFn(updateAdminCustomerProfile);
  const refreshFn = useServerFn(fetchAdminMemberships);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [message, setMessage] = useState<string | null>(null);

  async function setStatus(userId: string, membershipStatus: "active" | "paused" | "cancelled") {
    await updateFn({ data: { userId, membershipStatus } });
    setMessage("Membership updated.");
    setMemberships(await refreshFn());
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Memberships</h2>
        <p className="text-sm text-muted-foreground">
          Weekly or monthly pickup and payment cadence with plan type — item pricing still flows
          from the menu catalog at order time.
        </p>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active & paused members</CardTitle>
          <CardDescription>
            {memberships.length} membership(s) ·{" "}
            <Link to="/admin/customers" className="text-primary underline-offset-4 hover:underline">
              Manage customers
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Portion</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead className="w-[180px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No memberships yet. Create a customer with an active membership to start the
                    pilot.
                  </TableCell>
                </TableRow>
              ) : (
                memberships.map((member) => {
                  const label = member.name?.trim() || member.email;
                  return (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="font-medium">{label}</div>
                        {member.name ? (
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={membershipStatusBadgeVariant(member.membershipStatus)}>
                          {formatMembershipStatus(member.membershipStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {member.planName ?? "—"}
                        {member.mealsPerWeek ? (
                          <div className="text-xs text-muted-foreground">
                            {member.mealsPerWeek} meals/wk
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{member.portionDefault}</TableCell>
                      <TableCell className="text-sm">
                        {formatPaymentSchedule(member.paymentSchedule)}
                      </TableCell>
                      <TableCell>{member.pickupLabel ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.membershipStatus !== "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(member.userId, "active")}
                            >
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(member.userId, "paused")}
                            >
                              Pause
                            </Button>
                          )}
                        </div>
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
