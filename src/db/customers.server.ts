import { randomUUID } from "node:crypto";

import { parseISO } from "date-fns";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  AdminCustomerRow,
  AdminDashboardOverview,
  AdminMembershipRow,
  AdminPlanCategoryOption,
  BatchMealDemandRow,
} from "@/orders/admin-types.ts";
import { isMembershipBatchEligible } from "@/orders/admin-types.ts";
import { toIsoDateString } from "@/lib/dates.ts";

import { listAdminBatches, listAdminOrders } from "./batches.server.ts";
import { getDb } from "./index.server.ts";
import { batchItems } from "./schema/batch-items.ts";
import { customerProfiles } from "./schema/customer-profiles.ts";
import type { PortionDefault } from "./schema/customer-profiles.ts";
import type { BillingProfile, MembershipStatus } from "./schema/memberships.ts";
import { memberships } from "./schema/memberships.ts";
import { menuItems } from "./schema/menu-items.ts";
import { orderLines } from "./schema/order-lines.ts";
import { pickupWindows } from "./schema/pickup-windows.ts";
import { planCategories } from "./schema/plan-categories.ts";
import type { PaymentSchedule } from "./schema/payment-schedules.ts";
import { users } from "./schema/users.ts";
import { weeklyOrders } from "./schema/weekly-orders.ts";

const PLAN_TAG_PREFIX = "plan:";
const MEALS_TAG_PREFIX = "meals:";
const RESERVED_TAG_PREFIX = /^(plan|meals):/i;

function isReservedDietaryTag(tag: string): boolean {
  return RESERVED_TAG_PREFIX.test(tag.trim());
}

export function displayDietaryTags(tags: string[] | null | undefined): string[] {
  return (tags ?? []).filter((t) => !isReservedDietaryTag(t));
}

export function normalizeUserDietaryTags(tags: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags ?? []) {
    const tag = raw.trim();
    if (!tag) continue;
    if (isReservedDietaryTag(tag)) {
      throw new Error('Dietary tags cannot use reserved "plan:" or "meals:" prefixes.');
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }

  return result;
}

function mergeProfileDietaryTags(
  existing: string[] | null | undefined,
  userTags: string[],
): string[] {
  const reservedTags = (existing ?? []).filter(isReservedDietaryTag);
  return [...userTags, ...reservedTags];
}

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

type Db = ReturnType<typeof getDb>;

async function assertValidPlanSlug(db: Db, planSlug: string | null | undefined): Promise<void> {
  const slug = planSlug?.trim();
  if (!slug) return;

  const [category] = await db
    .select({ slug: planCategories.slug })
    .from(planCategories)
    .where(and(eq(planCategories.slug, slug), eq(planCategories.active, true)))
    .limit(1);

  if (!category) {
    throw new Error(`Plan "${slug}" is not an active plan category.`);
  }
}

async function assertNoBlockingMembership(
  db: Db,
  userId: string,
  excludeMembershipId?: string,
): Promise<void> {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), inArray(memberships.status, ["active", "paused"])));

  const blocking = rows.filter((row) => row.id !== excludeMembershipId);
  if (blocking.length > 0) {
    throw new Error(
      "Customer already has an active or paused membership. Cancel or resume the existing one first.",
    );
  }
}

function assertPauseDateNotInPast(isoDate: string): void {
  const normalized = toIsoDateString(isoDate);
  if (!normalized) {
    throw new Error("Invalid pause date format. Use YYYY-MM-DD.");
  }

  const today = toIsoDateString(new Date());
  if (today && normalized < today) {
    throw new Error("Pause until date must be today or later.");
  }
}

function parsePausedUntilDate(isoDate: string): Date {
  const normalized = toIsoDateString(isoDate);
  if (!normalized) {
    throw new Error("Invalid pause date format. Use YYYY-MM-DD.");
  }

  return parseISO(`${normalized}T12:00:00`);
}

