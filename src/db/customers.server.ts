import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  AdminCustomerRow,
  AdminDashboardOverview,
  AdminMembershipRow,
  AdminPlanCategoryOption,
  BatchMealDemandRow,
} from "@/orders/admin-types.ts";

import { listAdminBatches, listAdminOrders } from "./batches.server.ts";
import { getDb } from "./index.server.ts";
import { batchItems } from "./schema/batch-items.ts";
import { customerProfiles } from "./schema/customer-profiles.ts";
import type { PortionDefault } from "./schema/customer-profiles.ts";
import { memberships, type MembershipStatus } from "./schema/memberships.ts";
import { menuItems } from "./schema/menu-items.ts";
import { orderLines } from "./schema/order-lines.ts";
import { pickupWindows } from "./schema/pickup-windows.ts";
import { planCategories } from "./schema/plan-categories.ts";
import type { PaymentSchedule } from "./schema/payment-schedules.ts";
import { users } from "./schema/users.ts";
import { weeklyOrders } from "./schema/weekly-orders.ts";

const PLAN_TAG_PREFIX = "plan:";
const MEALS_TAG_PREFIX = "meals:";

export function parsePlanSlugFromTags(tags: string[] | null | undefined): string | null {
  if (!tags?.length) return null;
  const tag = tags.find((t) => t.startsWith(PLAN_TAG_PREFIX));
  return tag ? tag.slice(PLAN_TAG_PREFIX.length) : null;
}

export function parseMealsPerWeekFromTags(tags: string[] | null | undefined): number | null {
  if (!tags?.length) return null;
  const tag = tags.find((t) => t.startsWith(MEALS_TAG_PREFIX));
  if (!tag) return null;
  const value = Number.parseInt(tag.slice(MEALS_TAG_PREFIX.length), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function mergePlanTags(
  existing: string[] | null | undefined,
  planSlug: string | null | undefined,
  mealsPerWeek: number | null | undefined,
): string[] {
  const kept = (existing ?? []).filter(
    (t) => !t.startsWith(PLAN_TAG_PREFIX) && !t.startsWith(MEALS_TAG_PREFIX),
  );
  if (planSlug?.trim()) {
    kept.push(`${PLAN_TAG_PREFIX}${planSlug.trim()}`);
  }
  if (mealsPerWeek != null && mealsPerWeek > 0) {
    kept.push(`${MEALS_TAG_PREFIX}${Math.floor(mealsPerWeek)}`);
  }
  return kept;
}

/** All customer-role users with profile, membership, and order counts. */
export async function listAdminCustomers(): Promise<AdminCustomerRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      membershipId: memberships.id,
      membershipStatus: memberships.status,
      paymentSchedule: customerProfiles.paymentSchedule,
      portionDefault: customerProfiles.portionDefault,
      defaultPickupWindowId: customerProfiles.defaultPickupWindowId,
      pickupLabel: pickupWindows.label,
      chefNotes: customerProfiles.chefNotes,
      dietaryTags: customerProfiles.dietaryTags,
      orderCount: sql<number>`(
        select count(*) from weekly_orders wo where wo.user_id = ${users.id}
      )`.mapWith(Number),
    })
    .from(users)
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .leftJoin(memberships, eq(users.id, memberships.userId))
    .leftJoin(pickupWindows, eq(customerProfiles.defaultPickupWindowId, pickupWindows.id))
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.createdAt));

  const planSlugs = rows
    .map((row) => parsePlanSlugFromTags(row.dietaryTags))
    .filter((slug): slug is string => Boolean(slug));

  const planNamesBySlug = new Map<string, string>();
  if (planSlugs.length > 0) {
    const categories = await db
      .select({ slug: planCategories.slug, name: planCategories.name })
      .from(planCategories)
      .where(inArray(planCategories.slug, [...new Set(planSlugs)]));

    for (const cat of categories) {
      planNamesBySlug.set(cat.slug, cat.name);
    }
  }

  return rows.map((row) => {
    const planSlug = parsePlanSlugFromTags(row.dietaryTags);
    return {
      userId: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      membershipId: row.membershipId,
      membershipStatus: row.membershipStatus,
      paymentSchedule: row.paymentSchedule ?? "weekly_autopay",
      portionDefault: row.portionDefault ?? "6oz",
      defaultPickupWindowId: row.defaultPickupWindowId,
      pickupLabel: row.pickupLabel,
      chefNotes: row.chefNotes,
      planSlug,
      planName: planSlug ? (planNamesBySlug.get(planSlug) ?? planSlug) : null,
      mealsPerWeek: parseMealsPerWeekFromTags(row.dietaryTags),
      orderCount: row.orderCount,
    };
  });
}

