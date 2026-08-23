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
import type { PortionDefault } from "@/db/schema/customer-profiles";
import type { BillingProfile, MembershipStatus } from "@/db/schema/memberships";
import type { PaymentSchedule } from "@/db/schema/payment-schedules";
import type { AdminMembershipRow } from "@/orders/admin-types";
import {
  formatBillingProfile,
  formatBatchEligibility,
  formatMembershipStatus,
  membershipStatusBadgeVariant,
} from "@/orders/admin-types";
import { formatDateString } from "@/lib/dates";
import { customerDisplayLabel } from "@/lib/customer-names";
import {
  createAdminMembershipRecord,
  fetchAdminCustomers,
  fetchAdminMemberships,
  fetchAdminPlanCategories,
  updateAdminMembershipRecord,
} from "@/orders/admin.functions.server";
import { centsToLabel, formatPaymentSchedule } from "@/orders/review-types";

export const Route = createFileRoute("/admin/memberships")({
  beforeLoad: async () => {
    const [memberships, customers, planCategories] = await Promise.all([
      fetchAdminMemberships(),
      fetchAdminCustomers(),
      fetchAdminPlanCategories(),
    ]);
    return { memberships, customers, planCategories };
  },
  head: () => ({
    meta: [{ title: "Memberships — GOFOFA Ops" }],
  }),
  component: AdminMembershipsPage,
});

type MembershipFormData = {
  userId?: string;
  planSlug?: string;
  mealsPerWeek?: number;
  paymentSchedule: PaymentSchedule;
  portionDefault: PortionDefault;
  billingProfile: BillingProfile;
  fixedPricePerMealCents?: number;
  discountCents?: number;
  discountLabel?: string | null;
  weeklyInvoiceDay?: number | null;
  monthlyInvoiceDay?: number | null;
  biweeklyAnchorDate?: string | null;
  membershipStatus?: MembershipStatus;
  pausedUntil?: string | null;
};

