import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { billingCycles } from "./billing-cycles.ts";
import { weeklyOrders } from "./weekly-orders.ts";

export const chargeStatuses = ["pending", "succeeded", "failed", "cancelled"] as const;
export type ChargeStatus = (typeof chargeStatuses)[number];

export const charges = mysqlTable("charges", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 })
    .notNull()
    .references(() => weeklyOrders.id, { onDelete: "cascade" }),
  /** Set when charge is part of a monthly billing cycle aggregate. */
  billingCycleId: varchar("billing_cycle_id", { length: 36 }).references(() => billingCycles.id, {
    onDelete: "set null",
  }),
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
