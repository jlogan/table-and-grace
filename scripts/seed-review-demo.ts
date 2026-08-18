#!/usr/bin/env node
/**
 * Seed a demo weekly batch + customer order for Sprint B review testing.
 * Usage: npm run db:seed:review-demo [user-email]
 *
 * Requires catalog seed (npm run db:seed) and at least one customer account.
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index.server.ts";
import { batchItems } from "../src/db/schema/batch-items.ts";
import { menuItems } from "../src/db/schema/menu-items.ts";
import { orderLines } from "../src/db/schema/order-lines.ts";
import { pickupWindows } from "../src/db/schema/pickup-windows.ts";
import { planCategories } from "../src/db/schema/plan-categories.ts";
import { users } from "../src/db/schema/users.ts";
import { weeklyBatches } from "../src/db/schema/weekly-batches.ts";
import { weeklyOrders } from "../src/db/schema/weekly-orders.ts";
import { catalogUuid } from "../src/lib/catalog-ids.ts";

const DEMO_BATCH_ID = "00000000-0000-4000-8000-000000000001";

function weekStartDate(): Date {
  const d = new Date();
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

function dateLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function resolveCustomerUser(emailArg?: string) {
  const db = getDb();

  if (emailArg) {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, emailArg.toLowerCase()))
      .limit(1);
    if (!user) {
      throw new Error(`No user found for email: ${emailArg}`);
    }
    return user;
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "customer"))
    .limit(1);

  if (!user) {
    throw new Error("No customer user found. Sign up first or pass an email argument.");
  }

  return user;
}

async function main() {
  const emailArg = process.argv[2];
  const user = await resolveCustomerUser(emailArg);
  const db = getDb();

  const weekStart = weekStartDate();
  const pickupDate = addDays(weekStart, 6);
  const reviewDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const chargeScheduledAt = new Date(reviewDeadline.getTime() + 60 * 60 * 1000);

  const [pickup] = await db.select().from(pickupWindows).limit(1);
  const catalogMeals = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      categoryId: menuItems.categoryId,
      price4ozCents: menuItems.price4ozCents,
      price6ozCents: menuItems.price6ozCents,
    })
    .from(menuItems)
    .where(eq(menuItems.active, true))
    .limit(6);

  if (catalogMeals.length < 2) {
    throw new Error("Need catalog menu items. Run npm run db:seed first.");
  }

  await db
    .insert(weeklyBatches)
    .values({
      id: DEMO_BATCH_ID,
      weekStart,
      pickupDate,
      pickupWindowId: pickup?.id ?? null,
      status: "pending_customer_review",
      reviewDeadline,
      chargeScheduledAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        weekStart,
        pickupDate,
        pickupWindowId: pickup?.id ?? null,
        status: "pending_customer_review",
        reviewDeadline,
        chargeScheduledAt,
      },
    });

  for (const meal of catalogMeals) {
    const batchItemId = catalogUuid("menu_item", `demo-batch-${meal.id}`);
    await db
      .insert(batchItems)
      .values({
        id: batchItemId,
        batchId: DEMO_BATCH_ID,
        menuItemId: meal.id,
        qtyCooked: 20,
        qtyRemaining: 20,
      })
      .onDuplicateKeyUpdate({
        set: {
          qtyCooked: 20,
          qtyRemaining: 20,
        },
      });
  }

  const orderId = catalogUuid("menu_item", `demo-order-${user.id}`);

  await db
    .insert(weeklyOrders)
    .values({
      id: orderId,
      batchId: DEMO_BATCH_ID,
      userId: user.id,
      status: "pending_customer_review",
      pickupWindowId: pickup?.id ?? null,
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
    })
    .onDuplicateKeyUpdate({
      set: {
        status: "pending_customer_review",
        pickupWindowId: pickup?.id ?? null,
      },
    });

  await db.delete(orderLines).where(eq(orderLines.orderId, orderId));

  let subtotal = 0;
  for (const [index, meal] of catalogMeals.slice(0, 3).entries()) {
    let category: { price4ozCents: number; price6ozCents: number } | null = null;
    if (meal.categoryId) {
      const [cat] = await db
        .select({
          price4ozCents: planCategories.price4ozCents,
          price6ozCents: planCategories.price6ozCents,
        })
        .from(planCategories)
        .where(eq(planCategories.id, meal.categoryId))
        .limit(1);
      category = cat ?? null;
    }

    const unitPriceCents = meal.price6ozCents ?? category?.price6ozCents ?? 1200;
    const qty = index === 0 ? 2 : 1;
    subtotal += unitPriceCents * qty;

    await db.insert(orderLines).values({
      id: randomUUID(),
      orderId,
      menuItemId: meal.id,
      portion: "6oz",
      qty,
      unitPriceCents,
      source: "chef_assigned",
    });
  }

  await db
    .update(weeklyOrders)
    .set({
      subtotalCents: subtotal,
      taxCents: 0,
      totalCents: subtotal,
    })
    .where(eq(weeklyOrders.id, orderId));

  console.log("Review demo seed complete.");
  console.log(`  customer: ${user.email}`);
  console.log(`  batch: ${DEMO_BATCH_ID} (week of ${dateLabel(weekStart)})`);
  console.log(`  order: ${orderId}`);
  console.log(`  review at: /account/orders/${orderId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
