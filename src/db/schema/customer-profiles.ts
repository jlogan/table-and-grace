import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

import { users } from "./users";

export const portionDefaults = ["4oz", "6oz"] as const;
export type PortionDefault = (typeof portionDefaults)[number];

export const customerProfiles = mysqlTable("customer_profiles", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 32 }),
  dietaryTags: json("dietary_tags").$type<string[]>(),
  allergies: text("allergies"),
  portionDefault: mysqlEnum("portion_default", portionDefaults).notNull().default("6oz"),
  householdSize: int("household_size"),
  chefNotes: text("chef_notes"),
  weeklyBudgetCents: int("weekly_budget_cents"),
  seniorMode: boolean("senior_mode").notNull().default(false),
  billingEnabled: boolean("billing_enabled").notNull().default(true),
  smsOptIn: boolean("sms_opt_in").notNull().default(false),
  defaultPickupWindowId: varchar("default_pickup_window_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type NewCustomerProfile = typeof customerProfiles.$inferInsert;
