import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { AuthError } from "@/auth/user.server";
import type { PaymentSchedule } from "@/db/schema/payment-schedules.ts";
import type { CustomerOrderSummary, WeeklyOrderReview } from "@/orders/review-types.ts";
import { resolveOrderPaymentSchedule } from "@/orders/payment-schedule.ts";
export type { CustomerOrderSummary, WeeklyOrderReview } from "@/orders/review-types.ts";
export { centsToLabel, formatOrderStatus, formatPaymentSchedule } from "@/orders/review-types.ts";

import { getDb } from "./index.server.ts";
import { batchItems } from "./schema/batch-items.ts";
import { customerProfiles } from "./schema/customer-profiles.ts";
import { memberships } from "./schema/memberships.ts";
import { menuItems } from "./schema/menu-items.ts";
import { orderComments } from "./schema/order-comments.ts";
import { orderLineRequests } from "./schema/order-line-requests.ts";
import { orderLines, type Portion } from "./schema/order-lines.ts";
import { pickupWindows } from "./schema/pickup-windows.ts";
import { planCategories } from "./schema/plan-categories.ts";
import { weeklyBatches } from "./schema/weekly-batches.ts";
import {
  orderStatuses,
  weeklyOrders,
  type OrderStatus,
  type WeeklyOrder,
} from "./schema/weekly-orders.ts";

const EDITABLE_ORDER_STATUSES: OrderStatus[] = ["pending_customer_review", "changes_requested"];

export type SaveReviewChangesInput = {
  orderId: string;
  userId: string;
  lines: Array<{ lineId: string; qty: number }>;
  substitutions: Array<{ lineId: string; menuItemId: string; note?: string }>;
  comment?: string;
};

function resolveUnitPriceCents(
  item: { price4ozCents: number | null; price6ozCents: number | null },
  category: { price4ozCents: number; price6ozCents: number } | null,
  portion: Portion,
): number {
  if (portion === "4oz") {
    return item.price4ozCents ?? category?.price4ozCents ?? 0;
  }
  return item.price6ozCents ?? category?.price6ozCents ?? 0;
}

function isBeforeReviewDeadline(reviewDeadline: Date | null): boolean {
  if (!reviewDeadline) return true;
  return Date.now() < reviewDeadline.getTime();
}

function assertOrderOwner(order: WeeklyOrder, userId: string): void {
  if (order.userId !== userId) {
    throw new AuthError("Order not found", "FORBIDDEN");
  }
}

export function getOrderEditState(
  orderStatus: OrderStatus,
  reviewDeadline: Date | null,
): { canEdit: boolean; canApprove: boolean; editBlockedReason: string | null } {
  const statusAllowed = EDITABLE_ORDER_STATUSES.includes(orderStatus);
  const beforeDeadline = isBeforeReviewDeadline(reviewDeadline);

  if (!statusAllowed) {
    return {
      canEdit: false,
      canApprove: false,
      editBlockedReason: "This order is no longer open for review.",
    };
  }

  if (!beforeDeadline) {
    return {
      canEdit: false,
      canApprove: false,
      editBlockedReason: "The review deadline has passed.",
    };
  }

  return { canEdit: true, canApprove: true, editBlockedReason: null };
}

async function loadOrderOwnedByUser(orderId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      order: weeklyOrders,
      batch: weeklyBatches,
    })
    .from(weeklyOrders)
    .innerJoin(weeklyBatches, eq(weeklyOrders.batchId, weeklyBatches.id))
    .where(eq(weeklyOrders.id, orderId))
    .limit(1);

  if (!row) {
    throw new AuthError("Order not found", "FORBIDDEN");
  }

  assertOrderOwner(row.order, userId);
  return row;
}

