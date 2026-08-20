import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatMembershipStatus, membershipStatusBadgeVariant } from "@/orders/admin-types";
import {
  fetchAdminCustomers,
  fetchAdminMemberships,
  fetchAdminPickupWindows,
  fetchAdminPlanCategories,
  updateAdminCustomerProfile,
} from "@/orders/admin.functions.server";
import { formatPaymentSchedule } from "@/orders/review-types";

export const Route = createFileRoute("/admin/memberships")({
  beforeLoad: async () => {
    const [memberships, customers, planCategories, pickupWindows] = await Promise.all([
      fetchAdminMemberships(),
      fetchAdminCustomers(),
      fetchAdminPlanCategories(),
      fetchAdminPickupWindows(),
    ]);
    return { memberships, customers, planCategories, pickupWindows };
  },
  head: () => ({
    meta: [{ title: "Memberships — GOFOFA Ops" }],
  }),
  component: AdminMembershipsPage,
});

function AdminMembershipsPage() {
  const {
    memberships: initialMemberships,
    customers,
    planCategories,
    pickupWindows,
  } = Route.useRouteContext();
  const updateFn = useServerFn(updateAdminCustomerProfile);
  const refreshMembershipsFn = useServerFn(fetchAdminMemberships);
  const refreshCustomersFn = useServerFn(fetchAdminCustomers);

  const [memberships, setMemberships] = useState(initialMemberships);
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customersWithoutMembership = customerOptions.filter(
    (c) => !c.membershipId || c.membershipStatus === "cancelled",
  );

  async function setStatus(userId: string, membershipStatus: "active" | "paused" | "cancelled") {
    await updateFn({ data: { userId, membershipStatus } });
    setMessage("Membership updated.");
    setMemberships(await refreshMembershipsFn());
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Memberships</h2>
          <p className="text-sm text-muted-foreground">
            Link an existing customer to a plan and pickup cadence. Item pricing still flows from
            the menu catalog at order time.
          </p>
        </div>
        {!showAddForm ? <Button onClick={() => setShowAddForm(true)}>Add membership</Button> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add membership</CardTitle>
            <CardDescription>
              Select an existing customer and assign plan preferences.{" "}
              <Link
                to="/admin/customers"
                className="text-primary underline-offset-4 hover:underline"
              >
                Create a customer
              </Link>{" "}
              first if they are not listed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddMembershipForm
              customers={customersWithoutMembership}
              planCategories={planCategories}
              pickupWindows={pickupWindows}
              onCancel={() => setShowAddForm(false)}
              onSubmit={async (data) => {
                setError(null);
                setMessage(null);
                try {
                  await updateFn({ data });
                  setShowAddForm(false);
                  setMessage("Membership created.");
                  setMemberships(await refreshMembershipsFn());
                  setCustomerOptions(await refreshCustomersFn());
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not create membership.");
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}

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
                    No memberships yet — add a membership for an existing customer to start the
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

function AddMembershipForm({
  customers,
  planCategories,
  pickupWindows,
  onCancel,
  onSubmit,
}: {
  customers: Array<{
    userId: string;
    email: string;
    name: string | null;
    membershipStatus: string | null;
  }>;
  planCategories: Array<{ slug: string; name: string }>;
  pickupWindows: Array<{ id: string; label: string }>;
  onCancel: () => void;
  onSubmit: (data: {
    userId: string;
    membershipStatus: "active";
    planSlug?: string;
    mealsPerWeek?: number;
    paymentSchedule?: "weekly_autopay" | "monthly_autopay" | "manual_per_order";
    portionDefault?: "4oz" | "6oz";
    defaultPickupWindowId?: string;
  }) => Promise<void>;
}) {
  const [userId, setUserId] = useState("");
  const [planSlug, setPlanSlug] = useState("");
  const [mealsPerWeek, setMealsPerWeek] = useState("");
  const [paymentSchedule, setPaymentSchedule] = useState("weekly_autopay");
  const [portionDefault, setPortionDefault] = useState<"4oz" | "6oz">("6oz");
  const [pickupWindowId, setPickupWindowId] = useState(pickupWindows[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!userId) return;
        setSaving(true);
        try {
          await onSubmit({
            userId,
            membershipStatus: "active",
            planSlug: planSlug || undefined,
            mealsPerWeek: mealsPerWeek ? Number(mealsPerWeek) : undefined,
            paymentSchedule: paymentSchedule as
              "weekly_autopay" | "monthly_autopay" | "manual_per_order",
            portionDefault,
            defaultPickupWindowId: pickupWindowId || undefined,
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="membership-customer">Customer</Label>
        <Select value={userId || "none"} onValueChange={(v) => setUserId(v === "none" ? "" : v)}>
          <SelectTrigger id="membership-customer">
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>
              Select customer
            </SelectItem>
            {customers.length === 0 ? (
              <SelectItem value="empty" disabled>
                No customers without membership
              </SelectItem>
            ) : (
              customers.map((customer) => {
                const label = customer.name?.trim() || customer.email;
                return (
                  <SelectItem key={customer.userId} value={customer.userId}>
                    {label} ({customer.email})
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="membership-plan">Plan type</Label>
        <Select
          value={planSlug || "none"}
          onValueChange={(v) => setPlanSlug(v === "none" ? "" : v)}
        >
          <SelectTrigger id="membership-plan">
            <SelectValue placeholder="Select plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not set</SelectItem>
            {planCategories.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="membership-meals">Meals per week</Label>
        <Input
          id="membership-meals"
          type="number"
          min={1}
          max={56}
          value={mealsPerWeek}
          onChange={(e) => setMealsPerWeek(e.target.value)}
          placeholder="14"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="membership-portion">Default portion</Label>
        <Select value={portionDefault} onValueChange={(v) => setPortionDefault(v as "4oz" | "6oz")}>
          <SelectTrigger id="membership-portion">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4oz">4 oz</SelectItem>
            <SelectItem value="6oz">6 oz</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="membership-payment">Payment cadence</Label>
        <Select value={paymentSchedule} onValueChange={setPaymentSchedule}>
          <SelectTrigger id="membership-payment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly_autopay">Weekly autopay</SelectItem>
            <SelectItem value="monthly_autopay">Monthly autopay</SelectItem>
            <SelectItem value="manual_per_order">Manual per order</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {pickupWindows.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="membership-pickup">Default pickup</Label>
          <Select value={pickupWindowId} onValueChange={setPickupWindowId}>
            <SelectTrigger id="membership-pickup">
              <SelectValue placeholder="Pickup window" />
            </SelectTrigger>
            <SelectContent>
              {pickupWindows.map((pw) => (
                <SelectItem key={pw.id} value={pw.id}>
                  {pw.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={saving || !userId || customers.length === 0}>
          {saving ? "Creating…" : "Create membership"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
