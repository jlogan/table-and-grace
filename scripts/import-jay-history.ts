#!/usr/bin/env node
/**
 * Idempotent import of Jay Logan's historical GoFofa POS orders.
 * Usage: npm run db:import:jay-history
 */
import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index.server.ts";
import { customerProfiles } from "../src/db/schema/customer-profiles.ts";
import { memberships } from "../src/db/schema/memberships.ts";
import { menuItems } from "../src/db/schema/menu-items.ts";
import { orderLines, type Portion } from "../src/db/schema/order-lines.ts";
import { paymentMethods } from "../src/db/schema/payment-methods.ts";
import { users } from "../src/db/schema/users.ts";
import { weeklyBatches } from "../src/db/schema/weekly-batches.ts";
import { weeklyOrders } from "../src/db/schema/weekly-orders.ts";
import { catalogUuid } from "../src/lib/catalog-ids.ts";

const JAY_EMAIL = "nagolpj@gmail.com";
const JAY_NAME = "Jay Logan";
const JAY_PHONE = "(404) 593-7102";
const PLACEHOLDER_STRIPE_PM_ID = "placeholder_jay_visa_1023";

const IMPORT_NAMESPACE = "table-and-grace-gofofa-import-v1";

type ImportLineSpec = {
  name: string;
  qty: number;
  portion: Portion;
  lineTotalCents: number;
  note?: string;
  /** When line total is not evenly divisible by qty, optional per-unit overrides. */
  unitPriceCents?: number;
};

type ImportOrderSpec = {
  key: string;
  receiptNumber: string;
  externalOrderNumber?: string;
  orderedAt: Date;
  pickupDate: Date;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  lines: ImportLineSpec[];
};