/** All customer-role users with profile and order counts (membership joined separately). */
export async function listAdminCustomers(): Promise<AdminCustomerRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      paymentSchedule: customerProfiles.paymentSchedule,
      portionDefault: customerProfiles.portionDefault,
      phone: customerProfiles.phone,
      allergies: customerProfiles.allergies,
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
    .leftJoin(pickupWindows, eq(customerProfiles.defaultPickupWindowId, pickupWindows.id))
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.createdAt));

  const membershipRows =
    rows.length === 0
      ? []
      : await db
          .select({
            id: memberships.id,
            userId: memberships.userId,
            status: memberships.status,
            updatedAt: memberships.updatedAt,
          })
          .from(memberships)
          .where(
            inArray(
              memberships.userId,
              rows.map((row) => row.userId),
            ),
          )
          .orderBy(desc(memberships.updatedAt));

  const membershipStatusRank: Record<MembershipStatus, number> = {
    active: 0,
    paused: 1,
    cancelled: 2,
  };
  const sortedMembershipRows = [...membershipRows].sort((a, b) => {
    const rankDiff = membershipStatusRank[a.status] - membershipStatusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const primaryMembershipByUser = new Map<
    string,
    { membershipId: string; membershipStatus: MembershipStatus }
  >();
  for (const membership of sortedMembershipRows) {
    if (primaryMembershipByUser.has(membership.userId)) continue;
    primaryMembershipByUser.set(membership.userId, {
      membershipId: membership.id,
      membershipStatus: membership.status,
    });
  }

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
    const primaryMembership = primaryMembershipByUser.get(row.userId);
    return {
      userId: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      phone: row.phone,
      allergies: row.allergies,
      dietaryTags: displayDietaryTags(row.dietaryTags),
      membershipId: primaryMembership?.membershipId ?? null,
      membershipStatus: primaryMembership?.membershipStatus ?? null,
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

/** All memberships for the admin memberships view. */
export async function listAdminMemberships(): Promise<AdminMembershipRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      email: users.email,
      name: users.name,
      membershipStatus: memberships.status,
      pausedUntil: memberships.pausedUntil,
      paymentSchedule: memberships.paymentSchedule,
      portionDefault: memberships.portionDefault,
      planSlug: memberships.planSlug,
      mealsPerWeek: memberships.mealsPerWeek,
      billingProfile: memberships.billingProfile,
      fixedPricePerMealCents: memberships.fixedPricePerMealCents,
      discountCents: memberships.discountCents,
      dietaryTags: customerProfiles.dietaryTags,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .orderBy(desc(memberships.updatedAt));

  const planSlugs = rows
    .map((row) => row.planSlug ?? parsePlanSlugFromTags(row.dietaryTags))
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
    const planSlug = row.planSlug ?? parsePlanSlugFromTags(row.dietaryTags);
    const pausedUntil = toIsoDateString(row.pausedUntil);
    return {
      membershipId: row.membershipId,
      userId: row.userId,
      email: row.email,
      name: row.name,
      membershipStatus: row.membershipStatus,
      pausedUntil,
      batchEligible: isMembershipBatchEligible(row.membershipStatus),
      paymentSchedule: row.paymentSchedule,
      portionDefault: row.portionDefault,
      planSlug,
      planName: planSlug ? (planNamesBySlug.get(planSlug) ?? planSlug) : null,
      mealsPerWeek: row.mealsPerWeek ?? parseMealsPerWeekFromTags(row.dietaryTags),
      billingProfile: row.billingProfile,
      fixedPricePerMealCents: row.fixedPricePerMealCents,
      discountCents: row.discountCents,
    };
  });
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
  phone?: string;
  allergies?: string;
  dietaryTags?: string[];
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
  const userTags = normalizeUserDietaryTags(input.dietaryTags ?? []);
  const dietaryTags = mergePlanTags(userTags, input.planSlug, input.mealsPerWeek);

  await db.insert(users).values({
    id: userId,
    email,
    name: input.name?.trim() || null,
    role: "customer",
    passwordHash: null,
  });

  await db.insert(customerProfiles).values({
    userId,
    phone: input.phone?.trim() || null,
    allergies: input.allergies?.trim() || null,
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
      planSlug: input.planSlug?.trim() || null,
      mealsPerWeek: input.mealsPerWeek ?? null,
      portionDefault: input.portionDefault ?? "6oz",
      paymentSchedule: input.paymentSchedule ?? "weekly_autopay",
    });
  }

  return userId;
}