/** Active or paused memberships for the memberships admin view. */
export async function listAdminMemberships(): Promise<AdminMembershipRow[]> {
  const customers = await listAdminCustomers();
  return customers
    .filter((c) => c.membershipStatus === "active" || c.membershipStatus === "paused")
    .map((c) => ({
      userId: c.userId,
      email: c.email,
      name: c.name,
      membershipId: c.membershipId,
      membershipStatus: c.membershipStatus ?? "active",
      paymentSchedule: c.paymentSchedule,
      portionDefault: c.portionDefault,
      pickupLabel: c.pickupLabel,
      planSlug: c.planSlug,
      planName: c.planName,
      mealsPerWeek: c.mealsPerWeek,
      chefNotes: c.chefNotes,
    }));
}

export async function listAdminPlanCategories(): Promise<AdminPlanCategoryOption[]> {
  const db = getDb();
  return db
    .select({ slug: planCategories.slug, name: planCategories.name })
    .from(planCategories)
    .where(eq(planCategories.active, true))
    .orderBy(planCategories.sortOrder, planCategories.name);
}

export type CreateAdminCustomerInput = {
  email: string;
  name?: string;
  paymentSchedule?: PaymentSchedule;
  portionDefault?: PortionDefault;
  defaultPickupWindowId?: string;
  planSlug?: string;
  mealsPerWeek?: number;
  chefNotes?: string;
  activateMembership?: boolean;
};

/** Create a customer account by email (password optional — magic link later). */
export async function createAdminCustomer(input: CreateAdminCustomerInput): Promise<string> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    throw new Error(`A user with email ${email} already exists.`);
  }

  const userId = randomUUID();
  const dietaryTags = mergePlanTags([], input.planSlug, input.mealsPerWeek);

  await db.insert(users).values({
    id: userId,
    email,
    name: input.name?.trim() || null,
    role: "customer",
    passwordHash: null,
  });

  await db.insert(customerProfiles).values({
    userId,
    paymentSchedule: input.paymentSchedule ?? "weekly_autopay",
    portionDefault: input.portionDefault ?? "6oz",
    defaultPickupWindowId: input.defaultPickupWindowId ?? null,
    chefNotes: input.chefNotes?.trim() || null,
    dietaryTags: dietaryTags.length > 0 ? dietaryTags : null,
    paymentScheduleSetBy: "admin",
  });

  if (input.activateMembership !== false) {
    await db.insert(memberships).values({
      id: randomUUID(),
      userId,
      status: "active",
    });
  }

  return userId;
}

export type UpdateAdminCustomerInput = {
  userId: string;
  name?: string;
  paymentSchedule?: PaymentSchedule;
  portionDefault?: PortionDefault;
  defaultPickupWindowId?: string | null;
  planSlug?: string | null;
  mealsPerWeek?: number | null;
  chefNotes?: string | null;
  membershipStatus?: MembershipStatus;
};

/** Update customer profile and membership cadence/plan metadata. */
export async function updateAdminCustomer(input: UpdateAdminCustomerInput): Promise<void> {
  const db = getDb();

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user || user.role !== "customer") {
    throw new Error("Customer not found.");
  }

  const [profile] = await db
    .select({ dietaryTags: customerProfiles.dietaryTags })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, input.userId))
    .limit(1);

  if (!profile) {
    throw new Error("Customer profile not found.");
  }

  const nextPlanSlug =
    input.planSlug === undefined ? parsePlanSlugFromTags(profile.dietaryTags) : input.planSlug;
  const nextMealsPerWeek =
    input.mealsPerWeek === undefined
      ? parseMealsPerWeekFromTags(profile.dietaryTags)
      : input.mealsPerWeek;

  const dietaryTags = mergePlanTags(profile.dietaryTags, nextPlanSlug, nextMealsPerWeek);

  await db
    .update(customerProfiles)
    .set({
      ...(input.paymentSchedule !== undefined ? { paymentSchedule: input.paymentSchedule } : {}),
      ...(input.portionDefault !== undefined ? { portionDefault: input.portionDefault } : {}),
      ...(input.defaultPickupWindowId !== undefined
        ? { defaultPickupWindowId: input.defaultPickupWindowId }
        : {}),
      ...(input.chefNotes !== undefined ? { chefNotes: input.chefNotes } : {}),
      dietaryTags: dietaryTags.length > 0 ? dietaryTags : null,
      paymentScheduleSetBy: "admin",
    })
    .where(eq(customerProfiles.userId, input.userId));

  if (input.name !== undefined) {
    await db
      .update(users)
      .set({ name: input.name.trim() || null })
      .where(eq(users.id, input.userId));
  }

  if (input.membershipStatus !== undefined) {
    const [membership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(eq(memberships.userId, input.userId))
      .limit(1);

    if (membership) {
      await db
        .update(memberships)
        .set({ status: input.membershipStatus })
        .where(eq(memberships.id, membership.id));
    } else {
      await db.insert(memberships).values({
        id: randomUUID(),
        userId: input.userId,
        status: input.membershipStatus,
      });
    }
  }
}

