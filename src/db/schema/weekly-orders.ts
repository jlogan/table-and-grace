import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { billingCycles } from "./billing-cycles.ts";
import { portionDefaults } from "./customer-profiles.ts";
import { memberships } from "./memberships.ts";
import { paymentMethods } from "./payment-methods.ts";
import { paymentSchedules } from "./payment-schedules.ts";
import { pickupWindows } from "./pickup-windows.ts";
import { users } from "./users.ts";
import { weeklyBatches } from "./weekly-batches.ts";

export const orderStatuses = [
  "draft",
  "awaiting_selection",
  "selection_in_progress",
  "selection_submitted",
  /** Chef-built orders after admin generates from saved drafts — read-only for customers. */
  "finalized",
  "pending_customer_review",
  "changes_requested",
  "approved",
  "charging",
  "ready_for_pickup",
  "picked_up",
  "payment_failed",
  "skipped",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const weeklyOrders = mysqlTable(
  "weekly_orders",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    batchId: varchar("batch_id", { length: 36 })
      .notNull()
      .references(() => weeklyBatches.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Nullable until membership-scoped orders roll out; historical rows stay null. */
    membershipId: varchar("membership_id", { length: 36 }).references(() => memberships.id, {
      onDelete: "restrict",
    }),
    status: mysqlEnum("status", orderStatuses).notNull().default("draft"),
    pickupWindowId: varchar("pickup_window_id", { length: 36 }).references(() => pickupWindows.id, {
      onDelete: "set null",
    }),
    /** Frozen from customer profile at approval time. */
    paymentScheduleSnapshot: mysqlEnum("payment_schedule_snapshot", paymentSchedules),
    /** Frozen from membership at selection open (nullable for historical orders). */
    mealsAllowedSnapshot: int("meals_allowed_snapshot"),
    portionSnapshot: mysqlEnum("portion_snapshot", portionDefaults),
    planSlugSnapshot: varchar("plan_slug_snapshot", { length: 64 }),
    planNameSnapshot: varchar("plan_name_snapshot", { length: 255 }),
    /** When this order becomes chargeable (batch schedule or monthly anchor). */
    chargeDueAt: timestamp("charge_due_at"),
    billingCycleId: varchar("billing_cycle_id", { length: 36 }).references(() => billingCycles.id, {
      onDelete: "set null",
    }),
    /** Overrides membership default for this order's invoice/charge. */
    paymentMethodId: varchar("payment_method_id", { length: 36 }).references(
      () => paymentMethods.id,
      { onDelete: "set null" },
    ),
    subtotalCents: int("subtotal_cents").notNull().default(0),
    taxCents: int("tax_cents").notNull().default(0),
    /** Gratuity from POS receipt; excluded from subtotal/tax, included in totalCents. */
    tipCents: int("tip_cents").notNull().default(0),
    totalCents: int("total_cents").notNull().default(0),
    /** GoFofa POS receipt id (e.g. DXba). */
    receiptNumber: varchar("receipt_number", { length: 32 }),
    /** External order id when present (e.g. Square order #). */
    externalOrderNumber: varchar("external_order_number", { length: 64 }),
    customerVisibleNote: text("customer_visible_note"),
    /** Set when order was imported from historical POS data. */
    importedAt: timestamp("imported_at"),
    reviewedAt: timestamp("reviewed_at"),
    /** Set when the customer submits their meal selection (selection lifecycle). */
    selectionSubmittedAt: timestamp("selection_submitted_at"),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("weekly_orders_batch_membership_idx").on(table.batchId, table.membershipId),
    index("weekly_orders_batch_id_idx").on(table.batchId),
    index("weekly_orders_user_id_idx").on(table.userId),
    index("weekly_orders_membership_id_idx").on(table.membershipId),
    index("weekly_orders_payment_method_id_idx").on(table.paymentMethodId),
  ],
);

export type WeeklyOrder = typeof weeklyOrders.$inferSelect;
export type NewWeeklyOrder = typeof weeklyOrders.$inferInsert;