async function loadOrderMembershipContext(membershipId: string | null): Promise<{
  membershipPaymentSchedule: PaymentSchedule | null;
  planSlug: string | null;
  planName: string | null;
}> {
  if (!membershipId) {
    return { membershipPaymentSchedule: null, planSlug: null, planName: null };
  }

  const db = getDb();
  const [row] = await db
    .select({
      paymentSchedule: memberships.paymentSchedule,
      planSlug: memberships.planSlug,
      planName: planCategories.name,
    })
    .from(memberships)
    .leftJoin(planCategories, eq(memberships.planSlug, planCategories.slug))
    .where(eq(memberships.id, membershipId))
    .limit(1);

  if (!row) {
    return { membershipPaymentSchedule: null, planSlug: null, planName: null };
  }

  const planSlug = row.planSlug ?? null;
  return {
    membershipPaymentSchedule: row.paymentSchedule,
    planSlug,
    planName: planSlug ? (row.planName ?? planSlug) : null,
  };
}

async function recalculateOrderTotals(orderId: string): Promise<void> {
  const db = getDb();
  const lines = await db
    .select({
      qty: orderLines.qty,
      unitPriceCents: orderLines.unitPriceCents,
    })
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId));

  const subtotalCents = lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
  const taxCents = 0;
  const totalCents = subtotalCents + taxCents;

  await db
    .update(weeklyOrders)
    .set({ subtotalCents, taxCents, totalCents })
    .where(eq(weeklyOrders.id, orderId));
}

/** Recent weekly orders for the member account dashboard. */
export async function listCustomerOrderSummaries(userId: string): Promise<CustomerOrderSummary[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: weeklyOrders.id,
      status: weeklyOrders.status,
      totalCents: weeklyOrders.totalCents,
      tipCents: weeklyOrders.tipCents,
      receiptNumber: weeklyOrders.receiptNumber,
      externalOrderNumber: weeklyOrders.externalOrderNumber,
      batchWeekStart: weeklyBatches.weekStart,
      reviewDeadline: weeklyBatches.reviewDeadline,
      pickupLabel: pickupWindows.label,
      membershipId: weeklyOrders.membershipId,
      planSlug: memberships.planSlug,
      planName: planCategories.name,
      itemCount: sql<number>`coalesce(sum(${orderLines.qty}), 0)`.mapWith(Number),
    })
    .from(weeklyOrders)
    .innerJoin(weeklyBatches, eq(weeklyOrders.batchId, weeklyBatches.id))
    .leftJoin(pickupWindows, eq(weeklyOrders.pickupWindowId, pickupWindows.id))
    .leftJoin(memberships, eq(weeklyOrders.membershipId, memberships.id))
    .leftJoin(planCategories, eq(memberships.planSlug, planCategories.slug))
    .leftJoin(orderLines, eq(orderLines.orderId, weeklyOrders.id))
    .where(eq(weeklyOrders.userId, userId))
    .groupBy(
      weeklyOrders.id,
      weeklyOrders.status,
      weeklyOrders.totalCents,
      weeklyOrders.tipCents,
      weeklyOrders.receiptNumber,
      weeklyOrders.externalOrderNumber,
      weeklyBatches.weekStart,
      weeklyBatches.reviewDeadline,
      pickupWindows.label,
      weeklyOrders.membershipId,
      memberships.planSlug,
      planCategories.name,
    )
    .orderBy(desc(weeklyBatches.weekStart))
    .limit(20);

  return rows.map((row) => {
    const planSlug = row.planSlug ?? null;
    return {
      id: row.id,
      status: row.status,
      totalCents: row.totalCents,
      tipCents: row.tipCents,
      batchWeekStart: String(row.batchWeekStart),
      pickupLabel: row.pickupLabel,
      reviewDeadline: row.reviewDeadline ? row.reviewDeadline.toISOString() : null,
      needsReview: EDITABLE_ORDER_STATUSES.includes(row.status),
      itemCount: row.itemCount,
      receiptNumber: row.receiptNumber,
      externalOrderNumber: row.externalOrderNumber,
      membershipId: row.membershipId,
      planSlug,
      planName: planSlug ? (row.planName ?? planSlug) : null,
    };
  });
}

