import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  AdminBatchInventoryRow,
  AdminBatchSummary,
  AdminMenuItemOption,
  AdminOrderRow,
  AdminPickupWindowOption,
} from "@/orders/admin-types.ts";

import { toIsoDateString } from "@/lib/dates.ts";
import { resolveOrderPaymentSchedule } from "@/orders/payment-schedule.ts";
import {
  buildSelectionOrderSnapshots,
  resolveOrderPlanName,
  resolveOrderPlanSlug,
} from "@/orders/order-snapshots.ts";

import { getDb } from "./index.server.ts";
import type { PaymentSchedule } from "./schema/payment-schedules.ts";

type DbClient = ReturnType<typeof getDb>;
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
const MEALS_TAG_PREFIX = "meals:";

export type PublishEligibleMember = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  planSlug: string | null;
  planName: string | null;
  mealsPerWeek: number;
  portionDefault: Portion;
  membershipPaymentSchedule: PaymentSchedule;
  profilePaymentSchedule: PaymentSchedule;
  defaultPickupWindowId: string | null;
};

export type PublishEligibility = {
  eligible: PublishEligibleMember[];
  unresolved: Array<{ userId: string; email: string; name: string | null }>;
  excludedInactiveCount: number;
};

function parseMealsPerWeekFromTags(tags: string[] | null | undefined): number | null {
  if (!tags?.length) return null;
  const tag = tags.find((t) => t.startsWith(MEALS_TAG_PREFIX));
  if (!tag) return null;
  const value = Number.parseInt(tag.slice(MEALS_TAG_PREFIX.length), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveMemberMealsPerWeek(
  mealsPerWeek: number | null | undefined,
  dietaryTags: string[] | null | undefined,
): number | null {
  if (mealsPerWeek != null && mealsPerWeek > 0) {
    return Math.floor(mealsPerWeek);
  }
  return parseMealsPerWeekFromTags(dietaryTags);
}

/** Round-robin meal slots across ordered inventory; collapsed per menu item. */
export function assignMealsRoundRobin(
  mealsRequired: number,
  inventoryMenuItemIds: string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  if (mealsRequired <= 0 || inventoryMenuItemIds.length === 0) {
    return counts;
  }

  for (let i = 0; i < mealsRequired; i++) {
    const menuItemId = inventoryMenuItemIds[i % inventoryMenuItemIds.length]!;
    counts.set(menuItemId, (counts.get(menuItemId) ?? 0) + 1);
  }

  return counts;
}

function formatMemberLabel(name: string | null, email: string): string {
  const trimmed = name?.trim();
  return trimmed ? `${trimmed} (${email})` : email;
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
      selectionDeadline: weeklyBatches.selectionDeadline,
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
    selectionDeadline: row.selectionDeadline?.toISOString() ?? null,
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
  /** Stored in `weekStart` until a dedicated batch-date column exists. */
  batchDate: string;
  pickupDate: string;
  pickupWindowId?: string;
  items: Array<{ menuItemId: string; qtyCooked: number }>;
};

/** Create a planning batch with inventory for the given dates. */
export async function createWeeklyBatch(input: CreateWeeklyBatchInput): Promise<string> {
  const db = getDb();
  const weekStart = new Date(`${input.batchDate}T12:00:00`);
  const pickupDate = new Date(`${input.pickupDate}T12:00:00`);

  if (Number.isNaN(weekStart.getTime()) || Number.isNaN(pickupDate.getTime())) {
    throw new Error("Invalid batch or pickup date.");
  }

  const plannedItems = input.items
    .map((item) => ({
      menuItemId: item.menuItemId,
      qtyCooked: Math.max(0, Math.min(999, Math.floor(item.qtyCooked))),
    }))
    .filter((item) => item.qtyCooked > 0);

  if (plannedItems.length === 0) {
    throw new Error("Add at least one menu item with quantity greater than zero.");
  }

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
    throw new Error(`A batch already exists for batch date ${input.batchDate}.`);
  }

  const menuItemIds = plannedItems.map((item) => item.menuItemId);
  const validMenuItems = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.active, true), inArray(menuItems.id, menuItemIds)));

  const validIds = new Set(validMenuItems.map((m) => m.id));
  const inventoryItems = plannedItems.filter((item) => validIds.has(item.menuItemId));

  if (inventoryItems.length === 0) {
    throw new Error("No valid active menu items were selected.");
  }

  const id = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(weeklyBatches).values({
      id,
      weekStart,
      pickupDate,
      pickupWindowId,
      status: "planning",
      reviewDeadline,
      chargeScheduledAt,
    });

    for (const item of inventoryItems) {
      await tx.insert(batchItems).values({
        id: randomUUID(),
        batchId: id,
        menuItemId: item.menuItemId,
        qtyCooked: item.qtyCooked,
        qtyRemaining: item.qtyCooked,
      });
    }
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

