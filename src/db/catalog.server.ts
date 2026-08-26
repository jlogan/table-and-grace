import { randomUUID } from "node:crypto";

import { asc, desc, eq, sql } from "drizzle-orm";

import type { AdminMenuItemRow, AdminPlanCategoryWithId } from "@/orders/admin-types.ts";

import { getDb } from "./index.server.ts";
import { menuItems } from "./schema/menu-items.ts";
import { pickupWindows } from "./schema/pickup-windows.ts";
import { planCategories } from "./schema/plan-categories.ts";

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "item";
}

/** Active plan categories ordered for display. */
export async function listPlanCategories() {
  const db = getDb();
  return db
    .select()
    .from(planCategories)
    .where(eq(planCategories.active, true))
    .orderBy(asc(planCategories.sortOrder));
}

/** Active menu items ordered for display. */
export async function listMenuItems() {
  const db = getDb();
  return db
    .select()
    .from(menuItems)
    .where(eq(menuItems.active, true))
    .orderBy(asc(menuItems.sortOrder));
}

/** Active pickup windows ordered for display. */
export async function listPickupWindows() {
  const db = getDb();
  return db
    .select()
    .from(pickupWindows)
    .where(eq(pickupWindows.active, true))
    .orderBy(asc(pickupWindows.sortOrder));
}

export async function getPlanCategoryBySlug(slug: string) {
  const db = getDb();
  const [category] = await db
    .select()
    .from(planCategories)
    .where(eq(planCategories.slug, slug))
    .limit(1);
  return category ?? null;
}

export async function getMenuItemBySlug(slug: string) {
  const db = getDb();
  const [item] = await db.select().from(menuItems).where(eq(menuItems.slug, slug)).limit(1);
  return item ?? null;
}

export async function getPickupWindowById(id: string) {
  const db = getDb();
  const [window] = await db.select().from(pickupWindows).where(eq(pickupWindows.id, id)).limit(1);
  return window ?? null;
}

/** Active plan categories with ids for admin catalog forms. */
export async function listAdminPlanCategoriesWithId(): Promise<AdminPlanCategoryWithId[]> {
  const db = getDb();
  return db
    .select({
      id: planCategories.id,
      slug: planCategories.slug,
      name: planCategories.name,
    })
    .from(planCategories)
    .where(eq(planCategories.active, true))
    .orderBy(asc(planCategories.sortOrder), asc(planCategories.name));
}

/** Active menu items with category and pricing metadata for admin catalog. */
export async function listAdminMenuItems(): Promise<AdminMenuItemRow[]> {
  const db = getDb();
  return db
    .select({
      id: menuItems.id,
      slug: menuItems.slug,
      name: menuItems.name,
      note: menuItems.note,
      categoryId: menuItems.categoryId,
      categoryName: planCategories.name,
      price4ozCents: menuItems.price4ozCents,
      price6ozCents: menuItems.price6ozCents,
      sortOrder: menuItems.sortOrder,
      active: menuItems.active,
    })
    .from(menuItems)
    .leftJoin(planCategories, eq(menuItems.categoryId, planCategories.id))
    .where(eq(menuItems.active, true))
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));
}

export type CreateAdminMenuItemInput = {
  name: string;
  note?: string;
  categoryId?: string;
  price4ozCents?: number;
  price6ozCents?: number;
};

/** Create an active catalog menu item (slug derived from name). */
export async function createAdminMenuItem(input: CreateAdminMenuItemInput): Promise<string> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Item name is required.");
  }

  const [exactExisting] = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(sql`lower(trim(${menuItems.name})) = ${name.toLowerCase()}`)
    .limit(1);
  if (exactExisting) {
    return exactExisting.id;
  }

  const baseSlug = slugifyName(name);
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 5) {
    const [existing] = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.slug, slug))
      .limit(1);
    if (!existing) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const [maxSort] = await db
    .select({ sortOrder: menuItems.sortOrder })
    .from(menuItems)
    .orderBy(desc(menuItems.sortOrder))
    .limit(1);

  const id = randomUUID();
  await db.insert(menuItems).values({
    id,
    slug,
    name,
    note: input.note?.trim() || null,
    categoryId: input.categoryId ?? null,
    price4ozCents: input.price4ozCents ?? null,
    price6ozCents: input.price6ozCents ?? null,
    sortOrder: (maxSort?.sortOrder ?? 0) + 1,
    active: true,
  });

  return id;
}

export type UpdateAdminMenuItemInput = {
  id: string;
  name?: string;
  note?: string | null;
  categoryId?: string | null;
  price4ozCents?: number | null;
  price6ozCents?: number | null;
};

/** Update catalog menu item fields. */
export async function updateAdminMenuItem(input: UpdateAdminMenuItemInput): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(eq(menuItems.id, input.id))
    .limit(1);

  if (!existing) {
    throw new Error("Menu item not found.");
  }

  await db
    .update(menuItems)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.price4ozCents !== undefined ? { price4ozCents: input.price4ozCents } : {}),
      ...(input.price6ozCents !== undefined ? { price6ozCents: input.price6ozCents } : {}),
    })
    .where(eq(menuItems.id, input.id));
}

/** Plan category with its menu items (empty array when category missing). */
export async function getPlanCategoryWithItems(slug: string) {
  const category = await getPlanCategoryBySlug(slug);
  if (!category) return null;

  const db = getDb();
  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.categoryId, category.id))
    .orderBy(asc(menuItems.sortOrder));

  return { category, items };
}