function AdminMembershipsPage() {
  const { memberships: initialMemberships, customers, planCategories } = Route.useRouteContext();
  const createFn = useServerFn(createAdminMembershipRecord);
  const updateFn = useServerFn(updateAdminMembershipRecord);
  const refreshMembershipsFn = useServerFn(fetchAdminMemberships);

  const [memberships, setMemberships] = useState(initialMemberships);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMembership, setEditingMembership] = useState<AdminMembershipRow | null>(null);
  const [pausingMembershipId, setPausingMembershipId] = useState<string | null>(null);
  const [pauseUntilDate, setPauseUntilDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** All customer accounts — includes customers who already have one or more memberships. */
  const customerOptions = [...customers].sort((a, b) => {
    const labelA = (a.name?.trim() || a.email).toLowerCase();
    const labelB = (b.name?.trim() || b.email).toLowerCase();
    return labelA.localeCompare(labelB);
  });

  async function refreshMemberships() {
    setMemberships(await refreshMembershipsFn());
  }

  async function cancelMembership(membershipId: string) {
    setError(null);
    setMessage(null);
    try {
      await updateFn({
        data: { membershipId, membershipStatus: "cancelled", pausedUntil: null },
      });
      setMessage("Membership cancelled.");
      if (editingMembership?.membershipId === membershipId) {
        setEditingMembership(null);
      }
      if (pausingMembershipId === membershipId) {
        setPausingMembershipId(null);
        setPauseUntilDate("");
      }
      await refreshMemberships();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel membership.");
    }
  }

  async function resumeMembership(membershipId: string) {
    setError(null);
    setMessage(null);
    try {
      await updateFn({
        data: { membershipId, membershipStatus: "active", pausedUntil: null },
      });
      setMessage("Membership resumed.");
      if (editingMembership?.membershipId === membershipId) {
        setEditingMembership(null);
      }
      await refreshMemberships();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resume membership.");
    }
  }

  async function pauseMembership(membershipId: string) {
    setError(null);
    setMessage(null);
    try {
      await updateFn({
        data: {
          membershipId,
          membershipStatus: "paused",
          pausedUntil: pauseUntilDate.trim() || null,
        },
      });
      setMessage("Membership paused.");
      setPausingMembershipId(null);
      setPauseUntilDate("");
      await refreshMemberships();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pause membership.");
    }
  }

  function closeForms() {
    setShowAddForm(false);
    setEditingMembership(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Memberships</h2>
          <p className="text-sm text-muted-foreground">
            Assign plan and billing preferences per membership. Customers may have multiple active
            memberships when they need separate plans or billing setups; cancelled memberships
            remain in history.
          </p>
        </div>
        {!showAddForm && !editingMembership ? (
          <Button
            onClick={() => {
              setEditingMembership(null);
              setShowAddForm(true);
            }}
          >
            Add new membership
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {showAddForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add membership</CardTitle>
            <CardDescription>
              Select a customer and set plan details.{" "}
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
            <MembershipForm
              mode="add"
              customers={customerOptions}
              planCategories={planCategories}
              onCancel={closeForms}
              onSubmit={async (data) => {
                setError(null);
                setMessage(null);
                try {
                  await createFn({
                    data: {
                      userId: data.userId!,
                      planSlug: data.planSlug,
                      mealsPerWeek: data.mealsPerWeek,
                      paymentSchedule: data.paymentSchedule,
                      portionDefault: data.portionDefault,
                      billingProfile: data.billingProfile,
                      fixedPricePerMealCents: data.fixedPricePerMealCents,
                      discountCents: data.discountCents,
                      discountLabel: data.discountLabel ?? undefined,
                      weeklyInvoiceDay: data.weeklyInvoiceDay ?? undefined,
                      monthlyInvoiceDay: data.monthlyInvoiceDay ?? undefined,
                      biweeklyAnchorDate: data.biweeklyAnchorDate ?? undefined,
                    },
                  });
                  closeForms();
                  setMessage("Membership created.");
                  await refreshMemberships();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not create membership.");
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {editingMembership ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit membership</CardTitle>
            <CardDescription>
              Update plan, billing, and status for{" "}
              {editingMembership.name?.trim() || editingMembership.email}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembershipForm
              mode="edit"
              membership={editingMembership}
              planCategories={planCategories}
              onCancel={closeForms}
              onSubmit={async (data) => {
                setError(null);
                setMessage(null);
                try {
                  await updateFn({
                    data: {
                      membershipId: editingMembership.membershipId,
                      membershipStatus: data.membershipStatus,
                      pausedUntil:
                        data.membershipStatus === "paused"
                          ? (data.pausedUntil ?? null)
                          : data.membershipStatus === "active" ||
                              data.membershipStatus === "cancelled"
                            ? null
                            : undefined,
                      planSlug: data.planSlug || null,
                      mealsPerWeek: data.mealsPerWeek ?? null,
                      paymentSchedule: data.paymentSchedule,
                      portionDefault: data.portionDefault,
                      billingProfile: data.billingProfile,
                      fixedPricePerMealCents: data.fixedPricePerMealCents ?? null,
                      discountCents: data.discountCents,
                      discountLabel: data.discountLabel ?? null,
                      weeklyInvoiceDay: data.weeklyInvoiceDay ?? null,
                      monthlyInvoiceDay: data.monthlyInvoiceDay ?? null,
                      biweeklyAnchorDate: data.biweeklyAnchorDate ?? null,
                    },
                  });
                  closeForms();
                  setMessage("Membership updated.");
                  await refreshMemberships();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not update membership.");
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All memberships</CardTitle>
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
                <TableHead>Plan type</TableHead>
                <TableHead>Portion</TableHead>
                <TableHead>Invoice frequency</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Batch eligibility</TableHead>
                <TableHead>Paused until</TableHead>
                <TableHead className="w-[240px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No memberships yet — add a membership for an existing customer to start the
                    pilot.
                  </TableCell>
                </TableRow>
              ) : (
                memberships.map((member) => {
                  const label = member.name?.trim() || member.email;
                  const invoiceTiming = formatInvoiceTiming(member);
                  const isEditing = editingMembership?.membershipId === member.membershipId;
                  const pausePeriodEnded =
                    member.membershipStatus === "paused" && isPastPauseDate(member.pausedUntil);
                  return (
                    <TableRow
                      key={member.membershipId}
                      data-state={isEditing ? "selected" : undefined}
                    >
                      <TableCell>
                        <div className="font-medium">{label}</div>
                        {member.name ? (
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={membershipStatusBadgeVariant(member.membershipStatus)}>
                          {formatMembershipStatus(member.membershipStatus, member.pausedUntil)}
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
                        {invoiceTiming ? (
                          <div className="text-xs text-muted-foreground">{invoiceTiming}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatBillingProfile(member.billingProfile)}
                        {member.billingProfile === "fixed_price" &&
                        member.fixedPricePerMealCents != null ? (
                          <div className="text-xs text-muted-foreground">
                            {centsToLabel(member.fixedPricePerMealCents)}/meal
                            {member.discountCents > 0
                              ? ` · ${centsToLabel(member.discountCents)} off${member.discountLabel ? ` (${member.discountLabel})` : ""}`
                              : ""}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.batchEligible ? "default" : "secondary"}>
                          {formatBatchEligibility(member.batchEligible)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.membershipStatus === "paused" ? (
                          <>
                            {member.pausedUntil
                              ? formatDateString(member.pausedUntil, "MMM d, yyyy")
                              : "Indefinite"}
                            {pausePeriodEnded ? (
                              <div className="text-xs text-destructive">
                                Pause period ended — resume required
                              </div>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowAddForm(false);
                                setPausingMembershipId(null);
                                setPauseUntilDate("");
                                setEditingMembership(member);
                                setError(null);
                                setMessage(null);
                              }}
                            >
                              Edit
                            </Button>
                            {member.membershipStatus === "paused" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resumeMembership(member.membershipId)}
                              >
                                Resume
                              </Button>
                            ) : null}
                            {member.membershipStatus === "active" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPausingMembershipId(
                                    pausingMembershipId === member.membershipId
                                      ? null
                                      : member.membershipId,
                                  );
                                  setPauseUntilDate("");
                                  setError(null);
                                  setMessage(null);
                                }}
                              >
                                {pausingMembershipId === member.membershipId ? "Close" : "Pause"}
                              </Button>
                            ) : null}
                            {member.membershipStatus !== "cancelled" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelMembership(member.membershipId)}
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </div>
                          {pausingMembershipId === member.membershipId ? (
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="space-y-1">
                                <Label htmlFor={`pause-until-${member.membershipId}`}>
                                  Pause until (optional)
                                </Label>
                                <Input
                                  id={`pause-until-${member.membershipId}`}
                                  type="date"
                                  value={pauseUntilDate}
                                  onChange={(e) => setPauseUntilDate(e.target.value)}
                                />
                              </div>
                              <Button
                                size="sm"
                                onClick={() => pauseMembership(member.membershipId)}
                              >
                                Confirm pause
                              </Button>
                            </div>
                          ) : null}
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

function parseDollarInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

function centsToDollarInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function isPastPauseDate(pausedUntil: string | null): boolean {
  if (!pausedUntil) return false;
  return pausedUntil < new Date().toISOString().slice(0, 10);
}

const invoiceDayLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatInvoiceTiming(member: AdminMembershipRow): string | null {
  if (member.paymentSchedule === "weekly_autopay" && member.weeklyInvoiceDay != null) {
    return `Invoices every ${invoiceDayLabels[member.weeklyInvoiceDay] ?? "selected day"}`;
  }
  if (member.paymentSchedule === "monthly_autopay" && member.monthlyInvoiceDay != null) {
    return `Invoices on day ${member.monthlyInvoiceDay}`;
  }
  if (member.biweeklyAnchorDate) {
    return `Anchor ${formatDateString(member.biweeklyAnchorDate, "MMM d, yyyy")}`;
  }
  return null;
}

function MembershipForm({
  mode,
  customers,
  membership,
  planCategories,
  onCancel,
  onSubmit,
}: {
  mode: "add" | "edit";
  customers?: Array<{
    userId: string;
    email: string;
    name: string | null;
  }>;
  membership?: AdminMembershipRow;
  planCategories: Array<{ slug: string; name: string }>;
  onCancel: () => void;
  onSubmit: (data: MembershipFormData) => Promise<void>;
}) {
  const [userId, setUserId] = useState(membership?.userId ?? "");
  const [planSlug, setPlanSlug] = useState(membership?.planSlug ?? "");
  const [mealsPerWeek, setMealsPerWeek] = useState(
    membership?.mealsPerWeek != null ? String(membership.mealsPerWeek) : "",
  );
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule>(
    membership?.paymentSchedule ?? "weekly_autopay",
  );
  const [portionDefault, setPortionDefault] = useState<PortionDefault>(
    membership?.portionDefault ?? "6oz",
  );
  const [billingProfile, setBillingProfile] = useState<BillingProfile>(
    membership?.billingProfile ?? "catalog",
  );
  const [fixedPricePerMeal, setFixedPricePerMeal] = useState(
    centsToDollarInput(membership?.fixedPricePerMealCents),
  );
  const [discountAmount, setDiscountAmount] = useState(
    centsToDollarInput(membership?.discountCents ?? 0),
  );
  const [discountLabel, setDiscountLabel] = useState(membership?.discountLabel ?? "");
  const [weeklyInvoiceDay, setWeeklyInvoiceDay] = useState(
    membership?.weeklyInvoiceDay != null ? String(membership.weeklyInvoiceDay) : "",
  );
  const [monthlyInvoiceDay, setMonthlyInvoiceDay] = useState(
    membership?.monthlyInvoiceDay != null ? String(membership.monthlyInvoiceDay) : "",
  );
  const [biweeklyAnchorDate, setBiweeklyAnchorDate] = useState(
    membership?.biweeklyAnchorDate ?? "",
  );
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(
    membership?.membershipStatus ?? "active",
  );
  const [pausedUntil, setPausedUntil] = useState(membership?.pausedUntil ?? "");
  const [saving, setSaving] = useState(false);

  const fixedPriceCents = parseDollarInput(fixedPricePerMeal);
  const discountCents = parseDollarInput(discountAmount) ?? 0;
  const parsedWeeklyInvoiceDay = weeklyInvoiceDay ? Number(weeklyInvoiceDay) : null;
  const parsedMonthlyInvoiceDay = monthlyInvoiceDay ? Number(monthlyInvoiceDay) : null;
  const fixedPriceRequired =
    billingProfile === "fixed_price" && (fixedPriceCents == null || fixedPriceCents <= 0);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if ((mode === "add" && !userId) || fixedPriceRequired) return;
        setSaving(true);
        try {
          await onSubmit({
            userId: mode === "add" ? userId : undefined,
            planSlug: planSlug || undefined,
            mealsPerWeek: mealsPerWeek ? Number(mealsPerWeek) : undefined,
            paymentSchedule,
            portionDefault,
            billingProfile,
            fixedPricePerMealCents: billingProfile === "fixed_price" ? fixedPriceCents : undefined,
            discountCents: billingProfile === "fixed_price" ? discountCents : undefined,
            discountLabel:
              billingProfile === "fixed_price" && discountCents > 0
                ? discountLabel.trim() || null
                : null,
            weeklyInvoiceDay: paymentSchedule === "weekly_autopay" ? parsedWeeklyInvoiceDay : null,
            monthlyInvoiceDay:
              paymentSchedule === "monthly_autopay" ? parsedMonthlyInvoiceDay : null,
            biweeklyAnchorDate: biweeklyAnchorDate.trim() || null,
            membershipStatus: mode === "edit" ? membershipStatus : undefined,
            pausedUntil:
              mode === "edit" && membershipStatus === "paused"
                ? pausedUntil.trim() || null
                : mode === "edit" &&
                    (membershipStatus === "active" || membershipStatus === "cancelled")
                  ? null
                  : undefined,
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      {mode === "add" ? (
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
              {customers?.length === 0 ? (
                <SelectItem value="empty" disabled>
                  No customers yet
                </SelectItem>
              ) : (
                customers?.map((customer) => {
                  const label = customerDisplayLabel(customer);
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
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="membership-plan">Plan Type</Label>
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
        <Label htmlFor="membership-meals">Meals Per Week</Label>
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
        <Label htmlFor="membership-portion">Portion Size</Label>
        <Select
          value={portionDefault}
          onValueChange={(v) => setPortionDefault(v as PortionDefault)}
        >
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
        <Label htmlFor="membership-payment">Invoice Frequency</Label>
        <Select
          value={paymentSchedule}
          onValueChange={(v) => {
            const next = v as PaymentSchedule;
            setPaymentSchedule(next);
            if (next !== "weekly_autopay") setWeeklyInvoiceDay("");
            if (next !== "monthly_autopay") setMonthlyInvoiceDay("");
          }}
        >
          <SelectTrigger id="membership-payment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly_autopay">Weekly</SelectItem>
            <SelectItem value="monthly_autopay">Monthly</SelectItem>
            <SelectItem value="manual_per_order">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {paymentSchedule === "weekly_autopay" ? (
        <div className="space-y-2">
          <Label htmlFor="membership-weekly-day">Weekly invoice day</Label>
          <Select
            value={weeklyInvoiceDay || "none"}
            onValueChange={(v) => setWeeklyInvoiceDay(v === "none" ? "" : v)}
          >
            <SelectTrigger id="membership-weekly-day">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Use default batch timing</SelectItem>
              {invoiceDayLabels.map((day, index) => (
                <SelectItem key={day} value={String(index)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {paymentSchedule === "monthly_autopay" ? (
        <div className="space-y-2">
          <Label htmlFor="membership-monthly-day">Monthly invoice day</Label>
          <Input
            id="membership-monthly-day"
            type="number"
            min={1}
            max={28}
            value={monthlyInvoiceDay}
            onChange={(e) => setMonthlyInvoiceDay(e.target.value)}
            placeholder="1-28"
          />
          <p className="text-xs text-muted-foreground">
            Limited to days 1–28 so every month is valid.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="membership-billing-anchor">Billing anchor date</Label>
        <Input
          id="membership-billing-anchor"
          type="date"
          value={biweeklyAnchorDate}
          onChange={(e) => setBiweeklyAnchorDate(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Optional planning anchor for manual/biweekly follow-up billing.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="membership-billing-profile">Billing Profile</Label>
        <Select
          value={billingProfile}
          onValueChange={(v) => setBillingProfile(v as BillingProfile)}
        >
          <SelectTrigger id="membership-billing-profile">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="catalog">Catalog (menu pricing)</SelectItem>
            <SelectItem value="fixed_price">Fixed price meals</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {billingProfile === "fixed_price" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="membership-fixed-price">Amount Per Meal</Label>
            <Input
              id="membership-fixed-price"
              type="number"
              min={0}
              step={0.01}
              value={fixedPricePerMeal}
              onChange={(e) => setFixedPricePerMeal(e.target.value)}
              placeholder="4.50"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="membership-discount">Discount Amount</Label>
            <Input
              id="membership-discount"
              type="number"
              min={0}
              step={0.01}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="membership-discount-label">Discount title</Label>
            <Input
              id="membership-discount-label"
              value={discountLabel}
              onChange={(e) => setDiscountLabel(e.target.value)}
              placeholder="Senior dinner discount"
              maxLength={120}
            />
          </div>
        </>
      ) : null}
      {mode === "edit" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="membership-status">Status</Label>
            <Select
              value={membershipStatus}
              onValueChange={(v) => {
                const next = v as MembershipStatus;
                setMembershipStatus(next);
                if (next === "active" || next === "cancelled") {
                  setPausedUntil("");
                }
              }}
            >
              <SelectTrigger id="membership-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {membershipStatus === "paused" ? (
            <div className="space-y-2">
              <Label htmlFor="membership-paused-until">Paused until (optional)</Label>
              <Input
                id="membership-paused-until"
                type="date"
                value={pausedUntil}
                onChange={(e) => setPausedUntil(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for an indefinite pause. Past dates are not allowed.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
        <Button
          type="submit"
          disabled={
            saving || (mode === "add" && (!userId || customers?.length === 0)) || fixedPriceRequired
          }
        >
          {saving
            ? mode === "add"
              ? "Creating…"
              : "Saving…"
            : mode === "add"
              ? "Create membership"
              : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
