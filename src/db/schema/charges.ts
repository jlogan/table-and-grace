import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { weeklyOrders } from "./weekly-orders";

export const chargeStatuses = ["pending", "succeeded", "failed", "cancelled"] as const;
export type ChargeStatus = (typeof chargeStatuses)[number];

export const charges = mysqlTable("charges", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 })
    .notNull()
    .references(() => weeklyOrders.id, { onDelete: "cascade" }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  amountCents: int("amount_cents").notNull(),
  status: mysqlEnum("status", chargeStatuses).notNull().default("pending"),
  failureReason: text("failure_reason"),
  chargedAt: timestamp("charged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Charge = typeof charges.$inferSelect;
export type NewCharge = typeof charges.$inferInsert;
