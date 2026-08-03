import {
  date,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const batchStatuses = [
  "planning",
  "draft",
  "pending_customer_review",
  "approved",
  "charging",
  "closed",
] as const;
export type BatchStatus = (typeof batchStatuses)[number];

export const weeklyBatches = mysqlTable(
  "weekly_batches",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    weekStart: date("week_start").notNull(),
    pickupDate: date("pickup_date"),
    pickupWindowId: varchar("pickup_window_id", { length: 36 }),
    status: mysqlEnum("status", batchStatuses).notNull().default("planning"),
    chefInternalNotes: text("chef_internal_notes"),
    reviewDeadline: timestamp("review_deadline"),
    chargeScheduledAt: timestamp("charge_scheduled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("weekly_batches_week_start_idx").on(table.weekStart)],
);

export type WeeklyBatch = typeof weeklyBatches.$inferSelect;
export type NewWeeklyBatch = typeof weeklyBatches.$inferInsert;
