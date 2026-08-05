import { boolean, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { planCategories } from "./plan-categories.ts";

/** Individual meals / add-ons in the catalog. Pricing defaults from plan category. */
export const menuItems = mysqlTable("menu_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  categoryId: varchar("category_id", { length: 36 }).references(() => planCategories.id, {
    onDelete: "set null",
  }),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  note: text("note"),
  /** Override category default; null inherits from plan category. */
  price4ozCents: int("price_4oz_cents"),
  price6ozCents: int("price_6oz_cents"),
  sortOrder: int("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
