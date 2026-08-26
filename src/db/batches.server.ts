import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  AdminBatchInventoryRow,
  AdminBatchSummary,
  AdminMenuItemOption,
  AdminOrderRow,
  AdminPickupWindowOption,
} from "@/orders/admin-types.ts";

import { toIsoDateString, toIsoDateTimeString } from "@/lib/dates.ts";
import {
  sumMemberDraftOrderMeals,
  validateMemberDraftOrderMeals,
} from "@/lib/member-draft-validation.ts";
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

async function recalculateOrderTotals(orderId: string, client: DbClient = getDb()): Promise<void> {
  const lines = await client
    .select({
      qty: orderLines.qty,
      unitPriceCents: orderLines.unitPriceCents,
    })
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId));

  const subtotalCents = lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
  await client
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
    reviewDeadline: toIsoDateTimeString(row.reviewDeadline),
    selectionDeadline: toIsoDateTimeString(row.selectionDeadline),
    chargeScheduledAt: toIsoDateTimeString(row.chargeScheduledAt),
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
  menuItemIds: string[];
};

/** Create a planning batch with catalog items for the given dates (no planned quantities). */
export async function createWeeklyBatch(input: CreateWeeklyBatchInput): Promise<string> {
  const db = getDb();
  const weekStart = new Date(`${input.batchDate}T12:00:00`);
  const pickupDate = new Date(`${input.pickupDate}T12:00:00`);

  if (Number.isNaN(weekStart.getTime()) || Number.isNaN(pickupDate.getTime())) {
    throw new Error("Invalid batch or pickup date.");
  }

  const uniqueMenuItemIds = [...new Set(input.menuItemIds)];
  if (uniqueMenuItemIds.length === 0) {
    throw new Error("Add at least one menu item to the batch.");
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

  const validMenuItems = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.active, true), inArray(menuItems.id, uniqueMenuItemIds)));

  const catalogMenuItemIds = validMenuItems.map((m) => m.id);
  if (catalogMenuItemIds.length === 0) {
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

    for (const menuItemId of catalogMenuItemIds) {
      await tx.insert(batchItems).values({
        id: randomUUID(),
        batchId: id,
        menuItemId,
        qtyCooked: 0,
        qtyRemaining: 0,
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

export type SaveBatchCatalogInput = {
  batchId: string;
  menuItemIds: string[];
};

/** Sync batch catalog items (add/remove menu items; planned qty set when orders are generated). */
export async function saveBatchCatalog(input: SaveBatchCatalogInput): Promise<void> {
  const { batchId } = input;
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
    throw new Error("Batch items can only be edited while the batch is in planning or draft.");
  }

  const menuItemIds = [...new Set(input.menuItemIds)];
  if (menuItemIds.length === 0) {
    throw new Error("Select at least one menu item for this batch.");
  }

  const validMenuItems = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.active, true), inArray(menuItems.id, menuItemIds)));

  const desiredIds = new Set(validMenuItems.map((m) => m.id));

  const existingRows = await db
    .select({ id: batchItems.id, menuItemId: batchItems.menuItemId })
    .from(batchItems)
    .where(eq(batchItems.batchId, batchId));

  const existingByMenuItem = new Map(existingRows.map((r) => [r.menuItemId, r.id]));

  for (const menuItemId of desiredIds) {
    if (existingByMenuItem.has(menuItemId)) continue;
    await db.insert(batchItems).values({
      id: randomUUID(),
      batchId,
      menuItemId,
      qtyCooked: 0,
      qtyRemaining: 0,
    });
  }

  for (const row of existingRows) {
    if (desiredIds.has(row.menuItemId)) continue;
    await db.delete(batchItems).where(eq(batchItems.id, row.id));
  }
}

/** @deprecated Use saveBatchCatalog — kept as alias for callers migrating from qty-based saves. */
export async function saveBatchInventory(input: SaveBatchCatalogInput): Promise<void> {
  return saveBatchCatalog(input);
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
  profilePaymentSchedule: PaymentSchedule | null;
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
      profilePaymentSchedule: row.profilePaymentSchedule ?? "weekly_autopay",
      defaultPickupWindowId: row.defaultPickupWindowId,
    });
  }

  return { eligible, unresolved };
}

export type BatchPlanningMember = {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  planName: string | null;
  mealsPerWeek: number;
  portionDefault: Portion;
  lastOrderedDate: string | null;
};

