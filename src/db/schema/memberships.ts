import { mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { users } from "./users.ts";

export const membershipStatuses = ["active", "paused", "cancelled"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const memberships = mysqlTable("memberships", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", membershipStatuses).notNull().default("active"),
  pausedUntil: timestamp("paused_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
