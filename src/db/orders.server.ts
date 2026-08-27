import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { AuthError } from "@/auth/user.server";
import type { PaymentSchedule } from "@/db/schema/payment-schedules.ts";
import type { CustomerOrderSummary, WeeklyOrderReview } from "@/orders/review-types.ts";
import { orderNeedsSelection } from "@/orders/review-types.ts";
import { resolveOrderMealsAllowed, resolveOrderPortion } from "@/orders/order-snapshots.ts";
import type { SelectionPick, WeeklyOrderSelection } from "@/orders/selection-types.ts";
import {
  getOrderSelectionState,
  isSelectableOrderStatus,
  resolveSelectionSaveStatus,
  resolveSelectionSubmitStatus,
  sumSelectionQty,
  validateSelectionSavePicks,
  validateSelectionSubmitPicks,
} from "@/orders/selection-types.ts";
import { resolveOrderPaymentSchedule } from "@/orders/payment-schedule.ts";
import { resolveOrderPlanName, resolveOrderPlanSlug } from "@/orders/order-snapshots.ts";
export type { CustomerOrderSummary, WeeklyOrderReview } from "@/orders/review-types.ts";
export type { WeeklyOrderSelection } from "@/orders/selection-types.ts";
export {
  getOrderSelectionState,
  isSelectableOrderStatus,
  sumSelectionQty,
  validateSelectionSavePicks,
  validateSelectionSubmitPicks,
} from "@/orders/selection-types.ts";
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

export type SaveSelectionInput = {
  orderId: string;
  userId: string;
  picks: SelectionPick[];
};

export type SubmitSelectionInput = SaveSelectionInput;

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
      editBlockedReason:
        orderStatus === "finalized"
          ? "This order was prepared by the kitchen and cannot be changed."
          : "This order is no longer open for review.",
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

type OrderDb = Pick<ReturnType<typeof getDb>, "select" | "delete" | "insert" | "update">;

async function lockWeeklyOrderForUpdate(orderId: string, db: OrderDb): Promise<void> {
  const [locked] = await db
    .select({ id: weeklyOrders.id })
    .from(weeklyOrders)
    .where(eq(weeklyOrders.id, orderId))
    .for("update")
    .limit(1);

  if (!locked) {
    throw new AuthError("Order not found", "FORBIDDEN");
  }
}