/** Full weekly review payload for a customer-owned order. */
export async function getOrderReviewForCustomer(
  orderId: string,
  userId: string,
): Promise<WeeklyOrderReview | null> {
  const db = getDb();
  const owned = await loadOrderOwnedByUser(orderId, userId);
  const { order, batch } = owned;

  const [profile] = await db
    .select({ paymentSchedule: customerProfiles.paymentSchedule })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  const membershipContext = await loadOrderMembershipContext(order.membershipId);
  const paymentSchedule = resolveOrderPaymentSchedule({
    paymentScheduleSnapshot: order.paymentScheduleSnapshot,
    membershipPaymentSchedule: membershipContext.membershipPaymentSchedule,
    profilePaymentSchedule: profile?.paymentSchedule,
  });

  let pickupWindow: WeeklyOrderReview["pickupWindow"] = null;
  if (order.pickupWindowId) {
    const [pw] = await db
      .select()
      .from(pickupWindows)
      .where(eq(pickupWindows.id, order.pickupWindowId))
      .limit(1);
    if (pw) {
      pickupWindow = {
        id: pw.id,
        label: pw.label,
        dayOfWeek: pw.dayOfWeek,
        timeRange: pw.timeRange,
        locationName: pw.locationName,
      };
    }
  }

  const lineRows = await db
    .select({
      id: orderLines.id,
      menuItemId: orderLines.menuItemId,
      menuItemName: menuItems.name,
      menuItemNote: menuItems.note,
      portion: orderLines.portion,
      qty: orderLines.qty,
      unitPriceCents: orderLines.unitPriceCents,
    })
    .from(orderLines)
    .innerJoin(menuItems, eq(orderLines.menuItemId, menuItems.id))
    .where(eq(orderLines.orderId, orderId))
    .orderBy(orderLines.createdAt);

  const availableRows = await db
    .select({
      batchItemId: batchItems.id,
      menuItemId: menuItems.id,
      menuItemName: menuItems.name,
      menuItemNote: menuItems.note,
      qtyRemaining: batchItems.qtyRemaining,
    })
    .from(batchItems)
    .innerJoin(menuItems, eq(batchItems.menuItemId, menuItems.id))
    .where(and(eq(batchItems.batchId, batch.id), sql`${batchItems.qtyRemaining} > 0`))
    .orderBy(menuItems.name);

  const commentRows = await db
    .select({
      id: orderComments.id,
      body: orderComments.body,
      createdAt: orderComments.createdAt,
    })
    .from(orderComments)
    .where(and(eq(orderComments.orderId, orderId), eq(orderComments.visibility, "customer")))
    .orderBy(orderComments.createdAt);

  const requestRows = await db
    .select({
      id: orderLineRequests.id,
      type: orderLineRequests.type,
      orderLineId: orderLineRequests.orderLineId,
      requestedMenuItemId: orderLineRequests.requestedMenuItemId,
      requestedMenuItemName: menuItems.name,
      requestedQty: orderLineRequests.requestedQty,
      customerNote: orderLineRequests.customerNote,
      status: orderLineRequests.status,
    })
    .from(orderLineRequests)
    .leftJoin(menuItems, eq(orderLineRequests.requestedMenuItemId, menuItems.id))
    .where(eq(orderLineRequests.orderId, orderId))
    .orderBy(orderLineRequests.createdAt);

  const editState = getOrderEditState(order.status, batch.reviewDeadline);

  return {
    order: {
      id: order.id,
      status: order.status,
      subtotalCents: order.subtotalCents,
      taxCents: order.taxCents,
      tipCents: order.tipCents,
      totalCents: order.totalCents,
      receiptNumber: order.receiptNumber,
      externalOrderNumber: order.externalOrderNumber,
      paymentScheduleSnapshot: order.paymentScheduleSnapshot,
      customerVisibleNote: order.customerVisibleNote,
      reviewedAt: order.reviewedAt?.toISOString() ?? null,
      approvedAt: order.approvedAt?.toISOString() ?? null,
      membershipId: order.membershipId,
      planSlug: membershipContext.planSlug,
      planName: membershipContext.planName,
    },
    batch: {
      id: batch.id,
      weekStart: String(batch.weekStart),
      pickupDate: batch.pickupDate ? String(batch.pickupDate) : null,
      reviewDeadline: batch.reviewDeadline?.toISOString() ?? null,
      status: batch.status,
    },
    pickupWindow,
    paymentSchedule,
    lines: lineRows.map((line) => ({
      id: line.id,
      menuItemId: line.menuItemId,
      menuItemName: line.menuItemName,
      menuItemNote: line.menuItemNote,
      portion: line.portion,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.qty * line.unitPriceCents,
    })),
    availableMeals: availableRows.map((meal) => ({
      batchItemId: meal.batchItemId,
      menuItemId: meal.menuItemId,
      menuItemName: meal.menuItemName,
      menuItemNote: meal.menuItemNote,
      qtyRemaining: meal.qtyRemaining,
    })),
    comments: commentRows.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
    pendingRequests: requestRows
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: r.id,
        type: r.type,
        orderLineId: r.orderLineId,
        requestedMenuItemId: r.requestedMenuItemId,
        requestedMenuItemName: r.requestedMenuItemName,
        requestedQty: r.requestedQty,
        customerNote: r.customerNote,
        status: r.status,
      })),
    ...editState,
  };
}

