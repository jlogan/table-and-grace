import { mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const userRoles = ["customer", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  role: mysqlEnum("role", userRoles).notNull().default("customer"),
  /** Stripe Customer id for saved cards and off-session weekly charges. */
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