/** Receipt data transcribed from GoFofa POS screenshots. */
const HISTORICAL_ORDERS: ImportOrderSpec[] = [
  {
    key: "DXba",
    receiptNumber: "DXba",
    orderedAt: new Date("2026-08-02T14:11:00-04:00"),
    pickupDate: new Date("2026-08-02T12:00:00-04:00"),
    subtotalCents: 16246,
    taxCents: 975,
    tipCents: 2583,
    totalCents: 19804,
    lines: [
      {
        name: "BEEF SIRLOIN BURGER PITA MELT",
        qty: 2,
        portion: "6oz",
        lineTotalCents: 2398,
        note: "96% lean Beef Burger, melted swiss Cheese, in a wheat pita pocket. Side of roasted Brussel Sprouts and Sweet Potato Fries",
      },
      {
        name: "TERIYAKI CHICKEN STIR FRY BOWL",
        qty: 5,
        portion: "4oz",
        lineTotalCents: 5495,
        note: "tender grilled chicken breast, stir fried with fresh vegetables in a house made teriyaki sauce, served over a bed of basmati rice",
      },
      {
        name: "GROUND TURKEY SPAGHETTI",
        qty: 4,
        portion: "4oz",
        lineTotalCents: 4396,
        note: "tender ground turkey in a house made marinara sauce served over whole wheat spaghetti noodles",
      },
      {
        name: "Beef Fajita Bowl",
        qty: 3,
        portion: "4oz",
        lineTotalCents: 3957,
      },
    ],
  },
  {
    key: "bvZ6",
    receiptNumber: "bvZ6",
    orderedAt: new Date("2026-07-20T20:48:00-04:00"),
    pickupDate: new Date("2026-07-20T12:00:00-04:00"),
    subtotalCents: 17786,
    taxCents: 1067,
    tipCents: 2828,
    totalCents: 21681,
    lines: [
      { name: "Lemon Squeezed Salmon", qty: 4, portion: "6oz", lineTotalCents: 6596 },
      { name: "TERIYAKI CHICKEN STIR FRY BOWL", qty: 8, portion: "4oz", lineTotalCents: 8792 },
      { name: "BEEF SIRLOIN BURGER PITA MELT", qty: 2, portion: "6oz", lineTotalCents: 2398 },
    ],
  },
  {
    key: "hgQc",
    receiptNumber: "hgQc",
    orderedAt: new Date("2026-07-11T13:59:00-04:00"),
    pickupDate: new Date("2026-07-11T12:00:00-04:00"),
    subtotalCents: 17876,
    taxCents: 785,
    tipCents: 2799,
    totalCents: 21460,
    lines: [
      { name: "Lemon Squeezed Salmon", qty: 3, portion: "4oz", lineTotalCents: 4287 },
      { name: "BEEF SIRLOIN BURGER PITA MELT", qty: 3, portion: "6oz", lineTotalCents: 3597 },
      { name: "BEEF STIR FRY BOWL", qty: 4, portion: "4oz", lineTotalCents: 4796 },
      {
        name: "TERIYAKI CHICKEN STIR FRY BOWL",
        qty: 4,
        portion: "6oz",
        lineTotalCents: 5196,
      },
    ],
  },
  {
    key: "Dfvq",
    receiptNumber: "Dfvq",
    orderedAt: new Date("2026-07-03T11:45:00-04:00"),
    pickupDate: new Date("2026-07-03T12:00:00-04:00"),
    subtotalCents: 17346,
    taxCents: 1041,
    tipCents: 0,
    totalCents: 18387,
    lines: [
      { name: "Chicken Parmesan", qty: 4, portion: "4oz", lineTotalCents: 5196 },
      { name: "Chicken Fajita Bowl", qty: 3, portion: "4oz", lineTotalCents: 3297 },
      { name: "BEEF SIRLOIN BURGER PITA MELT", qty: 2, portion: "6oz", lineTotalCents: 2398 },
      { name: "CHICKEN QUESADILLA", qty: 3, portion: "4oz", lineTotalCents: 3597 },
      { name: "Lemon Squeezed Salmon", qty: 2, portion: "4oz", lineTotalCents: 2858 },
    ],
  },
  {
    key: "9gTz",
    receiptNumber: "9gTz",
    orderedAt: new Date("2026-06-26T12:00:00-04:00"),
    pickupDate: new Date("2026-06-26T12:00:00-04:00"),
    subtotalCents: 18212,
    taxCents: 1093,
    tipCents: 2896,
    totalCents: 22201,
    lines: [
      {
        name: "CHICKEN QUESADILLA",
        qty: 4,
        portion: "6oz",
        lineTotalCents: 5036,
        unitPriceCents: 1259,
      },
      {
        name: "Lemon Squeezed Salmon",
        qty: 3,
        portion: "6oz",
        lineTotalCents: 4452,
        unitPriceCents: 1484,
      },
      {
        name: "GROUND TURKEY SPAGHETTI",
        qty: 4,
        portion: "6oz",
        lineTotalCents: 4677,
        unitPriceCents: 1169,
      },
      {
        name: "BBQ CHICKEN STRIPS",
        qty: 3,
        portion: "6oz",
        lineTotalCents: 4047,
        unitPriceCents: 1349,
      },
    ],
  },
  {
    key: "1188011688",
    receiptNumber: "fXCt",
    externalOrderNumber: "1188011688",
    orderedAt: new Date("2026-06-20T13:03:00-04:00"),
    pickupDate: new Date("2026-06-22T12:00:00-04:00"),
    subtotalCents: 10999,
    taxCents: 770,
    tipCents: 1100,
    totalCents: 12869,
    lines: [
      {
        name: "The Ten Meal Pack",
        qty: 1,
        portion: "6oz",
        lineTotalCents: 10999,
        note: "Ten meal options to jumpstart your meal plan, 5 featuring a variety of five meals 4oz two of each: 2x-Turkey Spaghetti 2x-Personal... 6oz---protein",
      },
    ],
  },
];

/** Map receipt item names to existing catalog slugs when available. */
const CATALOG_SLUG_BY_NAME: Record<string, string> = {
  "GROUND TURKEY SPAGHETTI": "gt-spag",
  "Chicken Parmesan": "chick-parm",
};

