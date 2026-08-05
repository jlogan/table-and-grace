import { mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { users } from "./users.ts";
import { weeklyOrders } from "./weekly-orders.ts";

export const commentVisibilities = ["customer", "internal"] as const;
export type CommentVisibility = (typeof commentVisibilities)[number];

export const orderComments = mysqlTable("order_comments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  orderId: varchar("order_id", { length: 36 })
    .notNull()
    .references(() => weeklyOrders.id, { onDelete: "cascade" }),
  authorId: varchar("author_id", { length: 36 }).references(() => users.id, {
    onDelete: "set null",
  }),
  body: text("body").notNull(),
  visibility: mysqlEnum("visibility", commentVisibilities).notNull().default("customer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrderComment = typeof orderComments.$inferSelect;
export type NewOrderComment = typeof orderComments.$inferInsert;
