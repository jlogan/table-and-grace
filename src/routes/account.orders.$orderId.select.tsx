import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { MemberLayout } from "@/components/gofofa/MemberLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  fetchCustomerOrderSelection,
  saveWeeklyOrderSelection,
  submitWeeklyOrderSelection,
} from "@/orders/orders.functions.server";
import { centsToLabel, formatOrderStatus } from "@/orders/review-types";
import { isSelectableOrderStatus, type WeeklyOrderSelection } from "@/orders/selection-types";

export const Route = createFileRoute("/account/orders/$orderId/select")({
  beforeLoad: async ({ context, location, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }

    const selection = await fetchCustomerOrderSelection({ data: { orderId: params.orderId } });
    if (!selection) {
      throw redirect({ to: "/account" });
    }

    if (
      selection.order.status === "pending_customer_review" ||
      selection.order.status === "changes_requested"
    ) {
      throw redirect({
        to: "/account/orders/$orderId",
        params: { orderId: params.orderId },
      });
    }

    return { selection };
  },
  head: () => ({
    meta: [{ title: "Choose Weekly Meals — GOFOFA" }],
  }),
  component: OrderSelectionPage,
});

type PickDraft = {
  menuItemId: string;
  qty: number;
};

function OrderSelectionPage() {
  const { selection: initialSelection } = Route.useRouteContext();
  const { orderId } = Route.useParams();
  const router = useRouter();
  const saveFn = useServerFn(saveWeeklyOrderSelection);
  const submitFn = useServerFn(submitWeeklyOrderSelection);

  const [selection, setSelection] = useState(initialSelection);
  const [drafts, setDrafts] = useState<PickDraft[]>(() => buildDrafts(initialSelection));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mealsSelected = useMemo(() => drafts.reduce((sum, d) => sum + d.qty, 0), [drafts]);
  const mealsRemaining = selection.order.mealsAllowed - mealsSelected;

  const isDirty = useMemo(() => {
    return drafts.some((draft) => draft.qty !== lineQty(selection, draft.menuItemId));
  }, [drafts, selection]);

  const canSubmitNow =
    selection.canSubmit &&
    mealsSelected === selection.order.mealsAllowed &&
    isSelectableOrderStatus(selection.order.status);

  function updateQty(menuItemId: string, nextQty: number) {
    setDrafts((prev) =>
      prev.map((d) => (d.menuItemId === menuItemId ? { ...d, qty: Math.max(0, nextQty) } : d)),
    );
    setSuccess(null);
  }

  function buildPicks(): PickDraft[] {
    return drafts.filter((d) => d.qty > 0);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updated = await saveFn({
        data: {
          orderId,
          picks: buildPicks(),
        },
      });
      setSelection(updated);
      setDrafts(buildDrafts(updated));
      setSuccess("Your meal picks were saved.");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save meal picks.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const updated = await submitFn({
        data: {
          orderId,
          picks: buildPicks(),
        },
      });
      setSelection(updated);
      setDrafts(buildDrafts(updated));
      setSuccess("Meal selection submitted. Chef Margaux will finalize your order.");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit meal selection.");
    } finally {
      setSubmitting(false);
    }
  }

  const draftSubtotalCents = drafts.reduce((sum, draft) => {
    const meal = selection.menuMeals.find((m) => m.menuItemId === draft.menuItemId);
    if (!meal) return sum;
    return sum + draft.qty * meal.unitPriceCents;
  }, 0);

  return (
    <MemberLayout showBack backTo="/account" backLabel="Account">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Choose your meals</h1>
          <Badge variant={selection.canEdit ? "default" : "secondary"}>
            {formatOrderStatus(selection.order.status)}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Week of {formatWeek(selection.batch.weekStart)}
          {selection.batch.pickupDate
            ? ` · Pickup ${formatWeek(selection.batch.pickupDate)}`
            : null}
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your plan</CardTitle>
          <CardDescription>
            {selection.pickupWindow
              ? `${selection.pickupWindow.label} · ${selection.pickupWindow.dayOfWeek} ${selection.pickupWindow.timeRange}`
              : "Pickup window not assigned yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {selection.order.planName ? (
            <p>
              <span className="text-muted-foreground">Plan: </span>
              {selection.order.planName}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Meals allowed: </span>
            {selection.order.mealsAllowed} × {selection.order.portion}
          </p>
          {selection.batch.selectionDeadline ? (
            <p>
              <span className="text-muted-foreground">Select by: </span>
              {format(parseISO(selection.batch.selectionDeadline), "EEE, MMM d · h:mm a")}
            </p>
          ) : null}
          {selection.order.selectionSubmittedAt ? (
            <p>
              <span className="text-muted-foreground">Submitted: </span>
              {format(parseISO(selection.order.selectionSubmittedAt), "EEE, MMM d · h:mm a")}
            </p>
          ) : null}
          {selection.editBlockedReason && !selection.canEdit ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {selection.editBlockedReason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4 border-primary/30 bg-primary/5">
        <CardContent className="space-y-1 pt-6 text-sm">
          <p>
            <span className="text-muted-foreground">Meals selected: </span>
            {mealsSelected}
          </p>
          <p>
            <span className="text-muted-foreground">Meals remaining: </span>
            {mealsRemaining}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4 border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6 text-sm text-amber-950">
          <p className="font-medium">Allergy &amp; safety notice</p>
          <p className="mt-1">
            If you have food allergies or dietary restrictions, please review each menu item
            carefully. Contact us with any safety questions before submitting.
          </p>
        </CardContent>
      </Card>

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">This week&apos;s menu</h2>
        <ul className="mt-3 space-y-4">
          {selection.menuMeals.map((meal) => {
            const draft = drafts.find((d) => d.menuItemId === meal.menuItemId);
            const qty = draft?.qty ?? 0;

            return (
              <li key={meal.menuItemId}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{meal.menuItemName}</p>
                        {meal.menuItemNote ? (
                          <p className="text-sm text-muted-foreground">{meal.menuItemNote}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selection.order.portion} · {centsToLabel(meal.unitPriceCents)} each
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {centsToLabel(qty * meal.unitPriceCents)}
                      </span>
                    </div>

                    {selection.canEdit ? (
                      <div className="mt-4 flex items-center gap-3">
                        <Label className="shrink-0 text-sm">Quantity</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9"
                            disabled={qty <= 0}
                            onClick={() => updateQty(meal.menuItemId, qty - 1)}
                            aria-label={`Decrease ${meal.menuItemName}`}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="w-8 text-center font-medium tabular-nums">{qty}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9"
                            disabled={mealsRemaining <= 0}
                            onClick={() => updateQty(meal.menuItemId, qty + 1)}
                            aria-label={`Increase ${meal.menuItemName}`}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ) : qty > 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">Qty: {qty}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <Card className="mt-6">
        <CardContent className="space-y-2 pt-6 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">
              {selection.canEdit ? "Estimated subtotal" : "Subtotal"}
            </span>
            <span className="tabular-nums">
              {centsToLabel(selection.canEdit ? draftSubtotalCents : selection.order.subtotalCents)}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t pt-2 text-lg font-medium">
            <span>{selection.canEdit ? "Estimated total" : "Total"}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {centsToLabel(
                selection.canEdit
                  ? draftSubtotalCents + selection.order.taxCents
                  : selection.order.totalCents,
              )}
            </span>
          </div>
        </CardContent>
        {selection.canEdit ? (
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Save anytime and come back before the deadline. Submit when you&apos;ve chosen all{" "}
            {selection.order.mealsAllowed} meals.
          </CardContent>
        ) : null}
      </Card>

      {error ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {success}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {selection.canEdit ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving || !isDirty}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save progress"}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={submitting || !canSubmitNow}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting…" : "Submit selections"}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" className="min-h-11 sm:col-span-2" asChild>
            <Link to="/account">Back to account</Link>
          </Button>
        )}
      </div>
    </MemberLayout>
  );
}

function buildDrafts(selection: WeeklyOrderSelection): PickDraft[] {
  const byMenuItem = new Map(selection.lines.map((line) => [line.menuItemId, line.qty]));
  return selection.menuMeals.map((meal) => ({
    menuItemId: meal.menuItemId,
    qty: byMenuItem.get(meal.menuItemId) ?? 0,
  }));
}

function lineQty(selection: WeeklyOrderSelection, menuItemId: string): number {
  return selection.lines.find((line) => line.menuItemId === menuItemId)?.qty ?? 0;
}

function formatWeek(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}
