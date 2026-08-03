import { boolean, int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { users } from "./users";

export const paymentMethods = mysqlTable("payment_methods", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripePaymentMethodId: varchar("stripe_pm_id", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 32 }),
  last4: varchar("last4", { length: 4 }),
  expMonth: int("exp_month"),
  expYear: int("exp_year"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
