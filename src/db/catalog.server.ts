import { asc, eq } from "drizzle-orm";

import { getDb } from "./index.server.ts";
import { menuItems } from "./schema/menu-items.ts";
import { pickupWindows } from "./schema/pickup-windows.ts";
import { planCategories } from "./schema/plan-categories.ts";

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