function importUuid(kind: string, key: string): string {
  const hash = createHash("sha256").update(`${IMPORT_NAMESPACE}:${kind}:${key}`).digest("hex");
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${variant}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

function slugifyItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveMenuSlug(name: string): string {
  return CATALOG_SLUG_BY_NAME[name] ?? `gof-${slugifyItemName(name)}`;
}

function dateAtNoon(date: Date): Date {
  const dateOnly = date.toISOString().slice(0, 10);
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

function resolveUnitPriceCents(line: ImportLineSpec): number {
  if (line.unitPriceCents != null) {
    return line.unitPriceCents;
  }
  return Math.round(line.lineTotalCents / line.qty);
}

/** Expand lines when qty × unit cannot match line total exactly (e.g. 4677 ÷ 4). */
function expandLines(lines: ImportLineSpec[]): Array<ImportLineSpec & { unitPriceCents: number }> {
  const expanded: Array<ImportLineSpec & { unitPriceCents: number }> = [];

  for (const line of lines) {
    const unit = resolveUnitPriceCents(line);
    if (unit * line.qty === line.lineTotalCents) {
      expanded.push({ ...line, unitPriceCents: unit });
      continue;
    }

    const remainder = line.lineTotalCents - unit * (line.qty - 1);
    if (line.qty > 1 && remainder > 0 && remainder !== unit) {
      expanded.push({
        ...line,
        qty: line.qty - 1,
        lineTotalCents: unit * (line.qty - 1),
        unitPriceCents: unit,
      });
      expanded.push({
        ...line,
        qty: 1,
        lineTotalCents: remainder,
        unitPriceCents: remainder,
      });
      continue;
    }

    expanded.push({ ...line, unitPriceCents: unit });
  }

  return expanded;
}

async function ensureJayUser(): Promise<string> {
  const db = getDb();

  const [existingByEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, JAY_EMAIL))
    .limit(1);

  const userId = existingByEmail?.id ?? importUuid("user", JAY_EMAIL);

  const [existingMembership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  const [existingPaymentMethod] = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.userId, userId),
        eq(paymentMethods.stripePaymentMethodId, PLACEHOLDER_STRIPE_PM_ID),
      ),
    )
    .limit(1);

  const membershipId = existingMembership?.id ?? importUuid("membership", JAY_EMAIL);
  const paymentMethodId = existingPaymentMethod?.id ?? importUuid("payment_method", "visa_1023");

  await db
    .insert(users)
    .values({
      id: userId,
      email: JAY_EMAIL,
      name: JAY_NAME,
      role: "customer",
      passwordHash: null,
      emailVerifiedAt: new Date("2026-06-01T12:00:00-04:00"),
    })
    .onDuplicateKeyUpdate({
      set: {
        // Preserve any existing admin/staff role for Jay; this import only ensures account metadata.
        name: JAY_NAME,
      },
    });

  await db
    .insert(customerProfiles)
    .values({
      userId,
      phone: JAY_PHONE,
      paymentSchedule: "weekly_autopay",
      portionDefault: "6oz",
      billingEnabled: true,
      autopayEnabled: true,
      paymentScheduleSetBy: "admin",
    })
    .onDuplicateKeyUpdate({
      set: {
        phone: JAY_PHONE,
        billingEnabled: true,
        autopayEnabled: true,
      },
    });

  await db
    .insert(memberships)
    .values({
      id: membershipId,
      userId,
      status: "active",
    })
    .onDuplicateKeyUpdate({
      set: {
        status: "active",
      },
    });

  await db
    .insert(paymentMethods)
    .values({
      id: paymentMethodId,
      userId,
      stripePaymentMethodId: PLACEHOLDER_STRIPE_PM_ID,
      brand: "visa",
      last4: "1023",
      isDefault: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        brand: "visa",
        last4: "1023",
        isDefault: true,
      },
    });

  return userId;
}

