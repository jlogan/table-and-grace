import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { menuItems } from "./menu-items.ts";
import { orderLines } from "./order-lines.ts";
import { weeklyOrders } from "./weekly-orders.ts";

export const orderLineRequestTypes = ["substitution", "zero_out", "add"] as const;
export type OrderLineRequestType = (typeof orderLineRequestTypes)[number];

export const orderLineRequestStatuses = ["pending", "accepted", "rejected"] as const;
export type OrderLineRequestStatus = (typeof orderLineRequestStatuses)[number];

/** Structured customer substitution / qty requests during weekly review. */
export const orderLineRequests = mysqlTable("order_line_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 })
    .notNull()
    .references(() => weeklyOrders.id, { onDelete: "cascade" }),
  orderLineId: varchar("order_line_id", { length: 36 }).references(() => orderLines.id, {
    onDelete: "cascade",
  }),
  type: mysqlEnum("type", orderLineRequestTypes).notNull(),
  requestedMenuItemId: varchar("requested_menu_item_id", { length: 36 }).references(
    () => menuItems.id,
    { onDelete: "set null" },
  ),
  requestedQty: int("requested_qty").notNull().default(0),
  customerNote: text("customer_note"),
  status: mysqlEnum("status", orderLineRequestStatuses).notNull().default("pending"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type OrderLineRequest = typeof orderLineRequests.$inferSelect;
export type NewOrderLineRequest = typeof orderLineRequests.$inferInsert;
