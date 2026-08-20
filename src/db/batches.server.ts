import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  AdminBatchInventoryRow,
  AdminBatchSummary,
  AdminMenuItemOption,
  AdminOrderRow,
  AdminPickupWindowOption,
} from "@/orders/admin-types.ts";

import { toIsoDateString } from "@/lib/dates.ts";

import { getDb } from "./index.server.ts";
import { batchItems } from "./schema/batch-items.ts";
import { customerProfiles } from "./schema/customer-profiles.ts";
import { memberships } from "./schema/memberships.ts";
import { menuItems } from "./schema/menu-items.ts";
import { orderLines } from "./schema/order-lines.ts";
import type { Portion } from "./schema/order-lines.ts";
import { pickupWindows } from "./schema/pickup-windows.ts";
import { planCategories } from "./schema/plan-categories.ts";
import { users } from "./schema/users.ts";
import { weeklyBatches, type BatchStatus } from "./schema/weekly-batches.ts";
import { weeklyOrders } from "./schema/weekly-orders.ts";

const PUBLISHABLE_BATCH_STATUSES: BatchStatus[] = ["planning", "draft"];

function weekStartMonday(base = new Date()): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

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
  await db
    .update(weeklyOrders)
    .set({ subtotalCents, taxCents: 0, totalCents: subtotalCents })
    .where(eq(weeklyOrders.id, orderId));
}

/** All weekly batches with order and inventory counts. */
export async function listAdminBatches(): Promise<AdminBatchSummary[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: weeklyBatches.id,
      weekStart: weeklyBatches.weekStart,
      pickupDate: weeklyBatches.pickupDate,
      status: weeklyBatches.status,
      reviewDeadline: weeklyBatches.reviewDeadline,
      chargeScheduledAt: weeklyBatches.chargeScheduledAt,
      pickupWindowLabel: pickupWindows.label,
      orderCount: sql<number>`(
        select count(*) from weekly_orders wo where wo.batch_id = ${weeklyBatches.id}
      )`.mapWith(Number),
      itemCount: sql<number>`(
        select count(*) from batch_items bi where bi.batch_id = ${weeklyBatches.id}
      )`.mapWith(Number),
    })
    .from(weeklyBatches)
    .leftJoin(pickupWindows, eq(weeklyBatches.pickupWindowId, pickupWindows.id))
    .orderBy(desc(weeklyBatches.weekStart));

  return rows.map((row) => ({
    id: row.id,
    weekStart: toIsoDateString(row.weekStart) ?? "",
    pickupDate: toIsoDateString(row.pickupDate),
    status: row.status,
    reviewDeadline: row.reviewDeadline?.toISOString() ?? null,
    chargeScheduledAt: row.chargeScheduledAt?.toISOString() ?? null,
    pickupWindowLabel: row.pickupWindowLabel,
    orderCount: row.orderCount,
    itemCount: row.itemCount,
  }));
}

export async function listAdminPickupWindows(): Promise<AdminPickupWindowOption[]> {
  const db = getDb();
  const rows = await db
    .select({ id: pickupWindows.id, label: pickupWindows.label })
    .from(pickupWindows)
    .where(eq(pickupWindows.active, true))
    .orderBy(pickupWindows.sortOrder);

  return rows;
}

export async function listActiveMenuItemsForAdmin(): Promise<AdminMenuItemOption[]> {
  const db = getDb();
  return db
    .select({ id: menuItems.id, name: menuItems.name, note: menuItems.note })
    .from(menuItems)
    .where(eq(menuItems.active, true))
    .orderBy(menuItems.sortOrder, menuItems.name);
}

export type CreateWeeklyBatchInput = {
  weekStart?: string;
  pickupWindowId?: string;
};

/** Create a planning batch for the given week (defaults to current Monday). */
export async function createWeeklyBatch(input: CreateWeeklyBatchInput = {}): Promise<string> {
  const db = getDb();
  const weekStart = input.weekStart ? new Date(`${input.weekStart}T12:00:00`) : weekStartMonday();
  const pickupDate = addDays(weekStart, 6);
  const reviewDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const chargeScheduledAt = new Date(reviewDeadline.getTime() + 60 * 60 * 1000);

  let pickupWindowId = input.pickupWindowId ?? null;
  if (!pickupWindowId) {
    const [pickup] = await db
      .select({ id: pickupWindows.id })
      .from(pickupWindows)
      .where(eq(pickupWindows.active, true))
      .orderBy(pickupWindows.sortOrder)
      .limit(1);
    pickupWindowId = pickup?.id ?? null;
  }

  const existing = await db
    .select({ id: weeklyBatches.id })
    .from(weeklyBatches)
    .where(eq(weeklyBatches.weekStart, weekStart))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`A batch already exists for week of ${weekStart.toISOString().slice(0, 10)}.`);
  }

  const id = randomUUID();
  await db.insert(weeklyBatches).values({
    id,
    weekStart,
    pickupDate,
    pickupWindowId,
    status: "planning",
    reviewDeadline,
    chargeScheduledAt,
  });

  return id;
}

