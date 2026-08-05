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

export const planCategoryAccents = ["gold", "green", "orange", "pink", "navy"] as const;
export type PlanCategoryAccent = (typeof planCategoryAccents)[number];

/** Marketing / pricing grouping for menu items (seed from mock catalog). */
export const planCategories = mysqlTable("plan_categories", {
  id: varchar("id", { length: 36 }).primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  tagline: varchar("tagline", { length: 255 }),
  description: text("description"),
  recommendedFor: text("recommended_for"),
  tags: json("tags").$type<string[]>(),
  price4ozCents: int("price_4oz_cents").notNull().default(0),
  price6ozCents: int("price_6oz_cents").notNull().default(0),
  accent: mysqlEnum("accent", planCategoryAccents).notNull().default("green"),
  sortOrder: int("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PlanCategory = typeof planCategories.$inferSelect;
export type NewPlanCategory = typeof planCategories.$inferInsert;
