import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users.ts";

export const paymentMethodStatuses = ["active", "detached", "expired", "requires_action"] as const;
export type PaymentMethodStatus = (typeof paymentMethodStatuses)[number];

export const paymentMethods = mysqlTable(
  "payment_methods",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripePaymentMethodId: varchar("stripe_pm_id", { length: 255 }).notNull(),
    /** Stripe Customer this PM is attached to (for sync verification). */
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    brand: varchar("brand", { length: 32 }),
    last4: varchar("last4", { length: 4 }),
    expMonth: int("exp_month"),
    expYear: int("exp_year"),
    status: mysqlEnum("status", paymentMethodStatuses).notNull().default("active"),
    isDefault: boolean("is_default").notNull().default(false),
    lastUsedAt: timestamp("last_used_at"),
    detachedAt: timestamp("detached_at"),
    lastFailureAt: timestamp("last_failure_at"),
    lastFailureReason: text("last_failure_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_methods_stripe_pm_id_idx").on(table.stripePaymentMethodId),
    uniqueIndex("payment_methods_user_stripe_pm_id_idx").on(
      table.userId,
      table.stripePaymentMethodId,
    ),
    index("payment_methods_user_id_idx").on(table.userId),
    index("payment_methods_status_idx").on(table.status),
  ],
);

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
