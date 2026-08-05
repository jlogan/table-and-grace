import { date, int, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { users } from "./users.ts";

export const billingCycleStatuses = ["open", "charging", "charged", "failed"] as const;
export type BillingCycleStatus = (typeof billingCycleStatuses)[number];

/** Monthly autopay aggregation window for a customer. */
export const billingCycles = mysqlTable("billing_cycles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: mysqlEnum("status", billingCycleStatuses).notNull().default("open"),
  totalCents: int("total_cents").notNull().default(0),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  chargedAt: timestamp("charged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BillingCycle = typeof billingCycles.$inferSelect;
export type NewBillingCycle = typeof billingCycles.$inferInsert;
