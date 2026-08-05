import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { menuItems } from "./menu-items.ts";
import { weeklyBatches } from "./weekly-batches.ts";

export const batchItems = mysqlTable("batch_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  batchId: varchar("batch_id", { length: 36 })
    .notNull()
    .references(() => weeklyBatches.id, { onDelete: "cascade" }),
  menuItemId: varchar("menu_item_id", { length: 36 })
    .notNull()
    .references(() => menuItems.id, { onDelete: "restrict" }),
  qtyCooked: int("qty_cooked").notNull().default(0),
  qtyRemaining: int("qty_remaining").notNull().default(0),
  internalNote: text("internal_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BatchItem = typeof batchItems.$inferSelect;
export type NewBatchItem = typeof batchItems.$inferInsert;