/** Active eligible members sorted by oldest last order first (never-ordered first). */
export async function listBatchPlanningMembers(
  client: DbClient = getDb(),
): Promise<BatchPlanningMember[]> {
  const db = client;
  const { eligible } = await listPublishEligibleMembers(db);
  if (eligible.length === 0) return [];

  const userIds = [...new Set(eligible.map((member) => member.userId))];
  const lastOrderRows = await db
    .select({
      userId: weeklyOrders.userId,
      lastOrderedDate: sql<Date>`max(${weeklyBatches.weekStart})`,
    })
    .from(weeklyOrders)
    .innerJoin(weeklyBatches, eq(weeklyOrders.batchId, weeklyBatches.id))
    .where(inArray(weeklyOrders.userId, userIds))
    .groupBy(weeklyOrders.userId);

  const lastOrderByUser = new Map(
    lastOrderRows.map((row) => [row.userId, toIsoDateString(row.lastOrderedDate)]),
  );

  const members = eligible.map((member) => ({
    membershipId: member.membershipId,
    userId: member.userId,
    email: member.email,
    name: member.name,
    planName: member.planName,
    mealsPerWeek: member.mealsPerWeek,
    portionDefault: member.portionDefault,
    lastOrderedDate: lastOrderByUser.get(member.userId) ?? null,
  }));

  return members.sort((a, b) => {
    if (a.lastOrderedDate === b.lastOrderedDate) {
      const labelA = a.name?.trim() || a.email;
      const labelB = b.name?.trim() || b.email;
      return labelA.localeCompare(labelB);
    }
    if (!a.lastOrderedDate) return -1;
    if (!b.lastOrderedDate) return 1;
    return a.lastOrderedDate.localeCompare(b.lastOrderedDate);
  });
}

/** Most recent batch_items.created_at per menu item across all batches. */
export async function getMenuItemsLastBatchAdded(): Promise<
  Array<{ menuItemId: string; lastAddedAt: string | null }>
