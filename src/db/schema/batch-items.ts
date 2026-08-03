import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { weeklyBatches } from "./weekly-batches";

export const batchItems = mysqlTable("batch_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  batchId: varchar("batch_id", { length: 36 })
    .notNull()
    .references(() => weeklyBatches.id, { onDelete: "cascade" }),
  /** References menu catalog (seeded in a later phase). */
  menuItemId: varchar("menu_item_id", { length: 36 }).notNull(),
  qtyCooked: int("qty_cooked").notNull().default(0),
  qtyRemaining: int("qty_remaining").notNull().default(0),
  internalNote: text("internal_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BatchItem = typeof batchItems.$inferSelect;
export type NewBatchItem = typeof batchItems.$inferInsert;