/** Batch inventory merged with active catalog items for editing. */
export async function getBatchInventory(batchId: string): Promise<AdminBatchInventoryRow[]> {
  const db = getDb();

  const [batch] = await db
    .select({ id: weeklyBatches.id })
    .from(weeklyBatches)
    .where(eq(weeklyBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const catalog = await listActiveMenuItemsForAdmin();
  const existing = await db
    .select({
      batchItemId: batchItems.id,
      menuItemId: batchItems.menuItemId,
      menuItemName: menuItems.name,
      qtyCooked: batchItems.qtyCooked,
      qtyRemaining: batchItems.qtyRemaining,
    })
    .from(batchItems)
    .innerJoin(menuItems, eq(batchItems.menuItemId, menuItems.id))
    .where(eq(batchItems.batchId, batchId));

  const byMenuItem = new Map(existing.map((row) => [row.menuItemId, row]));

  return catalog.map((item) => {
    const row = byMenuItem.get(item.id);
    return {
      batchItemId: row?.batchItemId ?? null,
      menuItemId: item.id,
      menuItemName: row?.menuItemName ?? item.name,
      qtyCooked: row?.qtyCooked ?? 0,
      qtyRemaining: row?.qtyRemaining ?? 0,
    };
  });
}

export type SaveBatchInventoryInput = {
  batchId: string;
  items: Array<{ menuItemId: string; qtyCooked: number }>;
};

/** Upsert batch menu inventory from catalog items (qty 0 removes the row). */
export async function saveBatchInventory(input: SaveBatchInventoryInput): Promise<void> {
  const { batchId, items } = input;
  const db = getDb();

  const [batch] = await db
    .select({ status: weeklyBatches.status })
    .from(weeklyBatches)
    .where(eq(weeklyBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  if (!PUBLISHABLE_BATCH_STATUSES.includes(batch.status)) {
    throw new Error("Inventory can only be edited while the batch is in planning or draft.");
  }

  const menuItemIds = items.map((i) => i.menuItemId);
  if (menuItemIds.length === 0) return;

  const validMenuItems = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.active, true), inArray(menuItems.id, menuItemIds)));

  const validIds = new Set(validMenuItems.map((m) => m.id));

  const existingRows = await db
    .select({ id: batchItems.id, menuItemId: batchItems.menuItemId })
    .from(batchItems)
    .where(eq(batchItems.batchId, batchId));

  const existingByMenuItem = new Map(existingRows.map((r) => [r.menuItemId, r.id]));

  for (const item of items) {
    if (!validIds.has(item.menuItemId)) continue;

    const qty = Math.max(0, Math.min(999, Math.floor(item.qtyCooked)));
    const existingId = existingByMenuItem.get(item.menuItemId);

    if (qty === 0) {
      if (existingId) {
        await db.delete(batchItems).where(eq(batchItems.id, existingId));
      }
      continue;
    }

    if (existingId) {
      await db
        .update(batchItems)
        .set({ qtyCooked: qty, qtyRemaining: qty })
        .where(eq(batchItems.id, existingId));
    } else {
      await db.insert(batchItems).values({
        id: randomUUID(),
        batchId,
        menuItemId: item.menuItemId,
        qtyCooked: qty,
        qtyRemaining: qty,
      });
    }
  }
}

async function resolvePublishCustomers(): Promise<
  Array<{ userId: string; portionDefault: Portion; defaultPickupWindowId: string | null }>
> {
  const db = getDb();

  const activeMembers = await db
    .select({
      userId: memberships.userId,
      portionDefault: memberships.portionDefault,
      defaultPickupWindowId: customerProfiles.defaultPickupWindowId,
    })
    .from(memberships)
    .innerJoin(customerProfiles, eq(memberships.userId, customerProfiles.userId))
    .where(eq(memberships.status, "active"));

  if (activeMembers.length > 0) {
    const byUser = new Map<string, (typeof activeMembers)[number]>();
    for (const member of activeMembers) {
      if (!byUser.has(member.userId)) {
        byUser.set(member.userId, member);
      }
    }
    return [...byUser.values()];
  }

  return db
    .select({
      userId: customerProfiles.userId,
      portionDefault: customerProfiles.portionDefault,
      defaultPickupWindowId: customerProfiles.defaultPickupWindowId,
    })
    .from(customerProfiles)
    .innerJoin(users, eq(customerProfiles.userId, users.id))
    .where(eq(users.role, "customer"));
}

/** Open customer review: create pending orders for active members / existing customers. */
export async function publishWeeklyBatch(batchId: string): Promise<{ ordersCreated: number }> {
  const db = getDb();

  const [batch] = await db
    .select()
    .from(weeklyBatches)
    .where(eq(weeklyBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  if (!PUBLISHABLE_BATCH_STATUSES.includes(batch.status)) {
    throw new Error("Only planning or draft batches can be published.");
  }

  const inventory = await db
    .select({
      menuItemId: batchItems.menuItemId,
      qtyRemaining: batchItems.qtyRemaining,
    })
    .from(batchItems)
    .where(and(eq(batchItems.batchId, batchId), sql`${batchItems.qtyRemaining} > 0`))
    .limit(6);

  if (inventory.length === 0) {
    throw new Error("Add batch inventory before publishing.");
  }

  const menuDetails = await db
    .select({
      id: menuItems.id,
      categoryId: menuItems.categoryId,
      price4ozCents: menuItems.price4ozCents,
      price6ozCents: menuItems.price6ozCents,
    })
    .from(menuItems)
    .where(
      inArray(
        menuItems.id,
        inventory.map((i) => i.menuItemId),
      ),
    );

  const categoryIds = menuDetails.map((m) => m.categoryId).filter(Boolean) as string[];
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

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const menuById = new Map(menuDetails.map((m) => [m.id, m]));

  const customers = await resolvePublishCustomers();
  const existingOrders = await db
    .select({ userId: weeklyOrders.userId })
    .from(weeklyOrders)
    .where(eq(weeklyOrders.batchId, batchId));

  const existingUserIds = new Set(existingOrders.map((o) => o.userId));
  const mealsForLines = inventory.slice(0, 3);

  let ordersCreated = 0;

  for (const customer of customers) {
    if (existingUserIds.has(customer.userId)) continue;

    const orderId = randomUUID();
    const pickupWindowId = customer.defaultPickupWindowId ?? batch.pickupWindowId;

    await db.insert(weeklyOrders).values({
      id: orderId,
      batchId,
      userId: customer.userId,
      status: "pending_customer_review",
      pickupWindowId,
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
    });

    for (const [index, meal] of mealsForLines.entries()) {
      const menuItem = menuById.get(meal.menuItemId);
      if (!menuItem) continue;

      const category = menuItem.categoryId ? (categoryById.get(menuItem.categoryId) ?? null) : null;
      const portion = customer.portionDefault;
      const unitPriceCents = resolveUnitPriceCents(menuItem, category, portion);
      const qty = index === 0 ? 2 : 1;

      await db.insert(orderLines).values({
        id: randomUUID(),
        orderId,
        menuItemId: meal.menuItemId,
        portion,
        qty,
        unitPriceCents,
        source: "chef_assigned",
      });
    }

    await recalculateOrderTotals(orderId);
    ordersCreated += 1;
  }

  await db
    .update(weeklyBatches)
    .set({ status: "pending_customer_review" })
    .where(eq(weeklyBatches.id, batchId));

  return { ordersCreated };
}

/** Admin order list with customer, status, and totals; optional batch filter. */
export async function listAdminOrders(batchId?: string): Promise<AdminOrderRow[]> {
  const db = getDb();

  const conditions = batchId ? eq(weeklyOrders.batchId, batchId) : undefined;

  const rows = await db
    .select({
      id: weeklyOrders.id,
      batchId: weeklyOrders.batchId,
      batchWeekStart: weeklyBatches.weekStart,
      customerName: users.name,
      customerEmail: users.email,
      status: weeklyOrders.status,
      profilePaymentSchedule: customerProfiles.paymentSchedule,
      paymentScheduleSnapshot: weeklyOrders.paymentScheduleSnapshot,
      totalCents: weeklyOrders.totalCents,
      pickupLabel: pickupWindows.label,
      customerVisibleNote: weeklyOrders.customerVisibleNote,
      reviewDeadline: weeklyBatches.reviewDeadline,
      itemCount: sql<number>`coalesce((
        select sum(ol.qty) from order_lines ol where ol.order_id = ${weeklyOrders.id}
      ), 0)`.mapWith(Number),
    })
    .from(weeklyOrders)
    .innerJoin(weeklyBatches, eq(weeklyOrders.batchId, weeklyBatches.id))
    .innerJoin(users, eq(weeklyOrders.userId, users.id))
    .leftJoin(customerProfiles, eq(weeklyOrders.userId, customerProfiles.userId))
    .leftJoin(pickupWindows, eq(weeklyOrders.pickupWindowId, pickupWindows.id))
    .where(conditions)
    .orderBy(desc(weeklyBatches.weekStart), users.email);

  return rows.map((row) => ({
    id: row.id,
    batchId: row.batchId,
    batchWeekStart: toIsoDateString(row.batchWeekStart) ?? "",
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    status: row.status,
    paymentSchedule: row.paymentScheduleSnapshot ?? row.profilePaymentSchedule ?? "weekly_autopay",
    totalCents: row.totalCents,
    itemCount: row.itemCount,
    pickupLabel: row.pickupLabel,
    customerVisibleNote: row.customerVisibleNote,
    reviewDeadline: row.reviewDeadline?.toISOString() ?? null,
  }));
}