/** Persist qty changes, substitution notes, and optional comment during review. */
export async function saveCustomerReviewChanges(
  input: SaveReviewChangesInput,
): Promise<WeeklyOrderReview> {
  const { orderId, userId, lines, substitutions, comment } = input;
  const owned = await loadOrderOwnedByUser(orderId, userId);
  const { order, batch } = owned;
  const editState = getOrderEditState(order.status, batch.reviewDeadline);

  if (!editState.canEdit) {
    throw new Error(editState.editBlockedReason ?? "This order cannot be edited.");
  }

  const db = getDb();
  const existingLines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));

  const lineIds = new Set(existingLines.map((l) => l.id));
  for (const change of lines) {
    if (!lineIds.has(change.lineId)) {
      throw new Error("Invalid order line.");
    }
    if (change.qty < 0) {
      throw new Error("Quantity cannot be negative.");
    }
  }

  const availableByMenuItem = new Map<string, number>();
  const batchMeals = await db
    .select({
      menuItemId: batchItems.menuItemId,
      qtyRemaining: batchItems.qtyRemaining,
    })
    .from(batchItems)
    .where(eq(batchItems.batchId, batch.id));

  for (const meal of batchMeals) {
    availableByMenuItem.set(meal.menuItemId, meal.qtyRemaining);
  }

  let needsChefReview = false;

  for (const change of lines) {
    const existing = existingLines.find((l) => l.id === change.lineId);
    if (!existing) continue;

    await db.update(orderLines).set({ qty: change.qty }).where(eq(orderLines.id, change.lineId));

    if (change.qty === 0 && existing.qty > 0) {
      await db.insert(orderLineRequests).values({
        id: randomUUID(),
        orderId,
        orderLineId: change.lineId,
        type: "zero_out",
        requestedQty: 0,
        status: "accepted",
        resolvedAt: new Date(),
      });
    }
  }

  for (const sub of substitutions) {
    if (!lineIds.has(sub.lineId)) {
      throw new Error("Invalid order line for substitution.");
    }

    const existing = existingLines.find((l) => l.id === sub.lineId);
    if (!existing) continue;

    const remaining = availableByMenuItem.get(sub.menuItemId) ?? 0;
    const targetQty = existing.qty > 0 ? existing.qty : 1;

    if (sub.menuItemId === existing.menuItemId) {
      continue;
    }

    if (remaining >= targetQty) {
      const [menuItem] = await db
        .select({
          id: menuItems.id,
          price4ozCents: menuItems.price4ozCents,
          price6ozCents: menuItems.price6ozCents,
          categoryId: menuItems.categoryId,
        })
        .from(menuItems)
        .where(eq(menuItems.id, sub.menuItemId))
        .limit(1);

      if (!menuItem) {
        throw new Error("Selected meal is not available.");
      }

      let category: { price4ozCents: number; price6ozCents: number } | null = null;
      if (menuItem.categoryId) {
        const [cat] = await db
          .select({
            price4ozCents: planCategories.price4ozCents,
            price6ozCents: planCategories.price6ozCents,
          })
          .from(planCategories)
          .where(eq(planCategories.id, menuItem.categoryId))
          .limit(1);
        category = cat ?? null;
      }

      const unitPriceCents = resolveUnitPriceCents(menuItem, category, existing.portion);

      await db
        .update(orderLines)
        .set({
          menuItemId: sub.menuItemId,
          unitPriceCents,
          source: "customer_requested",
        })
        .where(eq(orderLines.id, sub.lineId));
    } else {
      needsChefReview = true;
      await db.insert(orderLineRequests).values({
        id: randomUUID(),
        orderId,
        orderLineId: sub.lineId,
        type: "substitution",
        requestedMenuItemId: sub.menuItemId,
        requestedQty: targetQty,
        customerNote: sub.note ?? null,
        status: "pending",
      });
    }
  }

  if (comment?.trim()) {
    await db.insert(orderComments).values({
      id: randomUUID(),
      orderId,
      authorId: userId,
      body: comment.trim(),
      visibility: "customer",
    });
  }

  await recalculateOrderTotals(orderId);

  const nextStatus: OrderStatus = needsChefReview ? "changes_requested" : "pending_customer_review";
  if (nextStatus !== order.status) {
    await db.update(weeklyOrders).set({ status: nextStatus }).where(eq(weeklyOrders.id, orderId));
  }

  await db.update(weeklyOrders).set({ reviewedAt: new Date() }).where(eq(weeklyOrders.id, orderId));

  const review = await getOrderReviewForCustomer(orderId, userId);
  if (!review) {
    throw new Error("Order could not be reloaded after save.");
  }
  return review;
}

