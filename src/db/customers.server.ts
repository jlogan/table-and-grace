import { randomUUID } from "node:crypto";

import { parseISO } from "date-fns";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  AdminCustomerDetail,
  AdminCustomerRow,
  AdminDashboardOverview,
  AdminMembershipRow,
  AdminPlanCategoryOption,
  BatchMealDemandRow,
} from "@/orders/admin-types.ts";
import { isMembershipBatchEligible } from "@/orders/admin-types.ts";
import { toIsoDateString } from "@/lib/dates.ts";

import {
  listAdminBatches,
  listAdminOrders,
  listPublishEligibleMembers,
  orderBatchInventory,
  assignMealsRoundRobin,
} from "./batches.server.ts";
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
import { weeklyBatches } from "./schema/weekly-batches.ts";
import { weeklyOrders } from "./schema/weekly-orders.ts";
import { resolveOrderPaymentSchedule } from "@/orders/payment-schedule.ts";

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

/** All customer-role users with profile and order counts (memberships joined separately). */
export async function listAdminCustomers(): Promise<AdminCustomerRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      preferredName: users.preferredName,
      role: users.role,
      createdAt: users.createdAt,
      portionDefault: customerProfiles.portionDefault,
      phone: customerProfiles.phone,
      birthday: customerProfiles.birthday,
      favoriteCake: customerProfiles.favoriteCake,
      profilePhotoUrl: customerProfiles.profilePhotoUrl,
      allergies: customerProfiles.allergies,
      chefNotes: customerProfiles.chefNotes,
      dietaryTags: customerProfiles.dietaryTags,
      orderCount: sql<number>`(
        select count(*) from weekly_orders wo where wo.user_id = ${users.id}
      )`.mapWith(Number),
    })
    .from(users)
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.createdAt));

  const membershipRows =
    rows.length === 0
      ? []
      : await db
          .select({
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

  const membershipStatsByUser = new Map<
    string,
    { count: number; activeCount: number; primaryStatus: MembershipStatus | null }
  >();

  const membershipsByUser = new Map<string, typeof membershipRows>();
  for (const membership of membershipRows) {
    const list = membershipsByUser.get(membership.userId) ?? [];
    list.push(membership);
    membershipsByUser.set(membership.userId, list);
  }

  for (const [userId, userMemberships] of membershipsByUser) {
    const sorted = [...userMemberships].sort((a, b) => {
      const rankDiff = membershipStatusRank[a.status] - membershipStatusRank[b.status];
      if (rankDiff !== 0) return rankDiff;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    membershipStatsByUser.set(userId, {
      count: sorted.length,
      activeCount: sorted.filter((m) => m.status === "active").length,
      primaryStatus: sorted[0]?.status ?? null,
    });
  }

  return rows.map((row) => {
    const stats = membershipStatsByUser.get(row.userId);
    return {
      userId: row.userId,
      email: row.email,
      name: row.name,
      firstName: row.firstName,
      lastName: row.lastName,
      preferredName: row.preferredName,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      phone: row.phone,
      birthday: toIsoDateString(row.birthday),
      favoriteCake: row.favoriteCake,
      hasProfilePhoto: Boolean(row.profilePhotoUrl?.trim()),
      allergies: row.allergies,
      dietaryTags: displayDietaryTags(row.dietaryTags),
      membershipCount: stats?.count ?? 0,
      activeMembershipCount: stats?.activeCount ?? 0,
      primaryMembershipStatus: stats?.primaryStatus ?? null,
      portionDefault: row.portionDefault ?? "6oz",
      chefNotes: row.chefNotes,
      orderCount: row.orderCount,
    };
  });
}

/** Full customer profile with memberships and order history for the admin detail page. */
export async function getAdminCustomerDetail(userId: string): Promise<AdminCustomerDetail | null> {
  const db = getDb();

  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      preferredName: users.preferredName,
      createdAt: users.createdAt,
      role: users.role,
      phone: customerProfiles.phone,
      birthday: customerProfiles.birthday,
      favoriteCake: customerProfiles.favoriteCake,
      profilePhotoUrl: customerProfiles.profilePhotoUrl,
      allergies: customerProfiles.allergies,
      dietaryTags: customerProfiles.dietaryTags,
      portionDefault: customerProfiles.portionDefault,
      chefNotes: customerProfiles.chefNotes,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(users.id, customerProfiles.userId))
    .where(and(eq(users.id, userId), eq(users.role, "customer")))
    .limit(1);

  if (!row) return null;

  const membershipRows = await db
    .select({
      membershipId: memberships.id,
      membershipStatus: memberships.status,
      pausedUntil: memberships.pausedUntil,
      planSlug: memberships.planSlug,
      mealsPerWeek: memberships.mealsPerWeek,
      portionDefault: memberships.portionDefault,
      paymentSchedule: memberships.paymentSchedule,
    })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .orderBy(desc(memberships.updatedAt));

  const planSlugs = membershipRows
    .map((m) => m.planSlug)
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

  const orderRows = await db
    .select({
      id: weeklyOrders.id,
      batchId: weeklyOrders.batchId,
      batchWeekStart: weeklyBatches.weekStart,
      status: weeklyOrders.status,
      membershipId: weeklyOrders.membershipId,
      membershipPlanSlug: memberships.planSlug,
      planCategoryName: planCategories.name,
      membershipPaymentSchedule: memberships.paymentSchedule,
      profilePaymentSchedule: customerProfiles.paymentSchedule,
      paymentScheduleSnapshot: weeklyOrders.paymentScheduleSnapshot,
      totalCents: weeklyOrders.totalCents,
      pickupLabel: pickupWindows.label,
      itemCount: sql<number>`coalesce((
        select sum(ol.qty) from order_lines ol where ol.order_id = ${weeklyOrders.id}
      ), 0)`.mapWith(Number),
    })
    .from(weeklyOrders)
    .innerJoin(weeklyBatches, eq(weeklyOrders.batchId, weeklyBatches.id))
    .leftJoin(customerProfiles, eq(weeklyOrders.userId, customerProfiles.userId))
    .leftJoin(memberships, eq(weeklyOrders.membershipId, memberships.id))
    .leftJoin(planCategories, eq(memberships.planSlug, planCategories.slug))
    .leftJoin(pickupWindows, eq(weeklyOrders.pickupWindowId, pickupWindows.id))
    .where(eq(weeklyOrders.userId, userId))
    .orderBy(desc(weeklyBatches.weekStart));

  return {
    userId: row.userId,
    email: row.email,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    preferredName: row.preferredName,
    createdAt: row.createdAt.toISOString(),
    phone: row.phone,
    birthday: toIsoDateString(row.birthday),
    favoriteCake: row.favoriteCake,
    hasProfilePhoto: Boolean(row.profilePhotoUrl?.trim()),
    profilePhotoUrl: row.profilePhotoUrl?.trim() || null,
    allergies: row.allergies,
    dietaryTags: displayDietaryTags(row.dietaryTags),
    portionDefault: row.portionDefault ?? "6oz",
    chefNotes: row.chefNotes,
    memberships: membershipRows.map((membership) => {
      const planSlug = membership.planSlug ?? null;
      return {
        membershipId: membership.membershipId,
        membershipStatus: membership.membershipStatus,
        pausedUntil: toIsoDateString(membership.pausedUntil),
        planSlug,
        planName: planSlug ? (planNamesBySlug.get(planSlug) ?? planSlug) : null,
        mealsPerWeek: membership.mealsPerWeek,
        portionDefault: membership.portionDefault,
        paymentSchedule: membership.paymentSchedule,
      };
    }),
    orders: orderRows.map((order) => {
      const planSlug = order.membershipPlanSlug ?? null;
      return {
        id: order.id,
        batchId: order.batchId,
        batchWeekStart: toIsoDateString(order.batchWeekStart) ?? "",
        status: order.status,
        paymentSchedule: resolveOrderPaymentSchedule({
          paymentScheduleSnapshot: order.paymentScheduleSnapshot,
          membershipPaymentSchedule: order.membershipPaymentSchedule,
          profilePaymentSchedule: order.profilePaymentSchedule,
        }),
        totalCents: order.totalCents,
        itemCount: order.itemCount,
        pickupLabel: order.pickupLabel,
        membershipId: order.membershipId,
        planSlug,
        planName: planSlug ? (order.planCategoryName ?? planSlug) : null,
      };
    }),
  };
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
      discountLabel: memberships.discountLabel,
      weeklyInvoiceDay: memberships.weeklyInvoiceDay,
      monthlyInvoiceDay: memberships.monthlyInvoiceDay,
      biweeklyAnchorDate: memberships.biweeklyAnchorDate,
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
      discountLabel: row.discountLabel,
      weeklyInvoiceDay: row.weeklyInvoiceDay,
      monthlyInvoiceDay: row.monthlyInvoiceDay,
      biweeklyAnchorDate: toIsoDateString(row.biweeklyAnchorDate),
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
  firstName: string;
  lastName: string;
  preferredName?: string;
  /** Legacy field — not set on new structured-name creates. */
  name?: string;
  phone?: string;
  birthday?: string;
  favoriteCake?: string;
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

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const structuredFullName = [firstName, lastName].filter(Boolean).join(" ");

  await db.insert(users).values({
    id: userId,
    email,
    firstName,
    lastName,
    preferredName: input.preferredName?.trim() || null,
    // Keep legacy name populated for older auth/order/admin displays without using preferred name.
    name: structuredFullName || null,
    role: "customer",
    passwordHash: null,
  });

  await db.insert(customerProfiles).values({
    userId,
    phone: input.phone?.trim() || null,
    birthday:
      input.birthday && toIsoDateString(input.birthday)
        ? parseISO(`${toIsoDateString(input.birthday)}T12:00:00`)
        : null,
    favoriteCake: input.favoriteCake?.trim() || null,
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
  firstName?: string;
  lastName?: string;
  preferredName?: string | null;
  /** Legacy field — only set explicitly; otherwise synced from first + last on save. */
  name?: string;
  phone?: string | null;
  birthday?: string | null;
  favoriteCake?: string | null;
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
    .select({
      id: users.id,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
    })
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
    birthday?: Date | null;
    favoriteCake?: string | null;
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
  if (input.birthday !== undefined) {
    profileUpdates.birthday =
      input.birthday && toIsoDateString(input.birthday)
        ? parseISO(`${toIsoDateString(input.birthday)}T12:00:00`)
        : null;
  }
  if (input.favoriteCake !== undefined) {
    profileUpdates.favoriteCake = input.favoriteCake?.trim() || null;
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

  const userUpdates: {
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    preferredName?: string | null;
    name?: string | null;
  } = {};

  if (input.firstName !== undefined) {
    userUpdates.firstName = input.firstName.trim() || null;
  }
  if (input.lastName !== undefined) {
    userUpdates.lastName = input.lastName.trim() || null;
  }
  if (input.preferredName !== undefined) {
    userUpdates.preferredName = input.preferredName?.trim() || null;
  }
  if (input.name !== undefined) {
    userUpdates.name = input.name.trim() || null;
  } else if (input.firstName !== undefined || input.lastName !== undefined) {
    const first = input.firstName !== undefined ? input.firstName.trim() : user.firstName?.trim();
    const last = input.lastName !== undefined ? input.lastName.trim() : user.lastName?.trim();
    const structuredFullName = [first, last].filter(Boolean).join(" ");
    if (structuredFullName) {
      userUpdates.name = structuredFullName;
    }
  }

  if (Object.keys(userUpdates).length > 0) {
    await db.update(users).set(userUpdates).where(eq(users.id, input.userId));
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
  discountLabel?: string;
  weeklyInvoiceDay?: number;
  monthlyInvoiceDay?: number;
  biweeklyAnchorDate?: string;
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
    discountLabel: input.discountLabel?.trim() || null,
    weeklyInvoiceDay:
      input.paymentSchedule === "weekly_autopay" ? (input.weeklyInvoiceDay ?? null) : null,
    monthlyInvoiceDay:
      input.paymentSchedule === "monthly_autopay" ? (input.monthlyInvoiceDay ?? null) : null,
    biweeklyAnchorDate: input.biweeklyAnchorDate
      ? parseISO(`${input.biweeklyAnchorDate}T12:00:00`)
      : null,
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
  discountLabel?: string | null;
  weeklyInvoiceDay?: number | null;
  monthlyInvoiceDay?: number | null;
  biweeklyAnchorDate?: string | null;
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
    discountLabel?: string | null;
    weeklyInvoiceDay?: number | null;
    monthlyInvoiceDay?: number | null;
    biweeklyAnchorDate?: Date | null;
  } = {};

  if (input.membershipStatus !== undefined) updates.status = input.membershipStatus;
  if (input.planSlug !== undefined) updates.planSlug = input.planSlug?.trim() || null;
  if (input.mealsPerWeek !== undefined) updates.mealsPerWeek = input.mealsPerWeek;
  if (input.portionDefault !== undefined) updates.portionDefault = input.portionDefault;
  if (input.paymentSchedule !== undefined) updates.paymentSchedule = input.paymentSchedule;
  if (input.billingProfile !== undefined) updates.billingProfile = input.billingProfile;
  if (input.discountCents !== undefined) updates.discountCents = input.discountCents;
  if (input.discountLabel !== undefined)
    updates.discountLabel = input.discountLabel?.trim() || null;
  if (input.weeklyInvoiceDay !== undefined) updates.weeklyInvoiceDay = input.weeklyInvoiceDay;
  if (input.monthlyInvoiceDay !== undefined) updates.monthlyInvoiceDay = input.monthlyInvoiceDay;
  if (input.biweeklyAnchorDate !== undefined) {
    updates.biweeklyAnchorDate = input.biweeklyAnchorDate
      ? parseISO(`${input.biweeklyAnchorDate}T12:00:00`)
      : null;
  }

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

/** Pre-publish meal demand from active memberships and saved batch inventory. */
export async function getBatchProjectedMealDemand(batchId: string): Promise<BatchMealDemandRow[]> {
  const { eligible } = await listPublishEligibleMembers();
  const inventory = await orderBatchInventory(batchId);
  const inventoryMenuItemIds = inventory.map((item) => item.menuItemId);

  const projectedByItem = new Map<string, number>();
  for (const member of eligible) {
    const assigned = assignMealsRoundRobin(member.mealsPerWeek, inventoryMenuItemIds);
    for (const [menuItemId, qty] of assigned) {
      projectedByItem.set(menuItemId, (projectedByItem.get(menuItemId) ?? 0) + qty);
    }
  }

  const inventoryByItem = new Map(inventory.map((row) => [row.menuItemId, row]));
  const itemIds = new Set([...projectedByItem.keys(), ...inventory.map((row) => row.menuItemId)]);

  const results: BatchMealDemandRow[] = [];
  for (const menuItemId of itemIds) {
    const inventoryRow = inventoryByItem.get(menuItemId);
    results.push({
      menuItemId,
      menuItemName: inventoryRow?.menuItemName ?? "Unknown item",
      qtyNeeded: projectedByItem.get(menuItemId) ?? 0,
      qtyCooked: inventoryRow?.qtyCooked ?? 0,
      qtyRemaining: inventoryRow?.qtyRemaining ?? 0,
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