> {
  const db = getDb();
  const rows = await db
    .select({
      menuItemId: batchItems.menuItemId,
      lastAddedAt: sql<Date>`max(${batchItems.createdAt})`,
    })
    .from(batchItems)
    .groupBy(batchItems.menuItemId);

  return rows.map((row) => ({
    menuItemId: row.menuItemId,
    lastAddedAt: toIsoDateTimeString(row.lastAddedAt),
  }));
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
    .leftJoin(customerProfiles, eq(memberships.userId, customerProfiles.userId))
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
    .where(eq(batchItems.batchId, batchId))
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

export type BatchDraftOrderSummary = {
  orderId: string;
  membershipId: string;
  userId: string;
  customerName: string | null;
  customerEmail: string;
  mealCount: number;
  lineCount: number;
};

export type BatchMemberDraftLine = {
  menuItemId: string;
  menuItemName: string;
  qty: number;
  portion: Portion;
  unitPriceCents: number;
};

export type BatchMemberDraftOrder = {
  orderId: string | null;
  membershipId: string;
  lines: BatchMemberDraftLine[];
};

export type GenerateBatchOrdersValidationIssue = {
  membershipId: string;
  memberLabel: string;
  message: string;
};

export type ValidateGenerateBatchOrderInput = {
  membershipId: string;
  memberLabel: string;
  planSlug: string | null;
  mealsPerWeek: number | null;
  lines: Array<{ menuItemName: string; qty: number; unitPriceCents: number }>;
};

/** Pure validation for Generate Orders — every line priced, every member has plan and meals. */
export function validateGenerateBatchOrders(
  orders: ValidateGenerateBatchOrderInput[],
): GenerateBatchOrdersValidationIssue[] {
  const issues: GenerateBatchOrdersValidationIssue[] = [];

  for (const order of orders) {
    if (!order.planSlug) {
      issues.push({
        membershipId: order.membershipId,
        memberLabel: order.memberLabel,
        message: "Missing membership plan — assign a plan before generating orders.",
      });
    }

    if (order.mealsPerWeek == null || order.mealsPerWeek <= 0) {
      issues.push({
        membershipId: order.membershipId,
        memberLabel: order.memberLabel,
        message: "Missing meals per week — set meals on the membership before generating orders.",
      });
    }

    for (const line of order.lines) {
      if (line.qty > 0 && line.unitPriceCents <= 0) {
        issues.push({
          membershipId: order.membershipId,
          memberLabel: order.memberLabel,
          message: `${line.menuItemName} has no price for this member's portion.`,
        });
      }
    }
  }

  return issues;
}

async function loadBatchMenuPricing(batchId: string, client: DbClient = getDb()) {
  const catalog = await orderBatchInventory(batchId, client);
  const menuItemIds = catalog.map((item) => item.menuItemId);
  if (menuItemIds.length === 0) {
    return {
      catalog,
      menuById: new Map<
        string,
        {
          id: string;
          categoryId: string | null;
          price4ozCents: number | null;
          price6ozCents: number | null;
        }
      >(),
      categoryById: new Map<string, { price4ozCents: number; price6ozCents: number }>(),
    };
  }

  const menuDetails = await client
    .select({
      id: menuItems.id,
      categoryId: menuItems.categoryId,
      price4ozCents: menuItems.price4ozCents,
      price6ozCents: menuItems.price6ozCents,
    })
    .from(menuItems)
    .where(inArray(menuItems.id, menuItemIds));

  const categoryIds = menuDetails.map((m) => m.categoryId).filter(Boolean) as string[];
  const categories =
    categoryIds.length > 0
      ? await client
          .select({
            id: planCategories.id,
            price4ozCents: planCategories.price4ozCents,
            price6ozCents: planCategories.price6ozCents,
          })
          .from(planCategories)
          .where(inArray(planCategories.id, categoryIds))
      : [];

  return {
    catalog,
    menuById: new Map(menuDetails.map((m) => [m.id, m])),
    categoryById: new Map(categories.map((c) => [c.id, c])),
  };
}

/** Draft order summaries for a batch (status = draft with at least one line). */
export async function listBatchDraftOrderSummaries(
  batchId: string,
): Promise<BatchDraftOrderSummary[]> {
  const db = getDb();

  const rows = await db
    .select({
      orderId: weeklyOrders.id,
      membershipId: weeklyOrders.membershipId,
      userId: weeklyOrders.userId,
      customerName: users.name,
      customerEmail: users.email,
      mealCount: sql<number>`coalesce((
        select sum(ol.qty) from order_lines ol where ol.order_id = ${weeklyOrders.id}
      ), 0)`.mapWith(Number),
      lineCount: sql<number>`coalesce((
        select count(*) from order_lines ol where ol.order_id = ${weeklyOrders.id} and ol.qty > 0
      ), 0)`.mapWith(Number),
    })
    .from(weeklyOrders)
    .innerJoin(users, eq(weeklyOrders.userId, users.id))
    .where(and(eq(weeklyOrders.batchId, batchId), eq(weeklyOrders.status, "draft")));

  return rows
    .filter((row) => row.membershipId != null && row.lineCount > 0)
    .map((row) => ({
      orderId: row.orderId,
      membershipId: row.membershipId!,
      userId: row.userId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      mealCount: row.mealCount,
      lineCount: row.lineCount,
    }));
}

/** Load or initialize a per-member draft order for batch order-building. */
export async function getBatchMemberDraftOrder(
  batchId: string,
  membershipId: string,
): Promise<BatchMemberDraftOrder> {
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
    throw new Error("Draft orders can only be edited while the batch is in planning or draft.");
  }

  const { catalog, menuById, categoryById } = await loadBatchMenuPricing(batchId, db);
  const catalogIds = new Set(catalog.map((item) => item.menuItemId));

  const eligibility = await listPublishEligibleMembers(db);
  const member = eligibility.eligible.find((m) => m.membershipId === membershipId);
  if (!member) {
    throw new Error("Member is not eligible for this batch.");
  }

  const [existingOrder] = await db
    .select({ id: weeklyOrders.id })
    .from(weeklyOrders)
    .where(
      and(
        eq(weeklyOrders.batchId, batchId),
        eq(weeklyOrders.membershipId, membershipId),
        eq(weeklyOrders.status, "draft"),
      ),
    )
    .limit(1);

  const existingLines =
    existingOrder != null
      ? await db
          .select({
            menuItemId: orderLines.menuItemId,
            menuItemName: menuItems.name,
            qty: orderLines.qty,
            portion: orderLines.portion,
            unitPriceCents: orderLines.unitPriceCents,
          })
          .from(orderLines)
          .innerJoin(menuItems, eq(orderLines.menuItemId, menuItems.id))
          .where(eq(orderLines.orderId, existingOrder.id))
      : [];

  const linesByMenuItem = new Map(existingLines.map((line) => [line.menuItemId, line]));

  const lines: BatchMemberDraftLine[] = catalog.map((item) => {
    const existing = linesByMenuItem.get(item.menuItemId);
    const menuItem = menuById.get(item.menuItemId);
    const category = menuItem?.categoryId ? (categoryById.get(menuItem.categoryId) ?? null) : null;
    const portion = member.portionDefault;
    const unitPriceCents = menuItem
      ? resolveUnitPriceCents(menuItem, category, portion)
      : (existing?.unitPriceCents ?? 0);

    return {
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      qty: existing?.qty ?? 0,
      portion,
      unitPriceCents: existing?.unitPriceCents ?? unitPriceCents,
    };
  });

  return {
    orderId: existingOrder?.id ?? null,
    membershipId,
    lines: lines.filter((line) => catalogIds.has(line.menuItemId)),
  };
}