/** Approve a weekly order — snapshots payment schedule; no Stripe charge in Sprint B. */
export async function approveCustomerOrder(
  orderId: string,
  userId: string,
): Promise<WeeklyOrderReview> {
  const owned = await loadOrderOwnedByUser(orderId, userId);
  const { order, batch } = owned;
  const editState = getOrderEditState(order.status, batch.reviewDeadline);

  if (!editState.canApprove) {
    throw new Error(editState.editBlockedReason ?? "This order cannot be approved.");
  }

  const db = getDb();

  const pendingSubs = await db
    .select({ id: orderLineRequests.id })
    .from(orderLineRequests)
    .where(
      and(
        eq(orderLineRequests.orderId, orderId),
        eq(orderLineRequests.status, "pending"),
        inArray(orderLineRequests.type, ["substitution", "add"]),
      ),
    )
    .limit(1);

  if (pendingSubs.length > 0) {
    throw new Error("Please wait for the kitchen to resolve pending substitution requests.");
  }

  const [profile] = await db
    .select({ paymentSchedule: customerProfiles.paymentSchedule })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

  const membershipContext = await loadOrderMembershipContext(order.membershipId);
  const paymentSchedule = resolveOrderPaymentSchedule({
    paymentScheduleSnapshot: null,
    membershipPaymentSchedule: membershipContext.membershipPaymentSchedule,
    profilePaymentSchedule: profile?.paymentSchedule,
  });
  const chargeDueAt = batch.chargeScheduledAt ?? batch.reviewDeadline ?? new Date();
  const now = new Date();

  await db
    .update(weeklyOrders)
    .set({
      status: "approved",
      paymentScheduleSnapshot: paymentSchedule,
      chargeDueAt,
      reviewedAt: now,
      approvedAt: now,
    })
    .where(eq(weeklyOrders.id, orderId));

  const review = await getOrderReviewForCustomer(orderId, userId);
  if (!review) {
    throw new Error("Order could not be reloaded after approval.");
  }
  return review;
}

export const REVIEWABLE_STATUSES = EDITABLE_ORDER_STATUSES;
export const ALL_ORDER_STATUSES = orderStatuses;