async function loadOrderOwnedByUser(orderId: string, userId: string, db: OrderDb = getDb()) {
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

async function loadBatchMenuContext(
  batchId: string,
  db = getDb(),
): Promise<{
  batchMenuItemIds: Set<string>;
  menuById: Map<
    string,
    {
      id: string;
      name: string;
      note: string | null;
      categoryId: string | null;
      price4ozCents: number | null;
      price6ozCents: number | null;
    }
  >;
  categoryById: Map<string, { price4ozCents: number; price6ozCents: number }>;
  batchItemIdByMenuItemId: Map<string, string>;
}> {
  const batchMeals = await db
    .select({
      batchItemId: batchItems.id,
      menuItemId: batchItems.menuItemId,
      menuItemName: menuItems.name,
      menuItemNote: menuItems.note,
      categoryId: menuItems.categoryId,
      price4ozCents: menuItems.price4ozCents,
      price6ozCents: menuItems.price6ozCents,
    })
    .from(batchItems)
    .innerJoin(menuItems, eq(batchItems.menuItemId, menuItems.id))
    .where(eq(batchItems.batchId, batchId))
    .orderBy(menuItems.name);

  const batchMenuItemIds = new Set(batchMeals.map((meal) => meal.menuItemId));
  const batchItemIdByMenuItemId = new Map(
    batchMeals.map((meal) => [meal.menuItemId, meal.batchItemId]),
  );
  const menuById = new Map(
    batchMeals.map((meal) => [
      meal.menuItemId,
      {
        id: meal.menuItemId,
        name: meal.menuItemName,
        note: meal.menuItemNote,
        categoryId: meal.categoryId,
        price4ozCents: meal.price4ozCents,
        price6ozCents: meal.price6ozCents,
      },
    ]),
  );

  const categoryIds = batchMeals.map((m) => m.categoryId).filter(Boolean) as string[];
  const categories =
    categoryIds.length > 0
      ? await db
          .select({
            id: planCategories.id,
            price4ozCents: planCategories.price4ozCents,
            price6ozCents: planCategories.price6ozCents,
          })
          .from(planCategories)
          .where(inArray(planCategories.id, categoryIds))
      : [];

  return {
    batchMenuItemIds,
    menuById,
    categoryById: new Map(categories.map((c) => [c.id, c])),
    batchItemIdByMenuItemId,
  };
}

async function loadOrderMembershipMealsContext(
  membershipId: string | null,
  db = getDb(),
): Promise<{
  membershipPaymentSchedule: PaymentSchedule | null;
  planSlug: string | null;
  planName: string | null;
  membershipMealsPerWeek: number | null;
  membershipPortionDefault: Portion | null;
}> {
  if (!membershipId) {
    return {
      membershipPaymentSchedule: null,
      planSlug: null,
      planName: null,
      membershipMealsPerWeek: null,
      membershipPortionDefault: null,
    };
  }

  const [row] = await db
    .select({
      paymentSchedule: memberships.paymentSchedule,
      planSlug: memberships.planSlug,
      planName: planCategories.name,
      mealsPerWeek: memberships.mealsPerWeek,
      portionDefault: memberships.portionDefault,
    })
    .from(memberships)
    .leftJoin(planCategories, eq(memberships.planSlug, planCategories.slug))
    .where(eq(memberships.id, membershipId))
    .limit(1);

  if (!row) {
    return {
      membershipPaymentSchedule: null,
      planSlug: null,
      planName: null,
      membershipMealsPerWeek: null,
      membershipPortionDefault: null,
    };
  }

  const planSlug = row.planSlug ?? null;
  return {
    membershipPaymentSchedule: row.paymentSchedule,
    planSlug,
    planName: planSlug ? (row.planName ?? planSlug) : null,
    membershipMealsPerWeek: row.mealsPerWeek,
    membershipPortionDefault: row.portionDefault,
  };
}

async function loadOrderMembershipContext(membershipId: string | null): Promise<{
  membershipPaymentSchedule: PaymentSchedule | null;
  planSlug: string | null;
  planName: string | null;
}> {
  const ctx = await loadOrderMembershipMealsContext(membershipId);
  return {
    membershipPaymentSchedule: ctx.membershipPaymentSchedule,
    planSlug: ctx.planSlug,
    planName: ctx.planName,
  };
}

async function recalculateOrderTotals(orderId: string, db = getDb()): Promise<void> {
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
      selectionDeadline: weeklyBatches.selectionDeadline,
      batchStatus: weeklyBatches.status,
      mealsAllowedSnapshot: weeklyOrders.mealsAllowedSnapshot,
      membershipMealsPerWeek: memberships.mealsPerWeek,
      pickupLabel: pickupWindows.label,
      membershipId: weeklyOrders.membershipId,
      planSlugSnapshot: weeklyOrders.planSlugSnapshot,
      planNameSnapshot: weeklyOrders.planNameSnapshot,
      membershipPlanSlug: memberships.planSlug,
      planCategoryName: planCategories.name,
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
      weeklyBatches.selectionDeadline,
      weeklyBatches.status,
      weeklyOrders.mealsAllowedSnapshot,
      memberships.mealsPerWeek,
      pickupWindows.label,
      weeklyOrders.membershipId,
      weeklyOrders.planSlugSnapshot,
      weeklyOrders.planNameSnapshot,
      memberships.planSlug,
      planCategories.name,
    )
    .orderBy(desc(weeklyBatches.weekStart))
    .limit(20);

  return rows.map((row) => {
    const planSlug = resolveOrderPlanSlug({
      planSlugSnapshot: row.planSlugSnapshot,
      membershipPlanSlug: row.membershipPlanSlug,
    });
    const mealsAllowed = resolveOrderMealsAllowed({
      mealsAllowedSnapshot: row.mealsAllowedSnapshot,
      membershipMealsPerWeek: row.membershipMealsPerWeek,
    });
    const selectionDeadline = row.selectionDeadline ? row.selectionDeadline.toISOString() : null;
    const needsSelection = orderNeedsSelection({
      status: row.status,
      batchStatus: row.batchStatus,
      selectionDeadline,
      mealsAllowed,
    });
    return {
      id: row.id,
      status: row.status,
      totalCents: row.totalCents,
      tipCents: row.tipCents,
      batchWeekStart: String(row.batchWeekStart),
      pickupLabel: row.pickupLabel,
      reviewDeadline: row.reviewDeadline ? row.reviewDeadline.toISOString() : null,
      selectionDeadline,
      needsReview: EDITABLE_ORDER_STATUSES.includes(row.status),
      needsSelection,
      itemCount: row.itemCount,
      mealsAllowed,
      mealsSelected: row.itemCount,
      receiptNumber: row.receiptNumber,
      externalOrderNumber: row.externalOrderNumber,
      membershipId: row.membershipId,
      planSlug,
      planName: resolveOrderPlanName({
        planNameSnapshot: row.planNameSnapshot,
        planSlugSnapshot: row.planSlugSnapshot,
        membershipPlanSlug: row.membershipPlanSlug,
        membershipPlanName: row.planCategoryName,
      }),
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
      planSlug: resolveOrderPlanSlug({
        planSlugSnapshot: order.planSlugSnapshot,
        membershipPlanSlug: membershipContext.planSlug,
      }),
      planName: resolveOrderPlanName({
        planNameSnapshot: order.planNameSnapshot,
        planSlugSnapshot: order.planSlugSnapshot,
        membershipPlanSlug: membershipContext.planSlug,
        membershipPlanName: membershipContext.planName,
      }),
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

function resolveOrderSelectionEntitlements(
  order: WeeklyOrder,
  membershipContext: Awaited<ReturnType<typeof loadOrderMembershipMealsContext>>,
): { mealsAllowed: number; portion: Portion } {
  const mealsAllowed = resolveOrderMealsAllowed({
    mealsAllowedSnapshot: order.mealsAllowedSnapshot,
    membershipMealsPerWeek: membershipContext.membershipMealsPerWeek,
  });
  const portion = resolveOrderPortion({
    portionSnapshot: order.portionSnapshot,
    membershipPortionDefault: membershipContext.membershipPortionDefault,
  });

  if (mealsAllowed == null || mealsAllowed <= 0) {
    throw new Error("Meal allowance is not available for this order.");
  }
  if (!portion) {
    throw new Error("Portion is not available for this order.");
  }

  return { mealsAllowed, portion };
}

/** Meal selection payload for customer-owned selection orders. */
export async function getOrderSelectionForCustomer(
  orderId: string,
  userId: string,
): Promise<WeeklyOrderSelection | null> {
  const owned = await loadOrderOwnedByUser(orderId, userId);
  const { order, batch } = owned;
  const membershipContext = await loadOrderMembershipMealsContext(order.membershipId);

  const { mealsAllowed, portion } = resolveOrderSelectionEntitlements(order, membershipContext);
  const menuContext = await loadBatchMenuContext(batch.id);

  let pickupWindow: WeeklyOrderSelection["pickupWindow"] = null;
  if (order.pickupWindowId) {
    const db = getDb();
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

  const db = getDb();
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

  const mealsSelected = sumSelectionQty(lineRows);
  const selectionState = getOrderSelectionState({
    orderStatus: order.status,
    batchStatus: batch.status,
    selectionDeadline: batch.selectionDeadline,
    mealsAllowed,
  });

  const menuMeals = [...menuContext.menuById.values()].map((meal) => {
    const category = meal.categoryId
      ? (menuContext.categoryById.get(meal.categoryId) ?? null)
      : null;
    return {
      batchItemId: menuContext.batchItemIdByMenuItemId.get(meal.id)!,
      menuItemId: meal.id,
      menuItemName: meal.name,
      menuItemNote: meal.note,
      unitPriceCents: resolveUnitPriceCents(meal, category, portion),
    };
  });

  return {
    order: {
      id: order.id,
      status: order.status,
      subtotalCents: order.subtotalCents,
      taxCents: order.taxCents,
      tipCents: order.tipCents,
      totalCents: order.totalCents,
      mealsAllowed,
      mealsSelected,
      portion,
      membershipId: order.membershipId,
      planSlug: resolveOrderPlanSlug({
        planSlugSnapshot: order.planSlugSnapshot,
        membershipPlanSlug: membershipContext.planSlug,
      }),
      planName: resolveOrderPlanName({
        planNameSnapshot: order.planNameSnapshot,
        planSlugSnapshot: order.planSlugSnapshot,
        membershipPlanSlug: membershipContext.planSlug,
        membershipPlanName: membershipContext.planName,
      }),
      paymentScheduleSnapshot: order.paymentScheduleSnapshot,
      selectionSubmittedAt: order.selectionSubmittedAt?.toISOString() ?? null,
    },
    batch: {
      id: batch.id,
      weekStart: String(batch.weekStart),
      pickupDate: batch.pickupDate ? String(batch.pickupDate) : null,
      selectionDeadline: batch.selectionDeadline?.toISOString() ?? null,
      status: batch.status,
    },
    pickupWindow,
    menuMeals,
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
    canEdit: selectionState.canEdit,
    canSubmit:
      selectionState.canSubmit &&
      mealsSelected === mealsAllowed &&
      isSelectableOrderStatus(order.status),
    editBlockedReason: selectionState.editBlockedReason,
  };
}

/** Ordered reads/writes inside persistCustomerSelectionPicks's transaction (documented for tests). */
export const CUSTOMER_SELECTION_TX_PLAN = [
  "lock_weekly_order",
  "re_read_order_and_batch",
  "read_membership_context",
  "validate_selection_editable",
  "validate_picks",
  "replace_order_lines",
  "recalculate_totals",
  "update_selection_status",
] as const;

async function persistCustomerSelectionPicks(
  input: SaveSelectionInput,
  mode: "save" | "submit",
): Promise<void> {
  const { orderId, userId, picks } = input;
  const db = getDb();

  await db.transaction(async (tx) => {
    await lockWeeklyOrderForUpdate(orderId, tx);
    const owned = await loadOrderOwnedByUser(orderId, userId, tx);
    const { order, batch } = owned;
    const membershipContext = await loadOrderMembershipMealsContext(order.membershipId, tx);
    const { mealsAllowed, portion } = resolveOrderSelectionEntitlements(order, membershipContext);
    const menuContext = await loadBatchMenuContext(batch.id, tx);

    const selectionState = getOrderSelectionState({
      orderStatus: order.status,
      batchStatus: batch.status,
      selectionDeadline: batch.selectionDeadline,
      mealsAllowed,
    });

    if (!selectionState.canEdit) {
      throw new Error(selectionState.editBlockedReason ?? "This order cannot be edited.");
    }

    if (mode === "submit") {
      validateSelectionSubmitPicks(picks, mealsAllowed, menuContext.batchMenuItemIds);
    } else {
      validateSelectionSavePicks(picks, mealsAllowed, menuContext.batchMenuItemIds);
    }

    const positivePicks = picks.filter((pick) => pick.qty > 0);
    await tx.delete(orderLines).where(eq(orderLines.orderId, orderId));

    for (const pick of positivePicks) {
      const menuItem = menuContext.menuById.get(pick.menuItemId);
      if (!menuItem) {
        throw new Error("Selected meal is not on this week's menu.");
      }

      const category = menuItem.categoryId
        ? (menuContext.categoryById.get(menuItem.categoryId) ?? null)
        : null;
      const unitPriceCents = resolveUnitPriceCents(menuItem, category, portion);

      await tx.insert(orderLines).values({
        id: randomUUID(),
        orderId,
        menuItemId: pick.menuItemId,
        portion,
        qty: pick.qty,
        unitPriceCents,
        source: "customer_requested",
      });
    }

    await recalculateOrderTotals(orderId, tx);

    const now = new Date();
    if (mode === "submit") {
      await tx
        .update(weeklyOrders)
        .set({
          status: resolveSelectionSubmitStatus(),
          selectionSubmittedAt: now,
        })
        .where(eq(weeklyOrders.id, orderId));
      return;
    }

    const nextStatus = resolveSelectionSaveStatus(order.status);
    if (nextStatus !== order.status) {
      await tx.update(weeklyOrders).set({ status: nextStatus }).where(eq(weeklyOrders.id, orderId));
    }
  });
}

/** Save partial meal picks during the selection window. */
export async function saveCustomerSelection(
  input: SaveSelectionInput,
): Promise<WeeklyOrderSelection> {
  await persistCustomerSelectionPicks(input, "save");
  const selection = await getOrderSelectionForCustomer(input.orderId, input.userId);
  if (!selection) {
    throw new Error("Order could not be reloaded after save.");
  }
  return selection;
}

/** Submit a completed meal selection (exact meals_allowed qty required). */
export async function submitCustomerSelection(
  input: SubmitSelectionInput,
): Promise<WeeklyOrderSelection> {
  await persistCustomerSelectionPicks(input, "submit");
  const selection = await getOrderSelectionForCustomer(input.orderId, input.userId);
  if (!selection) {
    throw new Error("Order could not be reloaded after submit.");
  }
  return selection;
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
