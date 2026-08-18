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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveWeeklyOrder,
  fetchCustomerOrderReview,
  saveWeeklyOrderReview,
} from "@/orders/orders.functions.server";
import {
  centsToLabel,
  formatOrderStatus,
  formatPaymentSchedule,
  type WeeklyOrderReview,
} from "@/orders/review-types";

export const Route = createFileRoute("/account/orders/$orderId")({
  beforeLoad: async ({ context, location, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }

    const review = await fetchCustomerOrderReview({ data: { orderId: params.orderId } });
    if (!review) {
      throw redirect({ to: "/account" });
    }

    return { review };
  },
  head: () => ({
    meta: [{ title: "Review Weekly Order — GOFOFA" }],
  }),
  component: OrderReviewPage,
});

type LineDraft = {
  lineId: string;
  qty: number;
  substituteMenuItemId: string | null;
  substituteNote: string;
};

function OrderReviewPage() {
  const { review: initialReview } = Route.useRouteContext();
  const { orderId } = Route.useParams();
  const router = useRouter();
  const saveFn = useServerFn(saveWeeklyOrderReview);
  const approveFn = useServerFn(approveWeeklyOrder);

  const [review, setReview] = useState(initialReview);
  const [drafts, setDrafts] = useState<LineDraft[]>(() => buildDrafts(initialReview));
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const paymentSchedule = review.order.paymentScheduleSnapshot ?? review.paymentSchedule;
  const isDirty = useMemo(() => {
    const subs = drafts.filter(
      (d) => d.substituteMenuItemId && d.substituteMenuItemId !== lineMenuItemId(review, d.lineId),
    );
    const qtyChanges = drafts.some((d) => d.qty !== lineQty(review, d.lineId));
    return subs.length > 0 || qtyChanges || comment.trim().length > 0;
  }, [drafts, review, comment]);

  function updateDraft(lineId: string, patch: Partial<LineDraft>) {
    setDrafts((prev) => prev.map((d) => (d.lineId === lineId ? { ...d, ...patch } : d)));
    setSuccess(null);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const substitutions = drafts
        .filter(
          (d) =>
            d.substituteMenuItemId && d.substituteMenuItemId !== lineMenuItemId(review, d.lineId),
        )
        .map((d) => ({
          lineId: d.lineId,
          menuItemId: d.substituteMenuItemId!,
          note: d.substituteNote.trim() || undefined,
        }));

      const updated = await saveFn({
        data: {
          orderId,
          lines: drafts.map((d) => ({ lineId: d.lineId, qty: d.qty })),
          substitutions,
          comment: comment.trim() || undefined,
        },
      });

      setReview(updated);
      setDrafts(buildDrafts(updated));
      setComment("");
      setSuccess("Your changes were saved.");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setError(null);
    setSuccess(null);
    setApproving(true);
    try {
      if (isDirty) {
        const substitutions = drafts
          .filter(
            (d) =>
              d.substituteMenuItemId && d.substituteMenuItemId !== lineMenuItemId(review, d.lineId),
          )
          .map((d) => ({
            lineId: d.lineId,
            menuItemId: d.substituteMenuItemId!,
            note: d.substituteNote.trim() || undefined,
          }));

        const saved = await saveFn({
          data: {
            orderId,
            lines: drafts.map((d) => ({ lineId: d.lineId, qty: d.qty })),
            substitutions,
            comment: comment.trim() || undefined,
          },
        });
        setReview(saved);
        setDrafts(buildDrafts(saved));
        setComment("");
      }

      const updated = await approveFn({ data: { orderId } });
      setReview(updated);
      setDrafts(buildDrafts(updated));
      setSuccess("Order approved. Payment will be handled per your schedule (Stripe coming soon).");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve order.");
    } finally {
      setApproving(false);
    }
  }

  const draftTotalCents = drafts.reduce((sum, d) => {
    const line = review.lines.find((l) => l.id === d.lineId);
    if (!line) return sum;
    const menuItemId = d.substituteMenuItemId ?? line.menuItemId;
    const meal = review.availableMeals.find((m) => m.menuItemId === menuItemId);
    const unit = line.unitPriceCents;
    void meal;
    return sum + d.qty * unit;
  }, 0);

  return (
    <MemberLayout showBack backTo="/account" backLabel="Account">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Weekly order review</h1>
          <Badge variant={review.canEdit ? "default" : "secondary"}>
            {formatOrderStatus(review.order.status)}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Week of {formatWeek(review.batch.weekStart)}
          {review.batch.pickupDate ? ` · Pickup ${formatWeek(review.batch.pickupDate)}` : null}
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order details</CardTitle>
          <CardDescription>
            {review.pickupWindow
              ? `${review.pickupWindow.label} · ${review.pickupWindow.dayOfWeek} ${review.pickupWindow.timeRange}`
              : "Pickup window not assigned yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {review.order.receiptNumber ? (
            <p>
              <span className="text-muted-foreground">Receipt: </span>
              {review.order.receiptNumber}
            </p>
          ) : null}
          {review.order.externalOrderNumber ? (
            <p>
              <span className="text-muted-foreground">Order #: </span>
              {review.order.externalOrderNumber}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Payment schedule: </span>
            {formatPaymentSchedule(paymentSchedule)}
          </p>
          {review.batch.reviewDeadline ? (
            <p>
              <span className="text-muted-foreground">Review by: </span>
              {format(parseISO(review.batch.reviewDeadline), "EEE, MMM d · h:mm a")}
            </p>
          ) : null}
          {review.order.approvedAt ? (
            <p>
              <span className="text-muted-foreground">Approved: </span>
              {format(parseISO(review.order.approvedAt), "EEE, MMM d · h:mm a")}
            </p>
          ) : null}
          {review.editBlockedReason && !review.canEdit ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {review.editBlockedReason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {review.pendingRequests.length > 0 ? (
        <Card className="mt-4 border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-900">Pending kitchen requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-amber-950">
              {review.pendingRequests.map((req) => (
                <li key={req.id}>
                  {req.type === "substitution" ? "Substitution" : req.type}:{" "}
                  {req.requestedMenuItemName ?? "meal"} × {req.requestedQty}
                  {req.customerNote ? ` — ${req.customerNote}` : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Your meals</h2>
        <ul className="mt-3 space-y-4">
          {review.lines.map((line) => {
            const draft = drafts.find((d) => d.lineId === line.id);
            if (!draft) return null;

            return (
              <li key={line.id}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{line.menuItemName}</p>
                        {line.menuItemNote ? (
                          <p className="text-sm text-muted-foreground">{line.menuItemNote}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-muted-foreground">
                          {line.portion} · {centsToLabel(line.unitPriceCents)} each
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {centsToLabel(draft.qty * line.unitPriceCents)}
                      </span>
                    </div>

                    {review.canEdit ? (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-3">
                          <Label className="shrink-0 text-sm">Quantity</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9"
                              disabled={draft.qty <= 0}
                              onClick={() =>
                                updateDraft(line.id, { qty: Math.max(0, draft.qty - 1) })
                              }
                              aria-label="Decrease quantity"
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-8 text-center font-medium tabular-nums">
                              {draft.qty}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-9"
                              onClick={() => updateDraft(line.id, { qty: draft.qty + 1 })}
                              aria-label="Increase quantity"
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {review.availableMeals.length > 0 ? (
                          <div className="space-y-2">
                            <Label htmlFor={`sub-${line.id}`} className="text-sm">
                              Substitute meal
                            </Label>
                            <Select
                              value={draft.substituteMenuItemId ?? line.menuItemId}
                              onValueChange={(value) =>
                                updateDraft(line.id, {
                                  substituteMenuItemId: value === line.menuItemId ? null : value,
                                })
                              }
                            >
                              <SelectTrigger id={`sub-${line.id}`} className="min-h-11">
                                <SelectValue placeholder="Keep assigned meal" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={line.menuItemId}>
                                  Keep: {line.menuItemName}
                                </SelectItem>
                                {review.availableMeals
                                  .filter((m) => m.menuItemId !== line.menuItemId)
                                  .map((meal) => (
                                    <SelectItem key={meal.menuItemId} value={meal.menuItemId}>
                                      {meal.menuItemName} ({meal.qtyRemaining} left)
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {draft.substituteMenuItemId &&
                            draft.substituteMenuItemId !== line.menuItemId ? (
                              <Textarea
                                placeholder="Note for the kitchen (optional)"
                                value={draft.substituteNote}
                                onChange={(e) =>
                                  updateDraft(line.id, { substituteNote: e.target.value })
                                }
                                rows={2}
                                className="text-base"
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Qty: {line.qty}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {review.comments.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold tracking-tight">Your notes</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {review.comments.map((c) => (
              <li key={c.id} className="rounded-md border bg-muted/30 px-3 py-2">
                {c.body}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {review.canEdit ? (
        <div className="mt-6 space-y-2">
          <Label htmlFor="order-comment">Add a comment</Label>
          <Textarea
            id="order-comment"
            placeholder="Allergies, preferences, or questions for this week"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="text-base"
          />
        </div>
      ) : null}

      <Card className="mt-6">
        <CardContent className="space-y-2 pt-6 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">
              {review.canEdit ? "Estimated subtotal" : "Subtotal"}
            </span>
            <span className="tabular-nums">
              {centsToLabel(review.canEdit ? draftTotalCents : review.order.subtotalCents)}
            </span>
          </div>
          {review.order.taxCents > 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{centsToLabel(review.order.taxCents)}</span>
            </div>
          ) : null}
          {review.order.tipCents > 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Tip</span>
              <span className="tabular-nums">{centsToLabel(review.order.tipCents)}</span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between border-t pt-2 text-lg font-medium">
            <span>{review.canEdit ? "Estimated total" : "Total"}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {centsToLabel(
                review.canEdit
                  ? draftTotalCents + review.order.taxCents + review.order.tipCents
                  : review.order.totalCents,
              )}
            </span>
          </div>
        </CardContent>
        {paymentSchedule === "manual_per_order" ? (
          <CardContent className="pt-0 text-sm text-muted-foreground">
            You&apos;ll confirm payment when approving (Stripe checkout coming soon).
          </CardContent>
        ) : (
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Charged automatically per your {formatPaymentSchedule(paymentSchedule).toLowerCase()}{" "}
            schedule after approval.
          </CardContent>
        )}
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
        {review.canEdit ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving || !isDirty}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={approving || review.pendingRequests.length > 0}
              onClick={handleApprove}
            >
              {approving
                ? "Approving…"
                : paymentSchedule === "manual_per_order"
                  ? "Approve order"
                  : "Approve for payment"}
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

function buildDrafts(review: WeeklyOrderReview): LineDraft[] {
  return review.lines.map((line) => ({
    lineId: line.id,
    qty: line.qty,
    substituteMenuItemId: null,
    substituteNote: "",
  }));
}

function lineMenuItemId(review: WeeklyOrderReview, lineId: string): string | undefined {
  return review.lines.find((l) => l.id === lineId)?.menuItemId;
}

function lineQty(review: WeeklyOrderReview, lineId: string): number {
  return review.lines.find((l) => l.id === lineId)?.qty ?? 0;
}

function formatWeek(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}
