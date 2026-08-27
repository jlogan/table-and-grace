import {
  boolean,
  date,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

import type { DietaryPreferenceSlug, FoodAllergenSlug } from "@/lib/food-profile.ts";

import { paymentScheduleSetBy, paymentSchedules } from "./payment-schedules.ts";
import { pickupWindows } from "./pickup-windows.ts";
import { users } from "./users.ts";

export const portionDefaults = ["4oz", "6oz"] as const;
export type PortionDefault = (typeof portionDefaults)[number];

export const customerProfiles = mysqlTable("customer_profiles", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 32 }),
  birthday: date("birthday"),
  favoriteCake: varchar("favorite_cake", { length: 255 }),
  /** Set when upload/storage is implemented; not exposed as a raw URL in admin UI. */
  profilePhotoUrl: varchar("profile_photo_url", { length: 512 }),
  dietaryTags: json("dietary_tags").$type<string[]>(),
  allergies: text("allergies"),
  dietaryPreferences: json("dietary_preferences").$type<DietaryPreferenceSlug[]>(),
  dietaryPreferenceOther: text("dietary_preference_other"),
  foodAllergens: json("food_allergens").$type<FoodAllergenSlug[]>(),
  foodAllergenOther: text("food_allergen_other"),
  portionDefault: mysqlEnum("portion_default", portionDefaults).notNull().default("6oz"),
  householdSize: int("household_size"),
  chefNotes: text("chef_notes"),
  weeklyBudgetCents: int("weekly_budget_cents"),
  seniorMode: boolean("senior_mode").notNull().default(false),
  billingEnabled: boolean("billing_enabled").notNull().default(true),
  paymentSchedule: mysqlEnum("payment_schedule", paymentSchedules)
    .notNull()
    .default("weekly_autopay"),
  /** Day of month (1–28) for monthly_autopay customers; admin-set. */
  monthlyBillingDay: int("monthly_billing_day"),
  paymentScheduleSetBy: mysqlEnum("payment_schedule_set_by", paymentScheduleSetBy)
    .notNull()
    .default("customer"),
  /** When false, orders stay manual until customer approves even on weekly_autopay. */
  autopayEnabled: boolean("autopay_enabled").notNull().default(true),
  smsOptIn: boolean("sms_opt_in").notNull().default(false),
  defaultPickupWindowId: varchar("default_pickup_window_id", { length: 36 }).references(
    () => pickupWindows.id,
    { onDelete: "set null" },
  ),
  /** App-editable metadata mirrored to Stripe Customer.metadata (no env/site routing keys). */
  stripeCustomerMetadata: json("stripe_customer_metadata").$type<Record<string, string>>(),
  stripeCustomerMetadataUpdatedAt: timestamp("stripe_customer_metadata_updated_at"),
  stripeCustomerSyncedAt: timestamp("stripe_customer_synced_at"),
  stripeCustomerSyncError: text("stripe_customer_sync_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type NewCustomerProfile = typeof customerProfiles.$inferInsert;
