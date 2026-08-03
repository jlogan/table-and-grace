import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";
import { weeklyBatches } from "./weekly-batches";

export const orderStatuses = [
  "draft",
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
    status: mysqlEnum("status", orderStatuses).notNull().default("draft"),
    pickupWindowId: varchar("pickup_window_id", { length: 36 }),
    subtotalCents: int("subtotal_cents").notNull().default(0),
    taxCents: int("tax_cents").notNull().default(0),
    totalCents: int("total_cents").notNull().default(0),
    customerVisibleNote: text("customer_visible_note"),
    reviewedAt: timestamp("reviewed_at"),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("weekly_orders_batch_user_idx").on(table.batchId, table.userId)],
);

export type WeeklyOrder = typeof weeklyOrders.$inferSelect;
export type NewWeeklyOrder = typeof weeklyOrders.$inferInsert;
