import {
  date,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { pickupWindows } from "./pickup-windows.ts";

export const batchStatuses = [
  "planning",
  "draft",
  "selection_open",
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
    pickupWindowId: varchar("pickup_window_id", { length: 36 }).references(() => pickupWindows.id, {
      onDelete: "set null",
    }),
    status: mysqlEnum("status", batchStatuses).notNull().default("planning"),
    chefInternalNotes: text("chef_internal_notes"),
    reviewDeadline: timestamp("review_deadline"),
    /** Customer meal-selection cutoff for the selection lifecycle (distinct from review_deadline). */
    selectionDeadline: timestamp("selection_deadline"),
    chargeScheduledAt: timestamp("charge_scheduled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("weekly_batches_week_start_idx").on(table.weekStart)],
);

export type WeeklyBatch = typeof weeklyBatches.$inferSelect;
export type NewWeeklyBatch = typeof weeklyBatches.$inferInsert;
