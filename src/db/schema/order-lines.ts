import { int, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { menuItems } from "./menu-items.ts";
import { weeklyOrders } from "./weekly-orders.ts";

export const orderLineSources = [
  "recurring",
  "chef_assigned",
  "customer_requested",
  "adjustment",
] as const;
export type OrderLineSource = (typeof orderLineSources)[number];

export const portions = ["4oz", "6oz"] as const;
export type Portion = (typeof portions)[number];

export const orderLines = mysqlTable("order_lines", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 })
    .notNull()
    .references(() => weeklyOrders.id, { onDelete: "cascade" }),
  menuItemId: varchar("menu_item_id", { length: 36 })
    .notNull()
    .references(() => menuItems.id, { onDelete: "restrict" }),
  portion: mysqlEnum("portion", portions).notNull().default("6oz"),
  qty: int("qty").notNull().default(1),
  unitPriceCents: int("unit_price_cents").notNull().default(0),
  source: mysqlEnum("source", orderLineSources).notNull().default("chef_assigned"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type OrderLine = typeof orderLines.$inferSelect;
export type NewOrderLine = typeof orderLines.$inferInsert;
