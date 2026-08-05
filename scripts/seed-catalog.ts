#!/usr/bin/env node
/**
 * Idempotent catalog seed from src/lib/mock-data.ts.
 * Usage: npm run db:seed
 */
import { asc } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index.server.ts";
import { menuItems } from "../src/db/schema/menu-items.ts";
import { pickupWindows } from "../src/db/schema/pickup-windows.ts";
import { planCategories } from "../src/db/schema/plan-categories.ts";
import { catalogUuid } from "../src/lib/catalog-ids.ts";
import {
  ingredientItems,
  pickupWindows as mockPickupWindows,
  planCategories as mockPlanCategories,
} from "../src/lib/mock-data.ts";

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

async function upsertPlanCategories() {
  const db = getDb();
  let count = 0;

  for (const [index, cat] of mockPlanCategories.entries()) {
    const row = {
      id: catalogUuid("plan_category", cat.id),
      slug: cat.id,
      name: cat.name,
      tagline: cat.tagline,
      description: cat.description,
      recommendedFor: cat.recommendedFor,
      tags: cat.tags,
      price4ozCents: dollarsToCents(cat.price4oz),
      price6ozCents: dollarsToCents(cat.price6oz),
      accent: cat.accent,
      sortOrder: index,
      active: true,
    };

    await db
      .insert(planCategories)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          slug: row.slug,
          name: row.name,
          tagline: row.tagline,
          description: row.description,
          recommendedFor: row.recommendedFor,
          tags: row.tags,
          price4ozCents: row.price4ozCents,
          price6ozCents: row.price6ozCents,
          accent: row.accent,
          sortOrder: row.sortOrder,
          active: row.active,
        },
      });
    count += 1;
  }

  return count;
}

async function upsertCategoryMeals() {
  const db = getDb();
  let count = 0;

  for (const cat of mockPlanCategories) {
    const categoryId = catalogUuid("plan_category", cat.id);

    for (const [index, meal] of cat.meals.entries()) {
      const row = {
        id: catalogUuid("menu_item", meal.id),
        categoryId,
        slug: meal.id,
        name: meal.name,
        note: meal.note ?? null,
        price4ozCents: null,
        price6ozCents: null,
        sortOrder: index,
        active: true,
      };

      await db
        .insert(menuItems)
        .values(row)
        .onDuplicateKeyUpdate({
          set: {
            categoryId: row.categoryId,
            slug: row.slug,
            name: row.name,
            note: row.note,
            price4ozCents: row.price4ozCents,
            price6ozCents: row.price6ozCents,
            sortOrder: row.sortOrder,
            active: row.active,
          },
        });
      count += 1;
    }
  }

  return count;
}

async function upsertIngredientItems() {
  const db = getDb();
  let count = 0;

  for (const [index, ing] of ingredientItems.entries()) {
    const cents = dollarsToCents(ing.price);
    const row = {
      id: catalogUuid("menu_item", ing.id),
      categoryId: null,
      slug: ing.id,
      name: ing.name,
      note: ing.description,
      price4ozCents: cents,
      price6ozCents: cents,
      sortOrder: index,
      active: true,
    };

    await db
      .insert(menuItems)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          categoryId: row.categoryId,
          slug: row.slug,
          name: row.name,
          note: row.note,
          price4ozCents: row.price4ozCents,
          price6ozCents: row.price6ozCents,
          sortOrder: row.sortOrder,
          active: row.active,
        },
      });
    count += 1;
  }

  return count;
}

async function upsertPickupWindows() {
  const db = getDb();
  let count = 0;

  for (const [index, win] of mockPickupWindows.entries()) {
    const row = {
      id: catalogUuid("pickup_window", win.id),
      label: win.label,
      dayOfWeek: win.day,
      timeRange: win.time,
      locationName: null,
      sortOrder: index,
      active: true,
    };

    await db
      .insert(pickupWindows)
      .values(row)
      .onDuplicateKeyUpdate({
        set: {
          label: row.label,
          dayOfWeek: row.dayOfWeek,
          timeRange: row.timeRange,
          locationName: row.locationName,
          sortOrder: row.sortOrder,
          active: row.active,
        },
      });
    count += 1;
  }

  return count;
}

async function verifyCounts() {
  const db = getDb();
  const [categoryRows, menuRows, pickupRows] = await Promise.all([
    db
      .select({ slug: planCategories.slug })
      .from(planCategories)
      .orderBy(asc(planCategories.sortOrder)),
    db.select({ slug: menuItems.slug }).from(menuItems).orderBy(asc(menuItems.sortOrder)),
    db
      .select({ label: pickupWindows.label })
      .from(pickupWindows)
      .orderBy(asc(pickupWindows.sortOrder)),
  ]);

  return {
    categories: categoryRows.length,
    menuItems: menuRows.length,
    pickupWindows: pickupRows.length,
  };
}

async function main() {
  const categoryCount = await upsertPlanCategories();
  const mealCount = await upsertCategoryMeals();
  const ingredientCount = await upsertIngredientItems();
  const pickupCount = await upsertPickupWindows();
  const totals = await verifyCounts();

  console.log("Catalog seed complete (idempotent upserts).");
  console.log(`  plan_categories: ${categoryCount} upserted (${totals.categories} in DB)`);
  console.log(`  menu_items: ${mealCount + ingredientCount} upserted (${totals.menuItems} in DB)`);
  console.log(`  pickup_windows: ${pickupCount} upserted (${totals.pickupWindows} in DB)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