async function upsertMenuItem(
  name: string,
  note: string | null,
  portion: Portion,
  unitPriceCents: number,
): Promise<string> {
  const db = getDb();
  const slug = resolveMenuSlug(name);
  const id = catalogUuid("menu_item", slug);

  const [existing] = await db
    .select({
      price4ozCents: menuItems.price4ozCents,
      price6ozCents: menuItems.price6ozCents,
      note: menuItems.note,
    })
    .from(menuItems)
    .where(eq(menuItems.id, id))
    .limit(1);

  const price4ozCents = portion === "4oz" ? unitPriceCents : (existing?.price4ozCents ?? null);
  const price6ozCents = portion === "6oz" ? unitPriceCents : (existing?.price6ozCents ?? null);

  await db
    .insert(menuItems)
    .values({
      id,
      categoryId: null,
      slug,
      name,
      note: note ?? existing?.note ?? null,
      price4ozCents,
      price6ozCents,
      sortOrder: 900,
      active: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        name,
        note: note ?? existing?.note ?? null,
        price4ozCents,
        price6ozCents,
        active: true,
      },
    });

  return id;
}

async function importOrder(userId: string, spec: ImportOrderSpec): Promise<void> {
  const db = getDb();
  const batchId = importUuid("batch", spec.key);
  const orderId = importUuid("order", spec.key);
  const weekStart = dateAtNoon(spec.orderedAt);
  const pickupDate = dateAtNoon(spec.pickupDate);
  const orderTimestamp = spec.orderedAt;
  const importedAt = new Date();

  await db
    .insert(weeklyBatches)
    .values({
      id: batchId,
      weekStart,
      pickupDate,
      status: "closed",
      reviewDeadline: orderTimestamp,
      chargeScheduledAt: orderTimestamp,
    })
    .onDuplicateKeyUpdate({
      set: {
        weekStart,
        pickupDate,
        status: "closed",
        reviewDeadline: orderTimestamp,
        chargeScheduledAt: orderTimestamp,
      },
    });

  const [existingOrder] = await db
    .select({ importedAt: weeklyOrders.importedAt })
    .from(weeklyOrders)
    .where(eq(weeklyOrders.id, orderId))
    .limit(1);

  await db
    .insert(weeklyOrders)
    .values({
      id: orderId,
      batchId,
      userId,
      status: "picked_up",
      subtotalCents: spec.subtotalCents,
      taxCents: spec.taxCents,
      tipCents: spec.tipCents,
      totalCents: spec.totalCents,
      receiptNumber: spec.receiptNumber,
      externalOrderNumber: spec.externalOrderNumber ?? null,
      paymentScheduleSnapshot: "weekly_autopay",
      reviewedAt: orderTimestamp,
      approvedAt: orderTimestamp,
      createdAt: orderTimestamp,
      importedAt: existingOrder?.importedAt ?? importedAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        batchId,
        status: "picked_up",
        subtotalCents: spec.subtotalCents,
        taxCents: spec.taxCents,
        tipCents: spec.tipCents,
        totalCents: spec.totalCents,
        receiptNumber: spec.receiptNumber,
        externalOrderNumber: spec.externalOrderNumber ?? null,
        paymentScheduleSnapshot: "weekly_autopay",
        reviewedAt: orderTimestamp,
        approvedAt: orderTimestamp,
        createdAt: orderTimestamp,
      },
    });

  await db.delete(orderLines).where(eq(orderLines.orderId, orderId));

  const expandedLines = expandLines(spec.lines);
  for (const [index, line] of expandedLines.entries()) {
    const menuItemId = await upsertMenuItem(
      line.name,
      line.note ?? null,
      line.portion,
      line.unitPriceCents,
    );

    await db.insert(orderLines).values({
      id: importUuid("order_line", `${spec.key}:${index}`),
      orderId,
      menuItemId,
      portion: line.portion,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      source: "chef_assigned",
      createdAt: orderTimestamp,
    });
  }
}

async function main() {
  const userId = await ensureJayUser();

  for (const order of HISTORICAL_ORDERS) {
    await importOrder(userId, order);
    console.log(
      `  imported order ${order.receiptNumber}${order.externalOrderNumber ? ` (#${order.externalOrderNumber})` : ""}`,
    );
  }

  console.log("Jay history import complete (idempotent).");
  console.log(`  customer: ${JAY_EMAIL} (${userId})`);
  console.log(`  orders: ${HISTORICAL_ORDERS.length}`);
  console.log(`  payment method: Visa •••• 1023 (${PLACEHOLDER_STRIPE_PM_ID})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