export type UpdateAdminCustomerInput = {
  userId: string;
  email?: string;
  name?: string;
  phone?: string | null;
  allergies?: string | null;
  dietaryTags?: string[];
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

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    const [existingEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail && existingEmail.id !== input.userId) {
      throw new Error(`A user with email ${email} already exists.`);
    }

    await db.update(users).set({ email }).where(eq(users.id, input.userId));
  }

  const profileUpdates: {
    paymentSchedule?: PaymentSchedule;
    portionDefault?: PortionDefault;
    phone?: string | null;
    allergies?: string | null;
    defaultPickupWindowId?: string | null;
    chefNotes?: string | null;
    dietaryTags?: string[] | null;
    paymentScheduleSetBy: "admin";
  } = { paymentScheduleSetBy: "admin" };

  if (input.paymentSchedule !== undefined) {
    profileUpdates.paymentSchedule = input.paymentSchedule;
  }
  if (input.portionDefault !== undefined) {
    profileUpdates.portionDefault = input.portionDefault;
  }
  if (input.phone !== undefined) {
    profileUpdates.phone = input.phone?.trim() || null;
  }
  if (input.allergies !== undefined) {
    profileUpdates.allergies = input.allergies?.trim() || null;
  }
  if (input.defaultPickupWindowId !== undefined) {
    profileUpdates.defaultPickupWindowId = input.defaultPickupWindowId;
  }
  if (input.chefNotes !== undefined) {
    profileUpdates.chefNotes = input.chefNotes;
  }

  if (input.dietaryTags !== undefined) {
    const userTags = normalizeUserDietaryTags(input.dietaryTags);
    const merged = mergeProfileDietaryTags(profile.dietaryTags, userTags);
    profileUpdates.dietaryTags = merged.length > 0 ? merged : null;
  } else if (input.planSlug !== undefined || input.mealsPerWeek !== undefined) {
    const nextPlanSlug =
      input.planSlug === undefined ? parsePlanSlugFromTags(profile.dietaryTags) : input.planSlug;
    const nextMealsPerWeek =
      input.mealsPerWeek === undefined
        ? parseMealsPerWeekFromTags(profile.dietaryTags)
        : input.mealsPerWeek;
    const merged = mergePlanTags(profile.dietaryTags, nextPlanSlug, nextMealsPerWeek);
    profileUpdates.dietaryTags = merged.length > 0 ? merged : null;
  }

  const { paymentScheduleSetBy: _, ...setFields } = profileUpdates;
  if (Object.keys(setFields).length > 0) {
    await db
      .update(customerProfiles)
      .set(profileUpdates)
      .where(eq(customerProfiles.userId, input.userId));
  }

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
      .where(
        and(
          eq(memberships.userId, input.userId),
          inArray(memberships.status, ["active", "paused", "cancelled"]),
        ),
      )
      .orderBy(desc(memberships.updatedAt))
      .limit(1);

    if (input.membershipStatus === "active" || input.membershipStatus === "paused") {
      await assertNoBlockingMembership(db, input.userId, membership?.id);
    }

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
        portionDefault: input.portionDefault ?? "6oz",
        paymentSchedule: input.paymentSchedule ?? "weekly_autopay",
        planSlug: input.planSlug?.trim() || null,
        mealsPerWeek: input.mealsPerWeek ?? null,
      });
    }
  }
}

export type CreateAdminMembershipInput = {
  userId: string;
  planSlug?: string;
  mealsPerWeek?: number;
  portionDefault?: PortionDefault;
  paymentSchedule?: PaymentSchedule;
  billingProfile?: BillingProfile;
  fixedPricePerMealCents?: number;
  discountCents?: number;
};

/** Create a new membership for an existing customer (supports multiple per customer). */
export async function createAdminMembership(input: CreateAdminMembershipInput): Promise<string> {
  const db = getDb();

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user || user.role !== "customer") {
    throw new Error("Customer not found.");
  }

  await assertNoBlockingMembership(db, input.userId);
  await assertValidPlanSlug(db, input.planSlug?.trim() || null);

  const billingProfile = input.billingProfile ?? "catalog";
  if (
    billingProfile === "fixed_price" &&
    (input.fixedPricePerMealCents == null || input.fixedPricePerMealCents <= 0)
  ) {
    throw new Error("Fixed price per meal is required for fixed price billing.");
  }

  const membershipId = randomUUID();

  await db.insert(memberships).values({
    id: membershipId,
    userId: input.userId,
    status: "active",
    planSlug: input.planSlug?.trim() || null,
    mealsPerWeek: input.mealsPerWeek ?? null,
    portionDefault: input.portionDefault ?? "6oz",
    paymentSchedule: input.paymentSchedule ?? "weekly_autopay",
    billingProfile,
    fixedPricePerMealCents:
      billingProfile === "fixed_price" ? (input.fixedPricePerMealCents ?? null) : null,
    discountCents: input.discountCents ?? 0,
  });

  return membershipId;
}