export type ActiveMembershipRow = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  planSlug: string | null;
  planName: string | null;
  mealsPerWeek: number | null;
  dietaryTags: string[] | null;
  portionDefault: Portion;
  membershipPaymentSchedule: PaymentSchedule;
  profilePaymentSchedule: PaymentSchedule;
  defaultPickupWindowId: string | null;
};

/** Pure eligibility split used by publish and selection flows. */
export function classifyActiveMembershipRows(rows: ActiveMembershipRow[]): {
  eligible: PublishEligibleMember[];
  unresolved: PublishEligibility["unresolved"];
} {
  const eligible: PublishEligibleMember[] = [];
  const unresolved: PublishEligibility["unresolved"] = [];

  for (const row of rows) {
    const resolvedMeals = resolveMemberMealsPerWeek(row.mealsPerWeek, row.dietaryTags);
    if (resolvedMeals == null) {
      unresolved.push({ userId: row.userId, email: row.email, name: row.name });
      continue;
    }

    eligible.push({
      membershipId: row.membershipId,
      userId: row.userId,
      email: row.email,
      name: row.name,
      planSlug: row.planSlug,
      planName: row.planSlug ? (row.planName ?? row.planSlug) : null,
      mealsPerWeek: resolvedMeals,
      portionDefault: row.portionDefault,
      membershipPaymentSchedule: row.membershipPaymentSchedule,
      profilePaymentSchedule: row.profilePaymentSchedule,
      defaultPickupWindowId: row.defaultPickupWindowId,
    });
  }

  return { eligible, unresolved };
}

export async function listPublishEligibleMembers(
  client: DbClient = getDb(),
): Promise<PublishEligibility> {
  const db = client;

  const [inactiveCountRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(memberships)
    .where(inArray(memberships.status, ["paused", "cancelled"]));

  const activeRows = await db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      email: users.email,
      name: users.name,
      planSlug: memberships.planSlug,
      planName: planCategories.name,
      mealsPerWeek: memberships.mealsPerWeek,
      dietaryTags: customerProfiles.dietaryTags,
      portionDefault: memberships.portionDefault,
      membershipPaymentSchedule: memberships.paymentSchedule,
      profilePaymentSchedule: customerProfiles.paymentSchedule,
      defaultPickupWindowId: customerProfiles.defaultPickupWindowId,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(customerProfiles, eq(memberships.userId, customerProfiles.userId))
    .leftJoin(planCategories, eq(memberships.planSlug, planCategories.slug))
    .where(eq(memberships.status, "active"))
    .orderBy(asc(users.email), asc(memberships.id));

  const { eligible, unresolved } = classifyActiveMembershipRows(activeRows);

  return {
    eligible,
    unresolved,
    excludedInactiveCount: inactiveCountRow?.count ?? 0,
  };
}

export async function orderBatchInventory(
  batchId: string,
  client: DbClient = getDb(),
): Promise<
  Array<{
    menuItemId: string;
    menuItemName: string;
    qtyCooked: number;
    qtyRemaining: number;
  }>
> {
  const db = client;

  return db
    .select({
      menuItemId: batchItems.menuItemId,
      menuItemName: menuItems.name,
      qtyCooked: batchItems.qtyCooked,
      qtyRemaining: batchItems.qtyRemaining,
    })
    .from(batchItems)
    .innerJoin(menuItems, eq(batchItems.menuItemId, menuItems.id))
    .where(and(eq(batchItems.batchId, batchId), sql`${batchItems.qtyCooked} > 0`))
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name), asc(menuItems.id));
}