export type SaveBatchMemberDraftOrderInput = {
  batchId: string;
  membershipId: string;
  lines: Array<{ menuItemId: string; qty: number }>;
};

/** Upsert a draft weekly order for one membership (incremental order-building). */
export async function saveBatchMemberDraftOrder(
  input: SaveBatchMemberDraftOrderInput,
): Promise<void> {
  const db = getDb();
  const { batchId, membershipId } = input;

  const [batch] = await db
    .select({ status: weeklyBatches.status, pickupWindowId: weeklyBatches.pickupWindowId })
    .from(weeklyBatches)
    .where(eq(weeklyBatches.id, batchId))
    .limit(1);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  if (!PUBLISHABLE_BATCH_STATUSES.includes(batch.status)) {
    throw new Error("Draft orders can only be saved while the batch is in planning or draft.");
  }

  const { catalog, menuById, categoryById } = await loadBatchMenuPricing(batchId, db);
  const catalogIds = new Set(catalog.map((item) => item.menuItemId));

  const eligibility = await listPublishEligibleMembers(db);
  const member = eligibility.eligible.find((m) => m.membershipId === membershipId);
  if (!member) {
    throw new Error("Member is not eligible for this batch.");
  }

  const normalizedLines = input.lines
    .map((line) => ({
      menuItemId: line.menuItemId,
      qty: Math.max(0, Math.min(999, Math.floor(line.qty))),
    }))
    .filter((line) => catalogIds.has(line.menuItemId) && line.qty > 0);

  const [existingOrder] = await db
    .select({ id: weeklyOrders.id, status: weeklyOrders.status })
    .from(weeklyOrders)
    .where(and(eq(weeklyOrders.batchId, batchId), eq(weeklyOrders.membershipId, membershipId)))
    .limit(1);

  if (existingOrder?.id && existingOrder.status !== "draft") {
    throw new Error("This member already has a finalized order for this batch.");
  }

  validateMemberDraftOrderMeals(sumMemberDraftOrderMeals(normalizedLines), member.mealsPerWeek);

  const orderId = existingOrder?.id ?? randomUUID();
  const pickupWindowId = member.defaultPickupWindowId ?? batch.pickupWindowId;
  const portion = member.portionDefault;

  await db.transaction(async (tx) => {
    if (!existingOrder?.id) {
      await tx.insert(weeklyOrders).values({
        id: orderId,
        batchId,
        userId: member.userId,
        membershipId,
        status: "draft",
        pickupWindowId,
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
      });
    }

    await tx.delete(orderLines).where(eq(orderLines.orderId, orderId));

    for (const line of normalizedLines) {
      const menuItem = menuById.get(line.menuItemId);
      if (!menuItem) continue;
      const category = menuItem.categoryId ? (categoryById.get(menuItem.categoryId) ?? null) : null;
      const unitPriceCents = resolveUnitPriceCents(menuItem, category, portion);

      await tx.insert(orderLines).values({
        id: randomUUID(),
        orderId,
        menuItemId: line.menuItemId,
        portion,
        qty: line.qty,
        unitPriceCents,
        source: "chef_assigned",
      });
    }

    await recalculateOrderTotals(orderId, tx);
  });
}