export type UpdateAdminMembershipInput = {
  membershipId: string;
  membershipStatus?: MembershipStatus;
  pausedUntil?: string | null;
  planSlug?: string | null;
  mealsPerWeek?: number | null;
  portionDefault?: PortionDefault;
  paymentSchedule?: PaymentSchedule;
  billingProfile?: BillingProfile;
  fixedPricePerMealCents?: number | null;
  discountCents?: number;
};

/** Update membership plan, billing, and status by membership id. */
export async function updateAdminMembership(input: UpdateAdminMembershipInput): Promise<void> {
  const db = getDb();

  const [membership] = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      status: memberships.status,
      planSlug: memberships.planSlug,
      billingProfile: memberships.billingProfile,
      fixedPricePerMealCents: memberships.fixedPricePerMealCents,
    })
    .from(memberships)
    .where(eq(memberships.id, input.membershipId))
    .limit(1);

  if (!membership) {
    throw new Error("Membership not found.");
  }

  const nextBillingProfile = input.billingProfile ?? membership.billingProfile;
  const nextFixedPricePerMealCents =
    input.fixedPricePerMealCents !== undefined
      ? input.fixedPricePerMealCents
      : membership.fixedPricePerMealCents;

  if (
    nextBillingProfile === "fixed_price" &&
    (nextFixedPricePerMealCents == null || nextFixedPricePerMealCents <= 0)
  ) {
    throw new Error("Fixed price per meal is required for fixed price billing.");
  }

  const nextStatus = input.membershipStatus ?? membership.status;

  if (nextStatus === "active" && input.pausedUntil != null) {
    throw new Error("Active memberships cannot have a pause until date.");
  }

  if (nextStatus === "active" || nextStatus === "paused") {
    await assertNoBlockingMembership(db, membership.userId, membership.id);
  }

  if (input.planSlug !== undefined) {
    await assertValidPlanSlug(db, input.planSlug?.trim() || null);
  } else if (nextStatus === "active" || nextStatus === "paused") {
    await assertValidPlanSlug(db, membership.planSlug);
  }

  const updates: {
    status?: MembershipStatus;
    pausedUntil?: Date | null;
    planSlug?: string | null;
    mealsPerWeek?: number | null;
    portionDefault?: PortionDefault;
    paymentSchedule?: PaymentSchedule;
    billingProfile?: BillingProfile;
    fixedPricePerMealCents?: number | null;
    discountCents?: number;
  } = {};

  if (input.membershipStatus !== undefined) updates.status = input.membershipStatus;
  if (input.planSlug !== undefined) updates.planSlug = input.planSlug?.trim() || null;
  if (input.mealsPerWeek !== undefined) updates.mealsPerWeek = input.mealsPerWeek;
  if (input.portionDefault !== undefined) updates.portionDefault = input.portionDefault;
  if (input.paymentSchedule !== undefined) updates.paymentSchedule = input.paymentSchedule;
  if (input.billingProfile !== undefined) updates.billingProfile = input.billingProfile;
  if (input.discountCents !== undefined) updates.discountCents = input.discountCents;

  if (nextStatus === "active" || nextStatus === "cancelled") {
    updates.pausedUntil = null;
  } else if (nextStatus === "paused") {
    if (input.pausedUntil !== undefined) {
      if (input.pausedUntil === null) {
        updates.pausedUntil = null;
      } else {
        assertPauseDateNotInPast(input.pausedUntil);
        updates.pausedUntil = parsePausedUntilDate(input.pausedUntil);
      }
    } else if (input.membershipStatus === "paused" && membership.status !== "paused") {
      updates.pausedUntil = null;
    }
  }

  if (nextBillingProfile === "catalog") {
    updates.fixedPricePerMealCents = null;
  } else if (input.fixedPricePerMealCents !== undefined) {
    updates.fixedPricePerMealCents = input.fixedPricePerMealCents;
  }

  if (Object.keys(updates).length === 0) return;

  await db.update(memberships).set(updates).where(eq(memberships.id, input.membershipId));
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