function assertPublishPreconditions(
  eligibility: PublishEligibility,
  inventory: Awaited<ReturnType<typeof orderBatchInventory>>,
): PublishEligibleMember[] {
  if (eligibility.unresolved.length > 0) {
    const member = eligibility.unresolved[0]!;
    throw new Error(
      `Cannot publish: ${formatMemberLabel(member.name, member.email)} has no meals per week set. Update their membership or add a valid meals:N tag.`,
    );
  }

  if (eligibility.eligible.length === 0) {
    throw new Error("Cannot publish: no active memberships.");
  }

  if (inventory.length === 0) {
    throw new Error("Add batch inventory before publishing.");
  }

  return eligibility.eligible;
}

/** Open customer review: create pending orders for each eligible active membership. */
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

  const eligibility = await listPublishEligibleMembers();
  const inventory = await orderBatchInventory(batchId);
  const customers = assertPublishPreconditions(eligibility, inventory);

  const inventoryMenuItemIds = inventory.map((item) => item.menuItemId);

  const menuDetails = await db
    .select({
      id: menuItems.id,
      categoryId: menuItems.categoryId,
      price4ozCents: menuItems.price4ozCents,
      price6ozCents: menuItems.price6ozCents,
    })
    .from(menuItems)
    .where(inArray(menuItems.id, inventoryMenuItemIds));

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

  const existingOrders = await db
    .select({ membershipId: weeklyOrders.membershipId })
    .from(weeklyOrders)
    .where(eq(weeklyOrders.batchId, batchId));

  const existingMembershipIds = new Set(
    existingOrders.map((o) => o.membershipId).filter((id): id is string => id != null),
  );

  let ordersCreated = 0;

  for (const customer of customers) {
    if (existingMembershipIds.has(customer.membershipId)) continue;

    const orderId = randomUUID();
    const pickupWindowId = customer.defaultPickupWindowId ?? batch.pickupWindowId;
    const assignedMeals = assignMealsRoundRobin(customer.mealsPerWeek, inventoryMenuItemIds);

    await db.insert(weeklyOrders).values({
      id: orderId,
      batchId,
      userId: customer.userId,
      membershipId: customer.membershipId,
      status: "pending_customer_review",
      pickupWindowId,
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
    });

    for (const [menuItemId, qty] of assignedMeals) {
      const menuItem = menuById.get(menuItemId);
      if (!menuItem || qty <= 0) continue;

      const category = menuItem.categoryId ? (categoryById.get(menuItem.categoryId) ?? null) : null;
      const portion = customer.portionDefault;
      const unitPriceCents = resolveUnitPriceCents(menuItem, category, portion);

      await db.insert(orderLines).values({
        id: randomUUID(),
        orderId,
        menuItemId,
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

export type OpenMenuForSelectionInput = {
  selectionDeadline: Date;
};

/** Ordered reads/writes inside openMenuForSelection's transaction (documented for tests). */
export const OPEN_MENU_FOR_SELECTION_TX_PLAN = [
  "read_batch",
  "read_eligible_memberships",
  "read_batch_inventory",
  "read_existing_orders",
  "insert_weekly_orders",
  "re_read_batch",
  "update_batch_status_and_selection_deadline",
] as const;

export function validateOpenMenuSelectionDeadline(
  selectionDeadline: Date,
  now: Date = new Date(),
): void {
  if (!(selectionDeadline instanceof Date) || Number.isNaN(selectionDeadline.getTime())) {
    throw new Error("Selection deadline is required.");
  }
  if (selectionDeadline.getTime() <= now.getTime()) {
    throw new Error("Selection deadline must be in the future.");
  }
}

/** Pure idempotency plan: one empty order per membership not yet on the batch (no user dedupe). */
export function planOpenMenuOrderCreates(
  eligible: PublishEligibleMember[],
  existingMembershipIds: ReadonlySet<string>,
): PublishEligibleMember[] {
  return eligible.filter((member) => !existingMembershipIds.has(member.membershipId));
}

/** Open menu for selection: one empty order per eligible active membership (no line items). */
export async function openMenuForSelection(
  batchId: string,
  input: OpenMenuForSelectionInput,
): Promise<{ ordersCreated: number }> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(weeklyBatches)
      .where(eq(weeklyBatches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new Error("Batch not found.");
    }

    if (!PUBLISHABLE_BATCH_STATUSES.includes(batch.status)) {
      throw new Error("Only planning or draft batches can open the menu for selection.");
    }

    validateOpenMenuSelectionDeadline(input.selectionDeadline);

    const eligibility = await listPublishEligibleMembers(tx);
    const inventory = await orderBatchInventory(batchId, tx);

    if (inventory.length === 0) {
      throw new Error("Add at least one batch item before opening selection.");
    }

    if (eligibility.eligible.length === 0) {
      throw new Error(
        "Cannot open selection: no active memberships with resolved meal allowances.",
      );
    }

    const existingOrders = await tx
      .select({ membershipId: weeklyOrders.membershipId })
      .from(weeklyOrders)
      .where(eq(weeklyOrders.batchId, batchId));

    const existingMembershipIds = new Set(
      existingOrders.map((o) => o.membershipId).filter((id): id is string => id != null),
    );

    const customers = planOpenMenuOrderCreates(eligibility.eligible, existingMembershipIds);

    let ordersCreated = 0;

    for (const customer of customers) {
      const pickupWindowId = customer.defaultPickupWindowId ?? batch.pickupWindowId;
      const snapshots = buildSelectionOrderSnapshots(customer);

      await tx.insert(weeklyOrders).values({
        id: randomUUID(),
        batchId,
        userId: customer.userId,
        membershipId: customer.membershipId,
        status: "awaiting_selection",
        pickupWindowId,
        ...snapshots,
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
      });

      ordersCreated += 1;
    }

    const [batchBeforeUpdate] = await tx
      .select({ status: weeklyBatches.status })
      .from(weeklyBatches)
      .where(eq(weeklyBatches.id, batchId))
      .limit(1);

    if (!batchBeforeUpdate || !PUBLISHABLE_BATCH_STATUSES.includes(batchBeforeUpdate.status)) {
      throw new Error("Only planning or draft batches can open the menu for selection.");
    }

    await tx
      .update(weeklyBatches)
      .set({ status: "selection_open", selectionDeadline: input.selectionDeadline })
      .where(eq(weeklyBatches.id, batchId));

    return { ordersCreated };
  });
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
      membershipId: weeklyOrders.membershipId,
      membershipPlanSlug: memberships.planSlug,
      planCategoryName: planCategories.name,
      membershipPaymentSchedule: memberships.paymentSchedule,
      profilePaymentSchedule: customerProfiles.paymentSchedule,
      paymentScheduleSnapshot: weeklyOrders.paymentScheduleSnapshot,
      planSlugSnapshot: weeklyOrders.planSlugSnapshot,
      planNameSnapshot: weeklyOrders.planNameSnapshot,
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
    .leftJoin(memberships, eq(weeklyOrders.membershipId, memberships.id))
    .leftJoin(planCategories, eq(memberships.planSlug, planCategories.slug))
    .leftJoin(pickupWindows, eq(weeklyOrders.pickupWindowId, pickupWindows.id))
    .where(conditions)
    .orderBy(desc(weeklyBatches.weekStart), users.email);

  return rows.map((row) => {
    const planSlug = resolveOrderPlanSlug({
      planSlugSnapshot: row.planSlugSnapshot,
      membershipPlanSlug: row.membershipPlanSlug,
    });
    return {
      id: row.id,
      batchId: row.batchId,
      batchWeekStart: toIsoDateString(row.batchWeekStart) ?? "",
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      status: row.status,
      paymentSchedule: resolveOrderPaymentSchedule({
        paymentScheduleSnapshot: row.paymentScheduleSnapshot,
        membershipPaymentSchedule: row.membershipPaymentSchedule,
        profilePaymentSchedule: row.profilePaymentSchedule,
      }),
      totalCents: row.totalCents,
      itemCount: row.itemCount,
      pickupLabel: row.pickupLabel,
      customerVisibleNote: row.customerVisibleNote,
      reviewDeadline: row.reviewDeadline?.toISOString() ?? null,
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