async function syncBatchInventoryFromOrders(
  batchId: string,
  client: DbClient = getDb(),
): Promise<void> {
  const demandRows = await client
    .select({
      menuItemId: orderLines.menuItemId,
      qtyNeeded: sql<number>`coalesce(sum(${orderLines.qty}), 0)`.mapWith(Number),
    })
    .from(orderLines)
    .innerJoin(weeklyOrders, eq(orderLines.orderId, weeklyOrders.id))
    .where(
      and(
        eq(weeklyOrders.batchId, batchId),
        sql`${weeklyOrders.status} not in ('draft', 'skipped', 'payment_failed')`,
      ),
    )
    .groupBy(orderLines.menuItemId);

  const existingRows = await client
    .select({ id: batchItems.id, menuItemId: batchItems.menuItemId })
    .from(batchItems)
    .where(eq(batchItems.batchId, batchId));

  const demandByItem = new Map(demandRows.map((row) => [row.menuItemId, row.qtyNeeded]));

  for (const row of existingRows) {
    const qty = demandByItem.get(row.menuItemId) ?? 0;
    await client
      .update(batchItems)
      .set({ qtyCooked: qty, qtyRemaining: qty })
      .where(eq(batchItems.id, row.id));
  }
}

/** Finalize draft orders: validate pricing/plans, promote to customer review, sync batch inventory. */
export async function generateBatchOrdersFromDrafts(
  batchId: string,
): Promise<{ ordersGenerated: number }> {
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
    throw new Error("Orders can only be generated while the batch is in planning or draft.");
  }

  const draftOrders = await db
    .select({
      orderId: weeklyOrders.id,
      membershipId: weeklyOrders.membershipId,
      userId: weeklyOrders.userId,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(weeklyOrders)
    .innerJoin(users, eq(weeklyOrders.userId, users.id))
    .where(and(eq(weeklyOrders.batchId, batchId), eq(weeklyOrders.status, "draft")));

  const draftsWithLines: Array<{
    orderId: string;
    membershipId: string;
    member: PublishEligibleMember;
    memberLabel: string;
    lines: Array<{ menuItemName: string; qty: number; unitPriceCents: number }>;
  }> = [];

  const eligibility = await listPublishEligibleMembers(db);
  const memberById = new Map(eligibility.eligible.map((m) => [m.membershipId, m]));

  for (const draft of draftOrders) {
    if (!draft.membershipId) continue;

    const lines = await db
      .select({
        menuItemName: menuItems.name,
        qty: orderLines.qty,
        unitPriceCents: orderLines.unitPriceCents,
      })
      .from(orderLines)
      .innerJoin(menuItems, eq(orderLines.menuItemId, menuItems.id))
      .where(eq(orderLines.orderId, draft.orderId));

    const activeLines = lines.filter((line) => line.qty > 0);
    if (activeLines.length === 0) continue;

    const member = memberById.get(draft.membershipId);
    if (!member) {
      throw new Error(
        `Cannot generate orders: ${formatMemberLabel(draft.customerName, draft.customerEmail)} is no longer eligible.`,
      );
    }

    draftsWithLines.push({
      orderId: draft.orderId,
      membershipId: draft.membershipId,
      member,
      memberLabel: formatMemberLabel(draft.customerName, draft.customerEmail),
      lines: activeLines,
    });
  }

  if (draftsWithLines.length === 0) {
    throw new Error("No saved draft orders with items — build at least one member order first.");
  }

  const validationIssues = validateGenerateBatchOrders(
    draftsWithLines.map((draft) => ({
      membershipId: draft.membershipId,
      memberLabel: draft.memberLabel,
      planSlug: draft.member.planSlug,
      mealsPerWeek: draft.member.mealsPerWeek,
      lines: draft.lines,
    })),
  );

  if (validationIssues.length > 0) {
    const preview = validationIssues
      .slice(0, 5)
      .map((issue) => `${issue.memberLabel}: ${issue.message}`)
      .join(" ");
    const suffix = validationIssues.length > 5 ? ` (+${validationIssues.length - 5} more)` : "";
    throw new Error(`Cannot generate orders — ${preview}${suffix}`);
  }

  await db.transaction(async (tx) => {
    for (const draft of draftsWithLines) {
      const snapshots = buildSelectionOrderSnapshots(draft.member);
      await tx
        .update(weeklyOrders)
        .set({
          status: "pending_customer_review",
          ...snapshots,
        })
        .where(eq(weeklyOrders.id, draft.orderId));
      await recalculateOrderTotals(draft.orderId, tx);
    }

    await syncBatchInventoryFromOrders(batchId, tx);
  });

  return { ordersGenerated: draftsWithLines.length };
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
      reviewDeadline: toIsoDateTimeString(row.reviewDeadline),
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