/** Aggregate order-line demand vs batch inventory for kitchen prep. */
export async function getBatchMealDemand(batchId: string): Promise<BatchMealDemandRow[]> {
  const db = getDb();

  const demandRows = await db
    .select({
      menuItemId: orderLines.menuItemId,
      menuItemName: sql<string>`max(${menuItems.name})`,
      qtyNeeded: sql<number>`coalesce(sum(${orderLines.qty}), 0)`.mapWith(Number),
    })
    .from(orderLines)
    .innerJoin(weeklyOrders, eq(orderLines.orderId, weeklyOrders.id))
    .innerJoin(menuItems, eq(orderLines.menuItemId, menuItems.id))
    .where(
      and(
        eq(weeklyOrders.batchId, batchId),
        sql`${weeklyOrders.status} not in ('skipped', 'payment_failed')`,
      ),
    )
    .groupBy(orderLines.menuItemId);

  const inventoryRows = await db
    .select({
      menuItemId: batchItems.menuItemId,
      menuItemName: menuItems.name,
      qtyCooked: batchItems.qtyCooked,
      qtyRemaining: batchItems.qtyRemaining,
    })
    .from(batchItems)
    .innerJoin(menuItems, eq(batchItems.menuItemId, menuItems.id))
    .where(eq(batchItems.batchId, batchId));

  const inventoryByItem = new Map(inventoryRows.map((row) => [row.menuItemId, row]));
  const itemIds = new Set([
    ...demandRows.map((r) => r.menuItemId),
    ...inventoryRows.map((r) => r.menuItemId),
  ]);

  const results: BatchMealDemandRow[] = [];

  for (const menuItemId of itemIds) {
    const demand = demandRows.find((r) => r.menuItemId === menuItemId);
    const inventory = inventoryByItem.get(menuItemId);
    results.push({
      menuItemId,
      menuItemName: demand?.menuItemName ?? inventory?.menuItemName ?? "Unknown item",
      qtyNeeded: demand?.qtyNeeded ?? 0,
      qtyCooked: inventory?.qtyCooked ?? 0,
      qtyRemaining: inventory?.qtyRemaining ?? 0,
    });
  }

  return results.sort((a, b) => a.menuItemName.localeCompare(b.menuItemName));
}

/** Dashboard KPIs, recent orders, and prep totals for the current batch. */
export async function getAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  const db = getDb();
  const batches = await listAdminBatches();
  const currentBatch = batches.find((b) => b.status !== "closed") ?? batches[0] ?? null;

  const [reviewRow] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(weeklyOrders)
    .where(inArray(weeklyOrders.status, ["pending_customer_review", "changes_requested"]));

  const [memberRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(memberships)
    .where(eq(memberships.status, "active"));

  const [customerRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(eq(users.role, "customer"));

  const recentOrders = await listAdminOrders(currentBatch?.id);
  const prepTotals = currentBatch ? await getBatchMealDemand(currentBatch.id) : [];
  const activeCustomers = await listAdminMemberships();

  return {
    currentBatch,
    reviewQueueCount: reviewRow?.count ?? 0,
    activeMemberCount: memberRow?.count ?? 0,
    customerCount: customerRow?.count ?? 0,
    recentOrders: recentOrders.slice(0, 8),
    prepTotals: prepTotals.filter((row) => row.qtyNeeded > 0 || row.qtyCooked > 0).slice(0, 12),
    upcomingCustomers: activeCustomers.slice(0, 8),
  };
}
