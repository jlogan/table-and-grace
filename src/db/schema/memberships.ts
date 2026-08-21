import { int, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { portionDefaults } from "./customer-profiles.ts";
import { paymentSchedules } from "./payment-schedules.ts";
import { users } from "./users.ts";

export const membershipStatuses = ["active", "paused", "cancelled"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const billingProfiles = ["catalog", "fixed_price"] as const;
export type BillingProfile = (typeof billingProfiles)[number];

export const memberships = mysqlTable("memberships", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", membershipStatuses).notNull().default("active"),
  pausedUntil: timestamp("paused_until"),
  planSlug: varchar("plan_slug", { length: 64 }),
  mealsPerWeek: int("meals_per_week"),
  portionDefault: mysqlEnum("portion_default", portionDefaults).notNull().default("6oz"),
  paymentSchedule: mysqlEnum("payment_schedule", paymentSchedules)
    .notNull()
    .default("weekly_autopay"),
  billingProfile: mysqlEnum("billing_profile", billingProfiles).notNull().default("catalog"),
  /** Per-meal price when billingProfile is fixed_price (cents). */
  fixedPricePerMealCents: int("fixed_price_per_meal_cents"),
  /** Flat discount applied to membership billing (cents). */
  discountCents: int("discount_cents").notNull().default(0),
  /** Admin-facing label for the fixed-price discount, e.g. Senior dinner promo. */
  discountLabel: varchar("discount_label", { length: 120 }),
  /** Weekly invoice day, 0=Sunday through 6=Saturday. */
  weeklyInvoiceDay: int("weekly_invoice_day"),
  /** Monthly invoice day of month, 1-28 for predictable recurring billing. */
  monthlyInvoiceDay: int("monthly_invoice_day"),
  /** Future biweekly/manual anchor date for billing schedule planning. */
  biweeklyAnchorDate: timestamp("biweekly_anchor_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
