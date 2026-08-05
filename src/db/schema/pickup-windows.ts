import { boolean, int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Pickup location/time slots (seed from mock catalog). */
export const pickupWindows = mysqlTable("pickup_windows", {
  id: varchar("id", { length: 36 }).primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  dayOfWeek: varchar("day_of_week", { length: 16 }).notNull(),
  timeRange: varchar("time_range", { length: 64 }).notNull(),
  locationName: varchar("location_name", { length: 255 }),
  sortOrder: int("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PickupWindow = typeof pickupWindows.$inferSelect;
export type NewPickupWindow = typeof pickupWindows.$inferInsert;
